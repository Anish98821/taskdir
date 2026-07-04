#!/usr/bin/env node
import { runMcp } from "./cli.ts";

runMcp().catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
