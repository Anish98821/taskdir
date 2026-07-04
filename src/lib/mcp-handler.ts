import {
  err,
  ok,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./mcp/protocol.ts";
import { callTool, TOOLS } from "./mcp/tools.ts";

export { type JsonRpcRequest, type JsonRpcResponse } from "./mcp/protocol.ts";

export const PROTOCOL_VERSION = "2024-11-05";
export const SERVER_INFO = { name: "taskdir", version: "0.1.0" };

export async function handleRpc(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const id = req.id;
  try {
    switch (req.method) {
      case "initialize":
        return ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: SERVER_INFO,
          capabilities: { tools: {} },
        });
      case "initialized":
      case "notifications/initialized":
        return null;
      case "tools/list":
        return ok(id, { tools: TOOLS });
      case "tools/call": {
        const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        if (!params.name) return err(id, -32602, "missing tool name");
        const result = await callTool(params.name, params.arguments ?? {});
        return ok(id, result);
      }
      case "ping":
        return ok(id, {});
      default:
        return err(id, -32601, `method not found: ${req.method}`);
    }
  } catch (e) {
    return err(id, -32000, e instanceof Error ? e.message : String(e));
  }
}
