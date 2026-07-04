"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteTaskAction } from "@/app/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";

interface Props {
  taskId: string;
  taskTitle: string;
}

export function DeleteTaskButton({ taskId, taskTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      await deleteTaskAction(taskId);
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !pending && setOpen(true)}
        aria-label="delete task"
        disabled={pending}
        className="text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        {pending ? <InProgressDots /> : <Trash2 className="size-4" />}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={`delete task ${taskId}?`}
        description="this action cannot be undone."
        confirmLabel="delete"
        destructive
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
