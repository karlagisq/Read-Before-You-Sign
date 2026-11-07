/**
 * rbys — Read Before You Sign, in your terminal.
 *
 *   rbys                             interactive: paste a transaction
 *   rbys <base64-tx>                 check a transaction (or a bare message)
 *   <command> | rbys                 read it from stdin
 *   rbys --file tx.txt               read it from a file
 *   rbys demo [sample]               run the labeled sample transactions
 *
 * Options:
 *   -c, --cluster <devnet|mainnet|testnet|localnet>   where to simulate (default devnet)
 *   --rpc <url>                      custom RPC (overrides --cluster)
 *   --json                           print the raw report as JSON
 *   --no-ai                          skip the AI wording
 *   -h, --help
 *
 * Exit code: 0 = looks okay, 2 = worth a look, 3 = high risk, 1 = error.
 *
 * Works offline: decoding and the risk rules run locally. Only the dry run
 * (simulation) and the registry lookup need the network; without it you get
 * the static findings plus a "couldn't verify" warning.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { Keypair } from "@solana/web3.js";
import { analyze } from "./lib/analyze";
import { SAMPLES, buildSample } from "./lib/samples";
import type { Report } from "./lib/types";

const CLUSTERS: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  localnet: "http://127.0.0.1:8899",
};

// Reuse the app's settings (REGISTRY_PROGRAM_ID, ANTHROPIC_API_KEY, ...).
const envFile = join(__dirname, "..", ".env.local");
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    /* older Node: fall back to the shell environment */
  }
}

// ------------------------------------------------------------------ styling
// Theme tokens: keep in sync with app/src/app/globals.css and the Figma file.
type RGB = readonly [number, number, number];
const THEME: Record<string, RGB> = {
  accentA: [94, 234, 212], // #5eead4
  accentB: [56, 189, 248], // #38bdf8
  accentC: [139, 92, 246], // #8b5cf6
  danger: [255, 107, 129], // #ff6b81
  warn: [251, 191, 36], // #fbbf24
  ok: [52, 211, 153], // #34d399
  info: [125, 211, 252], // #7dd3fc
  muted: [141, 151, 196], // #8d97c4
  faint: [92, 102, 143], // #5c668f
  border: [70, 80, 130],
};

const out = process.stdout;
const color = Boolean(out.isTTY) && !process.env.NO_COLOR;
const truecolor = color && (/truecolor|24bit/i.test(process.env.COLORTERM ?? "") || process.env.WT_SESSION !== undefined);
const to256 = ([r, g, b]: RGB) => 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5);
const fg = (c: RGB) => (s: string) =>
  !color ? s : truecolor ? `\x1b[38;2;${c[0]};${c[1]};${c[2]}m${s}\x1b[39m` : `\x1b[38;5;${to256(c)}m${s}\x1b[39m`;
const bg = (c: RGB) => (s: string) =>
  !color ? s : truecolor ? `\x1b[48;2;${c[0]};${c[1]};${c[2]}m${s}\x1b[49m` : `\x1b[48;5;${to256(c)}m${s}\x1b[49m`;
const bold = (s: string) => (color ? `\x1b[1m${s}\x1b[22m` : s);
const ink: RGB = [6, 16, 31];
const muted = fg(THEME.muted), faint = fg(THEME.faint), line = fg(THEME.border);

const mix = (a: RGB, b: RGB, t: number): RGB =>
  [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as unknown as RGB;
function gradient(text: string): string {
  if (!color) return text;
  const chars = [...text];
  return chars
    .map((ch, i) => {
      const t = chars.length > 1 ? i / (chars.length - 1) : 0;
      const c = t < 0.5 ? mix(THEME.accentA, THEME.accentB, t * 2) : mix(THEME.accentB, THEME.accentC, (t - 0.5) * 2);
      return fg(c)(ch);
    })
    .join("");
}

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const vlen = (s: string) => [...strip(s)].length;
const WIDTH = Math.max(52, Math.min(out.columns || 80, 84) - 2);

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (cur && vlen(cur) + 1 + vlen(word) > width) {
        lines.push(cur);
        cur = word;
      } else cur = cur ? `${cur} ${word}` : word;
    }
    lines.push(cur);
  }
  return lines;
}

/** Rounded box; each body line is padded to the box width. */
function box(lines: string[], tint: (s: string) => string = line, title?: string): string {
  const inner = WIDTH - 4;
  const top = title
    ? tint("╭─ ") + title + tint(" " + "─".repeat(Math.max(0, WIDTH - 5 - vlen(title))) + "╮")
    : tint("╭" + "─".repeat(WIDTH - 2) + "╮");
  const body = lines.map((l) => tint("│ ") + l + " ".repeat(Math.max(0, inner - vlen(l))) + tint(" │"));
  return [top, ...body, tint("╰" + "─".repeat(WIDTH - 2) + "╯")].join("\n");
}

