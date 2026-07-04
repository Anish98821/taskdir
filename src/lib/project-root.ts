// Resolves the user's project root. Next.js standalone server calls
// process.chdir(__dirname) at startup, so the launcher passes the real
// project directory via TASKDIR_PROJECT_ROOT.
export function projectRoot(): string {
  return process.env.TASKDIR_PROJECT_ROOT || process.cwd();
}
