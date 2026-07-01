import { NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedJson } from "@/server/auth";
import { createTask } from "@/server/workspace-store";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

  const { projectId } = await context.params;

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

  if (!payload.title || !payload.owner || !payload.summary || !payload.due) {
    return NextResponse.json(
      {
        ok: false,
        message: "title, owner, due, and summary are required.",
      },
      { status: 400 },
    );
  }

  const created = await createTask(projectId, {
    title: payload.title,
    owner: payload.owner,
    due: payload.due,
    status: payload.status ?? "backlog",
    priority: payload.priority ?? "medium",
    lane: payload.lane ?? "General",
    summary: payload.summary,
  });

  if (!created) {
    return NextResponse.json(
      { ok: false, message: "Project not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    project: created.project,
    task: created.task,
  });
}
