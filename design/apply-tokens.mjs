#!/usr/bin/env node
/**
 * Applies design/tokens.json to every place the theme lives:
 *   app/src/app/globals.css   (web UI)
 *   extension/bridge.js       (review panel)
 *   extension/popup.html      (extension popup)
 *   app/src/cli.ts            (terminal colors)
 *
 * It compares tokens.json with design/.tokens-applied.json (what the code
 * uses now) and swaps each changed color everywhere: hex (#ff6b81), CSS
 * rgba triplets (255,107,129) and CLI arrays ([255, 107, 129]).
 *
 *   node design/apply-tokens.mjs            apply
 *   node design/apply-tokens.mjs --check    show what would change
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["app/src/app/globals.css", "extension/bridge.js", "extension/popup.html", "app/src/cli.ts"];
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const next = read("design/tokens.json");
const prev = read("design/.tokens-applied.json");
const check = process.argv.includes("--check");

const isHex = (h) => typeof h === "string" && /^#[0-9a-f]{6}$/i.test(h);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const changes = Object.keys(next)
  .filter((k) => !k.startsWith("$"))
  .filter((k) => {
    if (!isHex(next[k])) throw new Error(`tokens.json: "${k}" must be a #rrggbb color, got ${next[k]}`);
    return isHex(prev[k]) && prev[k].toLowerCase() !== next[k].toLowerCase();
  });

if (!changes.length) {
  console.log("Theme is already up to date.");
  process.exit(0);
}

let total = 0;
for (const file of FILES) {
  const path = join(root, file);
  let src = readFileSync(path, "utf8");
  let count = 0;
  for (const k of changes) {
    const [or, og, ob] = rgb(prev[k]);
    const [nr, ng, nb] = rgb(next[k]);
    const rules = [
      [new RegExp(esc(prev[k]), "gi"), next[k].toLowerCase()],
      [new RegExp(`\\b${or}(\\s*,\\s*)${og}(\\s*,\\s*)${ob}\\b(?=\\s*[,)])`, "g"), `${nr}$1${ng}$2${nb}`],
      [new RegExp(`\\[${or},\\s*${og},\\s*${ob}\\]`, "g"), `[${nr}, ${ng}, ${nb}]`],
    ];
    for (const [re, to] of rules) src = src.replace(re, (...m) => (count++, to.replace(/\$(\d)/g, (_, i) => m[+i])));
  }
  if (count) {
    console.log(`${check ? "would update" : "updated"} ${file} (${count} values)`);
    if (!check) writeFileSync(path, src);
  }
  total += count;
}
console.log(`${changes.map((k) => `${k}: ${prev[k]} → ${next[k]}`).join("\n")}`);
if (!check) writeFileSync(join(root, "design/.tokens-applied.json"), JSON.stringify(next, null, 2) + "\n");
if (!total) console.log("No occurrences found. Was the code edited by hand?");
