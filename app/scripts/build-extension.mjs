#!/usr/bin/env node
/**
 * Builds the browser extension:
 *   extension/src/background.ts  →  extension/dist/background.js  (analyzer bundled in)
 *   self-hosted fonts            →  extension/fonts/
 *
 *   cd app && npm run build:ext
 * Then load the `extension` folder in chrome://extensions (Developer mode → Load unpacked).
 */
import { build } from "esbuild";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = join(app, "..", "extension");
const shim = join(app, "scripts", ".buffer-shim.js");
writeFileSync(shim, 'import { Buffer } from "buffer";\nglobalThis.Buffer = globalThis.Buffer || Buffer;\n');

await build({
  entryPoints: [join(ext, "src", "background.ts")],
  outfile: join(ext, "dist", "background.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "chrome116",
  minify: true,
  legalComments: "linked",
  inject: [shim],
  nodePaths: [join(app, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"', global: "globalThis" },
  logLevel: "info",
});

const fonts = [
  ["roboto", "roboto-latin-400-normal.woff2"],
  ["roboto", "roboto-latin-500-normal.woff2"],
  ["roboto", "roboto-latin-700-normal.woff2"],
  ["league-spartan", "league-spartan-latin-600-normal.woff2"],
  ["league-spartan", "league-spartan-latin-700-normal.woff2"],
  ["league-spartan", "league-spartan-latin-800-normal.woff2"],
  ["roboto-mono", "roboto-mono-latin-400-normal.woff2"],
];
mkdirSync(join(ext, "fonts"), { recursive: true });
for (const [pkg, file] of fonts) copyFileSync(join(app, "node_modules", "@fontsource", pkg, "files", file), join(ext, "fonts", file));
console.log(`copied ${fonts.length} fonts`);
