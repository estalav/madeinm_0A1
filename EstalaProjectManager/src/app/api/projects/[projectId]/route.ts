import { NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedJson } from "@/server/auth";
import { deleteProject, listProjects, updateProject } from "@/server/workspace-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

  const { projectId } = await context.params;

  let payload: {
    name?: string;
    client?: string;
    phase?: string;
    health?: "On track" | "Needs review";
    focus?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const project = await updateProject(projectId, payload);

  if (!project) {
    return NextResponse.json(
      { ok: false, message: "Project not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    project,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

  const { projectId } = await context.params;
  const deleted = await deleteProject(projectId);

  if (!deleted) {
    return NextResponse.json(
      { ok: false, message: "Project not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    deletedProjectId: projectId,
    projects: await listProjects(),
  });
}
