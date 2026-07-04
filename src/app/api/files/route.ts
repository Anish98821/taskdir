import { searchFiles } from "../../../features/tasks/services/taskFileSearch.ts";
import { projectRoot } from "../../../lib/project-root.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const files = await searchFiles(projectRoot(), url.searchParams.get("q") ?? "");
  return Response.json({ files });
}
