import {
  generateAgentId,
  readAgentsConfig,
  removeAgent,
  upsertAgent,
  PROVIDERS,
  type Agent,
  type Provider,
} from "../agents.ts";
import {
  appendToFile,
  createFile,
  createTask,
  deleteFile,
  getTask,
  listTasks,
  PRIORITIES,
  renameFile,
  STATUSES,
  updateMeta,
  updateStatus,
  type Mode,
  type Priority,
  type Status,
} from "../tasks-core.ts";
import { readModesConfig, readStrategy } from "../modes.ts";

function text(s: string) {
  return { content: [{ type: "text", text: s }] };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

export const TOOLS = [
  {
    name: "list_tasks",
    description: "List tasks, optionally filtered by status, tag, or priority.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: `a status id from .taskdir/statuses.toml (defaults: ${STATUSES.join(", ")})`,
        },
        tag: { type: "string" },
        priority: { type: "string", enum: PRIORITIES },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_task",
    description: "Return all markdown files for a task, concatenated. If the task's mode has a strategy defined, it is appended — follow it when working the task.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_task",
    description: "Create a new task with title and optional context/priority/mode/tags/generate_report/agent. mode defaults to plan_and_execute. generate_report defaults to true. context is written to context.md only if non-empty.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        context: { type: "string" },
        priority: { type: "string", enum: PRIORITIES },
        mode: { type: "string", description: "project-defined mode id (see list_modes)" },
        tags: { type: "array", items: { type: "string" } },
        generate_report: { type: "boolean" },
        agent: { type: "string" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_status",
    description: `Set a task's status to an id configured in .taskdir/statuses.toml (defaults: ${STATUSES.join(", ")}).`,
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
      },
      required: ["id", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "update_meta",
    description: "Update a task's meta.toml (title, priority, mode, tags, generate_report, agent). Any omitted field is left unchanged.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        priority: { type: "string", enum: PRIORITIES },
        mode: { type: "string", description: "project-defined mode id (see list_modes)" },
        tags: { type: "array", items: { type: "string" } },
        generate_report: { type: "boolean" },
        agent: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "append_to_file",
    description: "Append content to a markdown file within a task folder.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        filename: { type: "string" },
        content: { type: "string" },
      },
      required: ["id", "filename", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "create_file",
    description: "Create a new empty markdown file in a task folder.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        filename: { type: "string" },
      },
      required: ["id", "filename"],
      additionalProperties: false,
    },
  },
  {
    name: "rename_file",
    description: "Rename a markdown file within a task folder.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        old_name: { type: "string" },
        new_name: { type: "string" },
      },
      required: ["id", "old_name", "new_name"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_file",
    description: "Delete a markdown file from a task folder.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        filename: { type: "string" },
      },
      required: ["id", "filename"],
      additionalProperties: false,
    },
  },
  {
    name: "list_modes",
    description: "List the project's task modes (id, label, icon). Modes are user-defined; use a mode's id when creating or updating a task. Each mode may have a strategy that get_task surfaces.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_agents",
    description: "List agents already registered in the project (id, name, provider). Call this before register_agent so you can reuse an existing generic agent of your provider instead of creating a duplicate.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "register_agent",
    description: "Register an agent in the project registry. Provide a human-friendly name and a provider (anthropic, openai, google, meta, mistral, xai, cohere, deepseek, custom). The provider drives the icon. id is auto-generated from the name if omitted; if provided, the existing record is updated (idempotent upsert by id). Before calling this, use list_agents and reuse an existing generic same-provider agent rather than registering a new one, unless the user wants a distinct identity.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        provider: { type: "string", enum: PROVIDERS },
        id: { type: "string" },
      },
      required: ["name", "provider"],
      additionalProperties: false,
    },
  },
  {
    name: "unregister_agent",
    description: "Remove an agent from the project registry by id. Only remove your own agent unless the user explicitly asks you to clean up another. Returns the remaining agents.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
] as const;

