"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeFilename, parseCreateTaskForm } from "@/features/tasks/mappers/taskActionInput";
import {
  readAgentsConfig,
  removeAgent as removeAgentStore,
  upsertAgent as upsertAgentStore,
  type Agent,
  type AgentsConfig,
} from "@/lib/agents";
import {
  writeProjectConfig as writeProjectConfigStore,
  type ProjectConfig,
} from "@/lib/project-config";
import {
  writeHooksConfig as writeHooksConfigStore,
  type HooksConfig,
} from "@/lib/hooks";
import {
  writeModesConfig as writeModesConfigStore,
  writeStrategy as writeStrategyStore,
  type ModesConfig,
} from "@/lib/modes";
import {
  writeStatusesConfig as writeStatusesConfigStore,
  type StatusesConfig,
} from "@/lib/statuses";
import {
  createFile,
  createTask,
  deleteFile,
  deleteTask,
  renameFile,
  updateMeta,
  updateStatus,
  writeFileChecked,
  type MetaPatch,
  type Status,
  type WriteResult,
} from "@/lib/tasks";

export async function setStatus(id: string, status: Status): Promise<void> {
  await updateStatus(id, status);
  refresh();
}

export async function setMeta(id: string, patch: MetaPatch): Promise<void> {
  await updateMeta(id, patch);
  refresh();
}

export async function saveFile(
  id: string,
  filename: string,
  content: string,
  baselineMtimeMs: number | null,
): Promise<WriteResult> {
  return writeFileChecked(id, filename, content, baselineMtimeMs);
}

export async function createFileAction(id: string, filename: string): Promise<void> {
  await createFile(id, normalizeFilename(filename));
  refresh();
}

export async function renameFileAction(
  id: string,
  oldName: string,
  newName: string,
): Promise<void> {
  await renameFile(id, oldName, normalizeFilename(newName));
  refresh();
}

export async function deleteFileAction(id: string, filename: string): Promise<void> {
  await deleteFile(id, filename);
  refresh();
}

export async function deleteTaskAction(id: string): Promise<void> {
  await deleteTask(id);
  redirect("/");
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const input = parseCreateTaskForm(formData);
  if (!input) return;
  const task = await createTask(input);
  redirect(`/?task=${task.id}`);
}

export async function saveAgent(agent: Agent): Promise<AgentsConfig> {
  if (!agent.id.trim()) return readAgentsConfig();
  const saved = await upsertAgentStore(agent);
  refresh();
  return saved;
}

export async function deleteAgent(id: string): Promise<AgentsConfig> {
  const saved = await removeAgentStore(id);
  refresh();
  return saved;
}

export async function saveProjectConfig(
  patch: Partial<ProjectConfig>,
): Promise<ProjectConfig> {
  const saved = await writeProjectConfigStore(patch);
  refresh();
  return saved;
}

export async function saveHooksConfig(
  config: HooksConfig,
): Promise<HooksConfig> {
  const saved = await writeHooksConfigStore(config);
  refresh();
  return saved;
}

export async function saveModesConfig(
  config: ModesConfig,
): Promise<ModesConfig> {
  const saved = await writeModesConfigStore(config);
  refresh();
  return saved;
}

export async function saveStatusesConfig(
  config: StatusesConfig,
): Promise<StatusesConfig> {
  const saved = await writeStatusesConfigStore(config);
  refresh();
  return saved;
}

export async function saveStrategy(
  modeId: string,
  content: string,
): Promise<void> {
  await writeStrategyStore(modeId, content);
  refresh();
}
