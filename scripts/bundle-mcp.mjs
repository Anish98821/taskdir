// Bundles the three npm bin entrypoints into self-contained ESM files
// under dist/bin/. Each bin imports shared logic from bin/cli.ts which
// in turn imports from src/lib/* using .ts extensions — esbuild resolves
// all of it; tsc can't (rootDir mismatch + allowImportingTsExtensions).
//
// Native deps stay external so they resolve against the consumer's
// node_modules at runtime.
import { build } from "esbuild";
import { chmod, mkdir, writeFile } from "node:fs/promises";

const ENTRIES = [
  { in: "bin/taskdir-init.ts", out: "dist/bin/taskdir-init.js" },
  { in: "bin/taskdir-mcp.ts", out: "dist/bin/taskdir-mcp.js" },
  { in: "bin/taskdir-web.ts", out: "dist/bin/taskdir-web.js" },
];

await mkdir("dist/bin", { recursive: true });

// Tell node to treat the bundled output as ESM so it doesn't emit the
// MODULE_TYPELESS_PACKAGE_JSON warning at startup.
await writeFile("dist/bin/package.json", JSON.stringify({ type: "module" }) + "\n");

for (const entry of ENTRIES) {
  await build({
    entryPoints: [entry.in],
    outfile: entry.out,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    external: ["fsevents", "chokidar"],
    logLevel: "info",
  });
  // Make the bundled output executable on POSIX. Harmless on Windows.
  try {
    await chmod(entry.out, 0o755);
  } catch {
    /* ignore */
  }
}