export async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "list_modes": {
      const config = await readModesConfig();
      return text(JSON.stringify(config, null, 2));
    }
    case "list_agents": {
      const config = await readAgentsConfig();
      return text(JSON.stringify(config, null, 2));
    }
    case "list_tasks": {
      const tasks = await listTasks({
        status: str(args.status) as Status | undefined,
        tag: str(args.tag),
        priority: str(args.priority) as Priority | undefined,
      });
      return text(JSON.stringify(tasks, null, 2));
    }
    case "get_task": {
      const id = str(args.id);
      if (!id) throw new Error("id required");
      const task = await getTask(id);
      if (!task) throw new Error(`task not found: ${id}`);
      const concat = task.files
        .map((f) => `## ${f.name}\n\n${f.content}`)
        .join("\n\n");
      const route = task.meta.agent ? `agent: ${task.meta.agent}` : "";
      const header = `# ${task.meta.title}\n\nid: ${task.id}\nstatus: ${task.status}\npriority: ${task.meta.priority}\nmode: ${task.meta.mode}\ntags: ${task.meta.tags.join(", ")}${route ? `\n${route}` : ""}\n\n`;
      const strategy = (await readStrategy(task.meta.mode)).trim();
      const strategyBlock = strategy
        ? `\n\n---\n\n## strategy for mode: ${task.meta.mode}\n\n${strategy}\n`
        : "";
      return text(header + concat + strategyBlock);
    }
    case "create_task": {
      const title = str(args.title);
      if (!title) throw new Error("title required");
      const tags = Array.isArray(args.tags)
        ? args.tags.filter((t): t is string => typeof t === "string")
        : undefined;
      const created = await createTask({
        title,
        context: str(args.context),
        priority: str(args.priority) as Priority | undefined,
        mode: str(args.mode) as Mode | undefined,
        tags,
        generate_report: bool(args.generate_report),
        agent: str(args.agent) ?? str(args.runtime),
      });
      return text(`created task ${created.id}`);
    }
    case "update_status": {
      const id = str(args.id);
      const status = str(args.status) as Status | undefined;
      if (!id || !status) throw new Error("id and status required");
      await updateStatus(id, status);
      return text("ok");
    }
    case "update_meta": {
      const id = str(args.id);
      if (!id) throw new Error("id required");
      const tags = Array.isArray(args.tags)
        ? args.tags.filter((t): t is string => typeof t === "string")
        : undefined;
      const agentFromArgs = Object.hasOwn(args, "agent")
        ? (str(args.agent) ?? null)
        : Object.hasOwn(args, "runtime")
          ? (str(args.runtime) ?? null)
          : undefined;
      const next = await updateMeta(id, {
        title: str(args.title),
        priority: str(args.priority) as Priority | undefined,
        mode: str(args.mode) as Mode | undefined,
        tags,
        generate_report: bool(args.generate_report),
        agent: agentFromArgs,
      });
      return text(JSON.stringify(next, null, 2));
    }
    case "append_to_file": {
      const id = str(args.id);
      const filename = str(args.filename);
      const content = str(args.content);
      if (!id || !filename || content === undefined) {
        throw new Error("id, filename, content required");
      }
      await appendToFile(id, filename, content);
      return text("ok");
    }
    case "create_file": {
      const id = str(args.id);
      const filename = str(args.filename);
      if (!id || !filename) throw new Error("id and filename required");
      await createFile(id, filename);
      return text("ok");
    }
    case "rename_file": {
      const id = str(args.id);
      const oldName = str(args.old_name);
      const newName = str(args.new_name);
      if (!id || !oldName || !newName) throw new Error("id, old_name, new_name required");
      await renameFile(id, oldName, newName);
      return text("ok");
    }
    case "delete_file": {
      const id = str(args.id);
      const filename = str(args.filename);
      if (!id || !filename) throw new Error("id and filename required");
      await deleteFile(id, filename);
      return text("ok");
    }
    case "register_agent": {
      const name = str(args.name)?.trim();
      const providerRaw = str(args.provider);
      if (!name) throw new Error("name required");
      if (!providerRaw || !(PROVIDERS as readonly string[]).includes(providerRaw)) {
        throw new Error(
          `provider required (one of: ${PROVIDERS.join(", ")})`,
        );
      }
      const provider = providerRaw as Provider;
      const explicitId = str(args.id)?.trim();
      let id = explicitId;
      if (!id) {
        const current = await readAgentsConfig();
        id = generateAgentId(
          name,
          current.agents.map((a) => a.id),
        );
      }
      const agent: Agent = { id, name, provider };
      const result = await upsertAgent(agent);
      return text(JSON.stringify(result, null, 2));
    }
    case "unregister_agent": {
      const id = str(args.id)?.trim();
      if (!id) throw new Error("id required");
      const before = await readAgentsConfig();
      if (!before.agents.some((a) => a.id === id)) {
        throw new Error(`agent not found: ${id}`);
      }
      const result = await removeAgent(id);
      return text(JSON.stringify(result, null, 2));
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}
