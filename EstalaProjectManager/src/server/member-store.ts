import {
  demoWorkspaceMembers,
  normalizeMemberEmail,
  type WorkspaceMember,
  type WorkspaceMemberRole,
} from "@/lib/workspace-members";
import {
  createLocalMember,
  deleteLocalMember,
  listLocalMembers,
} from "@/server/local-workspace-store";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/server/supabase";

const DEFAULT_WORKSPACE_ID = "workspace-estala";
const DEFAULT_WORKSPACE_NAME = "Estala Studio Workspace";
const DEFAULT_WORKSPACE_SLUG = "estala-studio";

type WorkspaceRow = {
  id: string;
};

type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  created_at: string;
};

type CreateWorkspaceMemberInput = {
  email: string;
  role: WorkspaceMemberRole;
};

async function ensureSupabaseWorkspace() {
  const supabase = getSupabaseAdmin();
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", DEFAULT_WORKSPACE_ID)
    .maybeSingle<WorkspaceRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (workspace) {
    return workspace;
  }

  const { error: insertError } = await supabase.from("workspaces").insert([
    {
      id: DEFAULT_WORKSPACE_ID,
      name: DEFAULT_WORKSPACE_NAME,
      slug: DEFAULT_WORKSPACE_SLUG,
    },
  ] as never[]);

  if (insertError) {
    throw new Error(insertError.message);
  }

  return { id: DEFAULT_WORKSPACE_ID };
}

async function listSupabaseMembers() {
  const supabase = getSupabaseAdmin();
  const workspace = await ensureSupabaseWorkspace();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id, role, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map<WorkspaceMember>((member: WorkspaceMemberRow) => ({
    id: member.user_id,
    workspaceId: member.workspace_id,
    email: member.user_id,
    role: member.role,
    createdAt: member.created_at,
  }));
}

async function createSupabaseMember(input: CreateWorkspaceMemberInput) {
  const supabase = getSupabaseAdmin();
  const workspace = await ensureSupabaseWorkspace();
  const email = normalizeMemberEmail(input.email);

  const { data: existingMember, error: existingMemberError } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", email)
    .maybeSingle<{ user_id: string }>();

  if (existingMemberError) {
    throw new Error(existingMemberError.message);
  }

  if (existingMember) {
    throw new Error("A collaborator with this email already exists.");
  }

  const createdAt = new Date().toISOString();

  const { error } = await supabase.from("workspace_members").insert([
    {
      workspace_id: workspace.id,
      user_id: email,
      role: input.role,
      created_at: createdAt,
    },
  ] as never[]);

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: email,
    workspaceId: workspace.id,
    email,
    role: input.role,
    createdAt,
  } satisfies WorkspaceMember;
}

async function deleteSupabaseMember(memberId: string) {
  const supabase = getSupabaseAdmin();
  const workspace = await ensureSupabaseWorkspace();

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("user_id", normalizeMemberEmail(memberId));

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function listWorkspaceMembers() {
  if (isSupabaseConfigured()) {
    return listSupabaseMembers();
  }

  const members = await listLocalMembers();
  return members.length > 0 ? members : demoWorkspaceMembers;
}

export async function createWorkspaceMember(input: CreateWorkspaceMemberInput) {
  if (isSupabaseConfigured()) {
    return createSupabaseMember(input);
  }

  return createLocalMember(input);
}

export async function deleteWorkspaceMember(memberId: string) {
  if (isSupabaseConfigured()) {
    return deleteSupabaseMember(memberId);
  }

  return deleteLocalMember(memberId);
}
