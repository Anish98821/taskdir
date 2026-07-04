import {
  handleRpc,
  PROTOCOL_VERSION,
  SERVER_INFO,
  type JsonRpcRequest,
} from "../../lib/mcp-handler.ts";

export async function handleMcpPost(request: Request): Promise<Response> {
  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } },
      { status: 200 },
    );
  }
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: body?.id ?? null,
        error: { code: -32600, message: "invalid request" },
      },
      { status: 200 },
    );
  }
  const response = await handleRpc(body);
  if (response === null) return new Response(null, { status: 204 });
  return Response.json(response);
}

export function handleMcpGet(): Response {
  return Response.json({ name: SERVER_INFO.name, protocolVersion: PROTOCOL_VERSION });
}
