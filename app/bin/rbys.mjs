#!/usr/bin/env node
// Launcher for the `rbys` command: runs src/cli.ts through tsx, so there's no
// build step. Install globally with `npm link` (from app/).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const tsx = import.meta.resolve("tsx");
const r = spawnSync(process.execPath, ["--import", tsx, cli, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
