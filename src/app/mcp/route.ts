import "server-only";
import { handleMcpGet, handleMcpPost } from "./http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleMcpPost(request);
}

export async function GET(): Promise<Response> {
  return handleMcpGet();
}
