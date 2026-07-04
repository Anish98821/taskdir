// Assembles the Next.js standalone bundle into dist/web/.
// Assumes `next build` has already been run with `output: 'standalone'`.
//
// pnpm's symlinked node_modules layout doesn't survive a dereferenced
// copy on Windows (transitive deps like @swc/helpers stop being resolvable
// because they were colocated inside .pnpm/next.../node_modules/, not
// hoisted). So we discard the bundled node_modules entirely and run a
// flat `npm install` inside dist/web/, then layer in the prebuilt
// .next/server output and static assets on top.
import { cp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const standalone = `${root}/.next/standalone`;
const staticDir = `${root}/.next/static`;
const publicDir = `${root}/public`;
const out = `${root}/dist/web`;

if (!existsSync(standalone)) {
  console.error(
    "build-web: .next/standalone not found — run `next build` first " +
      "(next.config must have `output: 'standalone'`).",
  );
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// Copy the standalone server entry; skip its bundled node_modules — we
// install a clean flat one below.
const cpOpts = { recursive: true, dereference: true };
await cp(`${standalone}/server.js`, `${out}/server.js`, cpOpts);

// Copy the prebuilt .next output (server chunks, manifests, BUILD_ID,
// required-server-files.json) but not the standalone dir or the build
// cache.
await mkdir(`${out}/.next`, { recursive: true });
const nextEntries = await (await import("node:fs/promises")).readdir(`${root}/.next`);
// Skip: `standalone` (unpacked separately above), `cache` (webpack incremental
// build cache), `dev` (only exists if `next dev` was run — 300+ MB of nothing
// prod needs), `diagnostics` / `trace` (developer telemetry).
const skip = new Set(["standalone", "cache", "dev", "diagnostics", "trace", "trace-build"]);
for (const name of nextEntries) {
  if (skip.has(name)) continue;
  await cp(`${root}/.next/${name}`, `${out}/.next/${name}`, cpOpts);
}

if (existsSync(publicDir)) {
  await cp(publicDir, `${out}/public`, cpOpts);
}

// Write a minimal package.json containing only the deps that survive into
// the running standalone server: Next itself, React, and packages marked
// as `serverExternalPackages`. Everything else (codemirror, shadcn, etc.)
// is client/UI code that Next inlined into .next/static and .next/server
// during the build, so it doesn't need a real node_modules entry.
const rootPkg = JSON.parse(await readFile(`${root}/package.json`, "utf8"));
const runtimeNames = ["next", "react", "react-dom", "chokidar"];
const minimalDeps = {};
for (const name of runtimeNames) {
  const v = rootPkg.dependencies?.[name];
  if (v) minimalDeps[name] = v;
}
const minimalPkg = {
  name: "taskdir-web-bundle",
  private: true,
  version: rootPkg.version,
  type: "commonjs",
  dependencies: minimalDeps,
};
await writeFile(`${out}/package.json`, JSON.stringify(minimalPkg, null, 2) + "\n");

// The npm tarball path leaves node_modules out (lazy install on first
// `taskdir web`), but the .exe build needs deps pre-installed so they
// can be zipped into the SEA asset. Opt in via WITH_DEPS=1.
if (process.env.WITH_DEPS === "1") {
  console.log("build-web: installing runtime deps into dist/web (flat)...");
  const install = spawnSync(
    "npm",
    ["install", "--omit=dev", "--no-package-lock", "--no-audit", "--no-fund"],
    { cwd: out, stdio: "inherit", shell: true },
  );
  if (install.status !== 0) {
    console.error(
      `build-web: npm install failed (exit ${install.status}, signal ${install.signal})`,
    );
    if (install.error) console.error(install.error);
    process.exit(install.status ?? 1);
  }
}

console.log(`build-web: wrote ${out}`);
if (process.env.WITH_DEPS !== "1") {
  console.log(
    "build-web: node_modules will be installed on first `taskdir web` invocation.",
  );
}
