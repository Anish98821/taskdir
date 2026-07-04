#!/usr/bin/env node
import { runInit } from "./cli.ts";

runInit(process.argv.slice(2)).catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
