export const PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "meta",
  "mistral",
  "xai",
  "cohere",
  "deepseek",
  "custom",
] as const;
export type Provider = (typeof PROVIDERS)[number];

export interface Agent {
  id: string;
  name: string;
  provider: Provider;
}

export interface AgentsConfig {
  agents: Agent[];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_ ]+/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export function generateAgentId(name: string, existing: string[]): string {
  const base = slugify(name) || `agt-${randomSuffix()}`;
  if (!existing.includes(base)) return base;
  for (let i = 2; i < 100; i++) {
    const next = `${base}-${i}`;
    if (!existing.includes(next)) return next;
  }
  return `${base}-${randomSuffix()}`;
}

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}