function gauge(score: number, c: RGB, width: number): string {
  const filled = Math.round((Math.min(score, 100) / 100) * width);
  return fg(c)("█".repeat(filled)) + faint("░".repeat(width - filled));
}

const LEVEL = {
  high: { label: " HIGH RISK ", line: "Don't sign this unless you're sure.", c: THEME.danger, code: 3 },
  medium: { label: " WORTH A LOOK ", line: "Read the warnings before signing.", c: THEME.warn, code: 2 },
  low: { label: " LOOKS OKAY ", line: "Nothing risky stood out.", c: THEME.ok, code: 0 },
} as const;
const SEV = {
  danger: { mark: "✖", c: THEME.danger },
  warning: { mark: "▲", c: THEME.warn },
  info: { mark: "ℹ", c: THEME.info },
} as const;

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

function banner(): string {
  const mark = color ? bg(THEME.accentA)(fg(ink)(bold(" ✓ "))) : "[✓]";
  return `\n  ${mark}  ${bold(gradient("Read Before You Sign"))}  ${faint("· know what you sign, before you sign")}\n`;
}

// ------------------------------------------------------------------ spinner
function spinner(text: string) {
  if (!process.stderr.isTTY || !color) return { stop: () => {} };
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const t = setInterval(() => process.stderr.write(`\r  ${gradient(frames[i++ % frames.length])} ${muted(text)}`), 80);
  return {
    stop: () => {
      clearInterval(t);
      process.stderr.write("\r\x1b[2K");
    },
  };
}

// ------------------------------------------------------------------ report
function render(r: Report, cluster: string, title?: string): string {
  const L = LEVEL[r.level];
  const parts: string[] = [];
  if (title) parts.push(`  ${muted("sample")}  ${bold(title)}`);

  const badge = color ? bg(L.c)(fg(ink)(bold(L.label))) : `[${L.label.trim()}]`;
  parts.push(box([`${badge}  ${bold(fg(L.c)(String(r.score)))}${faint("/100")}  ${L.line}`, gauge(r.score, L.c, WIDTH - 4)], fg(L.c)));

  if (r.flags.length) {
    const lines: string[] = [];
    r.flags.forEach((f, i) => {
      const s = SEV[f.severity];
      if (i) lines.push("");
      lines.push(`${fg(s.c)(s.mark)} ${bold(f.title)}`);
      for (const l of wrap(f.detail, WIDTH - 8)) lines.push(`  ${muted(l)}`);
    });
    parts.push(box(lines, line, bold("What to watch")));
  }

  // The template version just restates the findings, so only show AI wording.
  if (r.explanationSource === "llm") {
    parts.push(
      box(
        [...wrap(r.explanation, WIDTH - 6), faint("AI-worded from the findings above; it can't change the score.")],
        line,
        bold("In plain English")
      )
    );
  }

  const route = r.instructions.map((ix) => fg(ix.known ? THEME.accentA : THEME.warn)(ix.programName));
  const lines: string[] = [`${muted("route")}     ${route.join(faint(" → "))}`];
  for (const ix of r.instructions) {
    wrap(`${ix.type}: ${ix.summary}`, WIDTH - 14).forEach((l, i) =>
      lines.push(`${i ? "          " : faint(`${String(ix.index + 1).padStart(2)}.`) + "       "}${l}`)
    );
  }
  lines.push("");
  const sim = r.simulation;
  if (!sim.balanceChanges.length) lines.push(`${muted("balances")}  ${faint(sim.ok ? "no changes" : "not verified (simulation failed)")}`);
  for (const b of sim.balanceChanges) {
    const d = BigInt(b.delta);
    const amt = b.kind === "sol" ? `${Number(d) / 1e9} SOL` : `${d} units ${short(b.mint ?? "?")}`;
    lines.push(`${muted("balance")}   ${short(b.address)}  ${d < 0n ? fg(THEME.danger)(amt) : fg(THEME.ok)(`+${amt}`)}`);
  }
  lines.push(
    `${muted("network")}   ${cluster}${faint(`  ·  fee payer ${short(r.feePayer)}`)}${
      sim.unitsConsumed ? faint(`  ·  ${sim.unitsConsumed.toLocaleString()} CU`) : ""
    }`
  );
  parts.push(box(lines, line, bold("Transaction")));
  return parts.join("\n") + "\n";
}

