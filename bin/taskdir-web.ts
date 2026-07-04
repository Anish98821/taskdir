#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runWeb } from "./cli.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, "..", "web");

runWeb(process.argv.slice(2), { webDir }).catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
