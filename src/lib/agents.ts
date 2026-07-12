import { existsSync, promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import {
  generateAgentId,
  isProvider,
  PROVIDERS,
  type Agent,
  type AgentsConfig,
  type Provider,
} from "./agent-types.ts";
import { fireHooks } from "./hooks.ts";
import { projectRoot } from "./project-root.ts";

export {
  generateAgentId,
  isProvider,
  PROVIDERS,
  type Agent,
  type AgentsConfig,
  type Provider,
};

function taskdirDir(): string {
  return path.join(projectRoot(), ".taskdir");
}

function agentsDir(): string {
  return path.join(taskdirDir(), "agents");
}

function agentsPath(): string {
  return path.join(agentsDir(), "agents.toml");
}

function legacyAgentsPath(): string {
  return path.join(agentsDir(), "runtimes.toml");
}

function veryLegacyAgentsPath(): string {
  return path.join(taskdirDir(), "runtimes.toml");
}

function escapeString(s: string): string {
  return s.replace(/"/g, "'");
}

function parseList(value: string): string[] {
  if (!value.startsWith("[") || !value.endsWith("]")) return [];
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter((s) => s.length > 0);
}

function parseStringValue(value: string): string | null {
  if (value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1);
  }
  return null;
}

function inferProvider(id: string, name: string, oldLabel?: string): Provider {
  const hay = `${id} ${name} ${oldLabel ?? ""}`.toLowerCase();
  if (hay.includes("claude") || hay.includes("anthropic")) return "anthropic";
  if (hay.includes("codex") || hay.includes("openai") || hay.includes("gpt"))
    return "openai";
  if (hay.includes("gemini") || hay.includes("google")) return "google";
  if (hay.includes("llama") || hay.includes("meta")) return "meta";
  if (hay.includes("mistral")) return "mistral";
  if (hay.includes("grok") || hay.includes("xai") || hay.includes("x.ai"))
    return "xai";
  if (hay.includes("cohere")) return "cohere";
  if (hay.includes("deepseek")) return "deepseek";
  return "custom";
}

function parseAgentsToml(src: string): AgentsConfig {
  const agents: Agent[] = [];
  let current: {
    id?: string;
    name?: string;
    provider?: string;
    label?: string;
  } | null = null;
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[[agent]]" || line === "[[runtime]]") {
      if (current?.id) agents.push(toAgent(current));
      current = {};
      continue;
    }
    if (!current) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = parseStringValue(line.slice(eq + 1).trim());
    if (value === null) continue;
    if (key === "id") current.id = value;
    else if (key === "name") current.name = value;
    else if (key === "label") current.label = value;
    else if (key === "provider") current.provider = value;
  }
  if (current?.id) agents.push(toAgent(current));
  return { agents };
}

function toAgent(partial: {
  id?: string;
  name?: string;
  provider?: string;
  label?: string;
}): Agent {
  const id = partial.id!;
  const name = (partial.name ?? partial.label ?? id).trim() || id;
  const providerCandidate = (partial.provider ?? "").trim();
  const provider = isProvider(providerCandidate)
    ? providerCandidate
    : inferProvider(id, name, partial.label);
  return { id, name, provider };
}

function stringifyAgentsToml(config: AgentsConfig): string {
  const blocks = config.agents.map((a) =>
    [
      `[[agent]]`,
      `id = "${escapeString(a.id)}"`,
      `name = "${escapeString(a.name)}"`,
      `provider = "${a.provider}"`,
    ].join("\n"),
  );
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}

function normalize(agents: Agent[]): Agent[] {
  const seen = new Set<string>();
  const out: Agent[] = [];
  for (const a of agents) {
    const id = a.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: a.name.trim() || id,
      provider: isProvider(a.provider) ? a.provider : "custom",
    });
  }
  return out;
}

function migrateLegacyFlatList(rawPath: string): AgentsConfig | null {
  if (!existsSync(rawPath)) return null;
  let raw = "";
  try {
    raw = readFileSync(rawPath, "utf8");
  } catch {
    return null;
  }
  const agents: Agent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    if (key !== "runtimes") continue;
    const value = t.slice(eq + 1).trim();
    for (const id of parseList(value)) {
      agents.push({ id, name: id, provider: inferProvider(id, id) });
    }
  }
  return { agents };
}

async function ensureAgentsDir(): Promise<void> {
  await fs.mkdir(agentsDir(), { recursive: true });
}

export async function readAgentsConfig(): Promise<AgentsConfig> {
  try {
    const raw = await fs.readFile(agentsPath(), "utf8");
    return parseAgentsToml(raw);
  } catch {
    // new path missing — try progressively older locations
  }
  if (existsSync(legacyAgentsPath())) {
    try {
      const raw = await fs.readFile(legacyAgentsPath(), "utf8");
      const parsed = parseAgentsToml(raw);
      await writeAgentsConfig(parsed);
      await fs.rm(legacyAgentsPath()).catch(() => {});
      return parsed;
    } catch {
      // fall through
    }
  }
  const flat = migrateLegacyFlatList(veryLegacyAgentsPath());
  if (flat) {
    await writeAgentsConfig(flat);
    await fs.rm(veryLegacyAgentsPath()).catch(() => {});
    return flat;
  }
  return { agents: [] };
}

export async function writeAgentsConfig(
  config: AgentsConfig,
): Promise<AgentsConfig> {
  const normalized: AgentsConfig = { agents: normalize(config.agents) };
  await ensureAgentsDir();
  await fs.writeFile(agentsPath(), stringifyAgentsToml(normalized), "utf8");
  return normalized;
}

export async function upsertAgent(agent: Agent): Promise<AgentsConfig> {
  const current = await readAgentsConfig();
  const without = current.agents.filter((a) => a.id !== agent.id);
  const result = await writeAgentsConfig({ agents: [...without, agent] });
  void fireHooks("agent.registered", {
    id: agent.id,
    name: agent.name,
    provider: agent.provider,
  });
  return result;
}

export async function removeAgent(id: string): Promise<AgentsConfig> {
  const current = await readAgentsConfig();
  const existed = current.agents.some((a) => a.id === id);
  const result = await writeAgentsConfig({
    agents: current.agents.filter((a) => a.id !== id),
  });
  if (existed) void fireHooks("agent.unregistered", { id });
  return result;
}
