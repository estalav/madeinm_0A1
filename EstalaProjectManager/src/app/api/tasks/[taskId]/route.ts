import { NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedJson } from "@/server/auth";
import { deleteTask, updateTask } from "@/server/workspace-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

  const { taskId } = await context.params;

  let payload: {
    title?: string;
    owner?: string;
    due?: string;
    status?: "backlog" | "active" | "review" | "done";
    priority?: "low" | "medium" | "high";
    lane?: string;
    summary?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const updated = await updateTask(taskId, payload);

  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "Task not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    project: updated.project,
    task: updated.task,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

  const { taskId } = await context.params;
  const deleted = await deleteTask(taskId);

  if (!deleted) {
    return NextResponse.json(
      { ok: false, message: "Task not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    project: deleted.project,
    deletedTaskId: deleted.deletedTaskId,
  });
}
