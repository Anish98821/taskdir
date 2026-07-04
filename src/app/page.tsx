import {
  TasksPage,
  type TasksPageSearchParams,
} from "@/features/tasks";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<TasksPageSearchParams>;
}) {
  return <TasksPage searchParams={searchParams} />;
}
