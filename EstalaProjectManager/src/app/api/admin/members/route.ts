import { NextResponse } from "next/server";
import {
  createWorkspaceMember,
  listWorkspaceMembers,
} from "@/server/member-store";
import { isAuthenticatedRequest, unauthorizedJson } from "@/server/auth";
import { isSupabaseConfigured } from "@/server/supabase";
import { type WorkspaceMemberRole } from "@/lib/workspace-members";

export async function GET(request: Request) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

  try {
    const members = await listWorkspaceMembers();

    return NextResponse.json({
      ok: true,
      storage: isSupabaseConfigured() ? "supabase" : "local",
      members,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to load workspace members.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

  let payload: { email?: string; role?: WorkspaceMemberRole };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const email = payload.email?.trim();
  const role = payload.role;

  if (!email || !role) {
    return NextResponse.json(
      { ok: false, message: "Email and role are required." },
      { status: 400 },
    );
  }

  try {
    const member = await createWorkspaceMember({ email, role });
    return NextResponse.json({ ok: true, member }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to add workspace member.",
      },
      { status: 500 },
    );
  }
}
