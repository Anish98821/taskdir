// Build a single self-contained `taskdir.exe` via Node SEA (Node 22+).
//
// The .exe embeds:
//   - the dispatcher (bin/taskdir.ts, bundled to CJS by esbuild)
//   - the Next.js standalone web bundle (dist/web/ with pre-installed
//     node_modules, zipped) as a SEA asset under the key "web.zip"
//   - adm-zip for runtime extraction
//
// Subcommands:
//   taskdir init   self-contained, no external deps required
//   taskdir mcp    self-contained, no external deps required
//   taskdir web    extracts web.zip to %LOCALAPPDATA%\taskdir\web\<version>\
//                  on first launch, then spawns itself with
//                  --internal-launch-next to act as Node for server.js
//
// Pipeline:
//   1. Bundle bin/taskdir.ts → dist/exe/taskdir.cjs
//   2. (Re)build the web bundle with deps pre-installed: WITH_DEPS=1 build:web
//   3. Zip dist/web/ → dist/exe/web.zip
//   4. Write sea-config.json with the zip as an asset
//   5. Generate SEA blob
//   6. Copy node binary → dist/taskdir.exe; postject the blob

import AdmZip from "adm-zip";
import { build } from "esbuild";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { platform } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(REPO_ROOT, "dist");
const EXE_DIR = path.join(DIST, "exe");
const WEB_DIR = path.join(DIST, "web");
const BUNDLE_PATH = path.join(EXE_DIR, "taskdir.cjs");
const WEB_ZIP_PATH = path.join(EXE_DIR, "web.zip");
const SEA_CONFIG_PATH = path.join(EXE_DIR, "sea-config.json");
const SEA_BLOB_PATH = path.join(EXE_DIR, "taskdir.blob");
const EXE_PATH = path.join(DIST, platform() === "win32" ? "taskdir.exe" : "taskdir");
const NODE_BIN = process.execPath;
const SENTINEL = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

const SKIP_WEB = process.env.SKIP_WEB === "1";

function exists(p) {
  try {
    return statSync(p).isDirectory() || statSync(p).isFile();
  } catch {
    return false;
  }
}

async function bundleDispatcher() {
  await mkdir(EXE_DIR, { recursive: true });
  await build({
    entryPoints: [path.join(REPO_ROOT, "bin", "taskdir.ts")],
    outfile: BUNDLE_PATH,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    // node:sea is the runtime API for SEA — leave it external so esbuild
    // doesn't try to resolve it at build time (it only exists at runtime).
    external: ["node:sea"],
    logLevel: "info",
  });
}

function rebuildWebWithDeps() {
  if (SKIP_WEB && exists(WEB_DIR)) {
    console.log("> SKIP_WEB=1 — reusing existing dist/web/");
    return;
  }
  console.log("> rebuilding web bundle with deps pre-installed...");
  const res = spawnSync("npm", ["run", "build:web"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, WITH_DEPS: "1" },
  });
  if (res.status !== 0) {
    throw new Error(`build:web failed (exit ${res.status})`);
  }
}

async function zipWebBundle() {
  console.log("> zipping dist/web/ ...");
  await rm(WEB_ZIP_PATH, { force: true });
  const zip = new AdmZip();
  zip.addLocalFolder(WEB_DIR);
  await new Promise((resolve, reject) => {
    zip.writeZip(WEB_ZIP_PATH, (err) => (err ? reject(err) : resolve()));
  });
  const size = statSync(WEB_ZIP_PATH).size;
  console.log(`  → ${WEB_ZIP_PATH} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

async function writeSeaConfig() {
  await writeFile(
    SEA_CONFIG_PATH,
    JSON.stringify(
      {
        main: BUNDLE_PATH,
        output: SEA_BLOB_PATH,
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: true,
        assets: {
          "web.zip": WEB_ZIP_PATH,
        },
      },
      null,
      2,
    ),
  );
}

function generateBlob() {
  console.log("> generating SEA blob ...");
  execFileSync(NODE_BIN, ["--experimental-sea-config", SEA_CONFIG_PATH], {
    stdio: "inherit",
  });
}

async function copyNodeBinary() {
  await mkdir(path.dirname(EXE_PATH), { recursive: true });
  await rm(EXE_PATH, { force: true });
  await copyFile(NODE_BIN, EXE_PATH);
}

async function injectBlob() {
  console.log("> postjecting blob into binary ...");
  const { inject } = await import("postject");
  const blob = await readFile(SEA_BLOB_PATH);
  await inject(EXE_PATH, "NODE_SEA_BLOB", blob, {
    sentinelFuse: SENTINEL,
    machoSegmentName: platform() === "darwin" ? "NODE_SEA" : undefined,
    overwrite: true,
  });
}

async function main() {
  console.log("> bundling bin/taskdir.ts ...");
  await bundleDispatcher();

  rebuildWebWithDeps();
  await zipWebBundle();

  console.log("> writing sea-config.json ...");
  await writeSeaConfig();

  generateBlob();

  console.log("> copying node binary to", EXE_PATH);
  await copyNodeBinary();

  await injectBlob();

  const size = statSync(EXE_PATH).size;
  console.log(`done: ${EXE_PATH} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((e) => {
  console.error("build-exe failed:", e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