function usage(code = 0): never {
  console.log(`${banner()}
  ${bold("Usage")}
    rbys                         paste a transaction interactively
    rbys <base64-tx>             check a transaction or bare message
    <command> | rbys             read from stdin
    rbys --file tx.txt           read from a file
    rbys demo [sample]           run the labeled sample transactions

  ${bold("Options")}
    -c, --cluster <name>         devnet ${faint("(default)")}, mainnet, testnet, localnet
    --rpc <url>                  custom RPC URL
    --json                       raw JSON report
    --no-ai                      skip AI wording

  ${bold("Exit codes")}  ${fg(THEME.ok)("0")} okay · ${fg(THEME.warn)("2")} worth a look · ${fg(THEME.danger)("3")} high risk · 1 error
`);
  process.exit(code);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function prompt(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((res) =>
    rl.question(`  ${gradient("›")} ${muted("Paste a base64 transaction and press Enter:")}\n  `, res)
  );
  rl.close();
  return answer;
}

function pickBase64(text: string): string | null {
  return (
    text
      .split(/\s+/)
      .filter((t) => t.length >= 64 && /^[A-Za-z0-9+/]+={0,2}$/.test(t))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

async function main() {
  const args = process.argv.slice(2);
  let cluster = process.env.RBYS_CLUSTER ?? "devnet";
  let rpc: string | undefined = process.env.SOLANA_RPC_URL;
  let json = false, ai = true, file: string | undefined, tx: string | undefined;
  let demo: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") usage();
    else if (a === "-c" || a === "--cluster") { cluster = args[++i]; rpc = undefined; }
    else if (a === "--rpc") rpc = args[++i];
    else if (a === "--json") json = true;
    else if (a === "--no-ai") ai = false;
    else if (a === "--file" || a === "-f") file = args[++i];
    else if (a === "demo" && demo === null && !tx) demo = args[i + 1] && !args[i + 1].startsWith("-") ? args[++i] : "";
    else if (a === "-") tx = undefined;
    else if (a.startsWith("-")) { console.error(fg(THEME.danger)(`Unknown option ${a}`)); usage(1); }
    else tx = a;
  }

  const rpcUrl = rpc ?? CLUSTERS[cluster];
  if (!rpcUrl) { console.error(fg(THEME.danger)(`Unknown cluster "${cluster}"`)); usage(1); }
  const clusterLabel = rpc ? rpcUrl : cluster;
  const opts = {
    rpcUrl,
    registryRpcUrl: process.env.REGISTRY_RPC_URL ?? CLUSTERS.devnet,
    anthropicApiKey: ai ? process.env.ANTHROPIC_API_KEY : undefined,
  };

  // ---- demo mode: every labeled sample, one after another ----
  if (demo !== null) {
    const list = demo ? SAMPLES.filter((s) => s.id === demo) : SAMPLES;
    if (!list.length) {
      console.error(fg(THEME.danger)(`Unknown sample "${demo}". Options: ${SAMPLES.map((s) => s.id).join(", ")}`));
      process.exit(1);
    }
    if (!json) console.log(banner());
    let worst = 0;
    const payer = Keypair.generate().publicKey;
    for (const s of list) {
      const b64 = Buffer.from(buildSample(s, payer, "11111111111111111111111111111111").serialize()).toString("base64");
      const spin = json ? { stop: () => {} } : spinner(`Simulating "${s.title}" on ${clusterLabel}…`);
      const report = await analyze(b64, opts);
      spin.stop();
      if (json) console.log(JSON.stringify({ sample: s.id, ...report }));
      else {
        const room = WIDTH - 12 - s.title.length;
        const pitch = s.pitch.length > room ? s.pitch.slice(0, Math.max(0, room - 1)) + "…" : s.pitch;
        console.log(render(report, clusterLabel, `${s.title} ${faint("— " + pitch)}`));
      }
      worst = Math.max(worst, LEVEL[report.level].code);
    }
    process.exit(worst);
  }

  // ---- single transaction ----
  let interactive = false;
  if (file) tx = readFileSync(file, "utf8");
  if (!tx) {
    if (process.stdin.isTTY) {
      interactive = true;
      console.log(banner());
      tx = await prompt();
    } else tx = await readStdin();
  }
  const candidate = pickBase64(tx);
  if (!candidate) {
    console.error(fg(THEME.danger)("  No base64 transaction found in the input."));
    process.exit(1);
  }

  const spin = json ? { stop: () => {} } : spinner(`Simulating on ${clusterLabel}…`);
  let report: Report;
  try {
    report = await analyze(candidate, opts);
  } finally {
    spin.stop();
  }

  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    if (!interactive) console.log(banner());
    console.log(render(report, clusterLabel));
  }
  process.exit(LEVEL[report.level].code);
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  const hint = /deserializ|Reached end|out of range|RangeError/i.test(msg)
    ? "That doesn't look like a valid base64 Solana transaction."
    : msg;
  console.error(fg(THEME.danger)(`  rbys: ${hint}`));
  process.exit(1);
});
