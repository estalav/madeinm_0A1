import { NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedJson } from "@/server/auth";
import { createProject, listProjects } from "@/server/workspace-store";
import { isSupabaseConfigured } from "@/server/supabase";

export async function GET(request: Request) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

  const projects = await listProjects();

  return NextResponse.json({
    ok: true,
    storage: isSupabaseConfigured() ? "supabase" : "local",
    projects,
  });
}

export async function POST(request: Request) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

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

  if (
    !payload.name ||
    !payload.client ||
    !payload.phase ||
    !payload.health ||
    !payload.focus
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "name, client, phase, health, and focus are required.",
      },
      { status: 400 },
    );
  }

  const project = await createProject({
    name: payload.name,
    client: payload.client,
    phase: payload.phase,
    health: payload.health,
    focus: payload.focus,
  });

  if (!project) {
    return NextResponse.json(
      { ok: false, message: "Failed to create project." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    project,
  });
}
