/**
 * rbys — Read Before You Sign, in your terminal.
 *
 *   rbys <base64-tx>                 check a transaction (or a bare message)
 *   <command> | rbys                 read it from stdin
 *   rbys --file tx.txt               read it from a file
 *
 * Options:
 *   -c, --cluster <devnet|mainnet|testnet|localnet>   where to simulate (default devnet)
 *   --rpc <url>                      custom RPC (overrides --cluster)
 *   --json                           print the raw report as JSON
 *   --no-ai                          skip the AI wording, use the template
 *   -h, --help
 *
 * Exit code: 0 = looks okay, 2 = worth a look, 3 = high risk, 1 = error.
 * So you can gate a send in a script:  rbys "$TX" && solana ...
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { analyze } from "./lib/analyze";
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

// ---------- tiny ANSI styling (off when piped or NO_COLOR is set) ----------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const sgr = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = sgr("1"), dim = sgr("2"), red = sgr("31"), yellow = sgr("33"), green = sgr("32"),
  blue = sgr("34"), purple = sgr("35"), inverseRed = sgr("1;41;97"), inverseYellow = sgr("1;43;30"),
  inverseGreen = sgr("1;42;30");

const SEV = {
  danger: { mark: red("✖"), color: red },
  warning: { mark: yellow("▲"), color: yellow },
  info: { mark: blue("ℹ"), color: blue },
} as const;

const LEVEL = {
  high: { badge: inverseRed(" HIGH RISK "), line: "Don't sign this unless you're sure.", code: 3 },
  medium: { badge: inverseYellow(" WORTH A LOOK "), line: "Read the warnings before signing.", code: 2 },
  low: { badge: inverseGreen(" LOOKS OKAY "), line: "Nothing risky stood out.", code: 0 },
} as const;

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
const wrap = (text: string, indent: string, width = Math.min(process.stdout.columns || 88, 100)) =>
  text
    .split("\n")
    .map((para) => {
      const out: string[] = [];
      let line = "";
      for (const word of para.split(/\s+/)) {
        if (line && indent.length + line.length + word.length + 1 > width) {
          out.push(indent + line);
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      out.push(indent + line);
      return out.join("\n");
    })
    .join("\n");

function render(r: Report, cluster: string) {
  const L = LEVEL[r.level];
  const lines: string[] = [];
  lines.push("");
  lines.push(`${purple(bold("◆ Read Before You Sign"))}  ${dim(`simulated on ${cluster}`)}`);
  lines.push("");
  lines.push(`  ${L.badge}  ${bold(`${r.score}/100`)}  ${L.line}`);
  lines.push("");

  if (r.flags.length) {
    lines.push(bold("  What to watch"));
    for (const f of r.flags) {
      const s = SEV[f.severity];
      lines.push(`  ${s.mark} ${s.color(bold(f.title))}`);
      lines.push(dim(wrap(f.detail, "      ")));
    }
    lines.push("");
  }

  // The template version just restates the flags above, so only show the AI one.
  if (r.explanationSource === "llm") {
    lines.push(bold("  In plain English") + dim("  (AI-worded from the findings above; it can't change the score)"));
    lines.push(wrap(r.explanation, "    "));
    lines.push("");
  }

  lines.push(bold(`  Instructions (${r.instructions.length})`));
  for (const ix of r.instructions) {
    const tag = ix.known ? green(ix.programName) : yellow(ix.programName);
    lines.push(`  ${dim(`${ix.index + 1}.`)} ${tag} ${dim("·")} ${ix.type}`);
    lines.push(dim(wrap(ix.summary, "     ")));
  }
  lines.push("");

  const bc = r.simulation.balanceChanges;
  lines.push(bold("  Balance changes") + dim(r.simulation.ok ? "  (from simulation)" : "  (simulation failed: none verified)"));
  if (!bc.length) lines.push(dim("    none"));
  for (const b of bc) {
    const delta = BigInt(b.delta);
    const amt = b.kind === "sol" ? `${Number(delta) / 1e9} SOL` : `${delta} units of ${short(b.mint ?? "?")}`;
    lines.push(`    ${short(b.address)}  ${delta < 0n ? red(amt) : green(`+${amt}`)}`);
  }
  lines.push("");
  lines.push(dim(`  fee payer ${short(r.feePayer)}${r.simulation.unitsConsumed ? ` · ${r.simulation.unitsConsumed} CU` : ""}`));
  lines.push("");
  console.log(lines.join("\n"));
}

function usage(code = 0): never {
  console.log(`
${bold("rbys")} — see what a Solana transaction does before you sign it

  rbys <base64-tx>             check a transaction or bare message
  <command> | rbys             read from stdin
  rbys --file tx.txt           read from a file

  -c, --cluster <name>         devnet (default), mainnet, testnet, localnet
  --rpc <url>                  custom RPC URL
  --json                       raw JSON report
  --no-ai                      skip AI wording
Exit: 0 okay · 2 worth a look · 3 high risk · 1 error`);
  process.exit(code);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const args = process.argv.slice(2);
  let cluster = process.env.RBYS_CLUSTER ?? "devnet";
  let rpc: string | undefined = process.env.SOLANA_RPC_URL;
  let json = false, ai = true, file: string | undefined, tx: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") usage();
    else if (a === "-c" || a === "--cluster") { cluster = args[++i]; rpc = undefined; }
    else if (a === "--rpc") rpc = args[++i];
    else if (a === "--json") json = true;
    else if (a === "--no-ai") ai = false;
    else if (a === "--file" || a === "-f") file = args[++i];
    else if (a === "-") tx = undefined;
    else if (a.startsWith("-")) { console.error(red(`Unknown option ${a}`)); usage(1); }
    else tx = a;
  }

  const rpcUrl = rpc ?? CLUSTERS[cluster];
  if (!rpcUrl) { console.error(red(`Unknown cluster "${cluster}"`)); usage(1); }

  if (file) tx = readFileSync(file, "utf8");
  if (!tx) {
    if (process.stdin.isTTY) usage(1);
    tx = await readStdin();
  }
  // Pull the base64 out of noisy output (e.g. a CLI that prints labels around it).
  const candidate = tx
    .split(/\s+/)
    .filter((t) => t.length >= 64 && /^[A-Za-z0-9+/]+={0,2}$/.test(t))
    .sort((a, b) => b.length - a.length)[0];
  if (!candidate) { console.error(red("No base64 transaction found in the input.")); process.exit(1); }

  const report = await analyze(candidate, {
    rpcUrl,
    registryRpcUrl: process.env.REGISTRY_RPC_URL ?? CLUSTERS.devnet,
    anthropicApiKey: ai ? process.env.ANTHROPIC_API_KEY : undefined,
  });

  if (json) console.log(JSON.stringify(report, null, 2));
  else render(report, rpc ? rpcUrl : cluster);
  process.exit(LEVEL[report.level].code);
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  const hint = /deserializ|Reached end|out of range|RangeError/i.test(msg)
    ? "That doesn't look like a valid base64 Solana transaction."
    : msg;
  console.error(red(`rbys: ${hint}`));
  process.exit(1);
});
