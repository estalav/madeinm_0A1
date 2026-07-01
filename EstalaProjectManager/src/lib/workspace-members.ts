export type WorkspaceMemberRole = "owner" | "manager" | "member" | "client";

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceMemberRole;
  createdAt: string;
};

export const workspaceMemberRoles: WorkspaceMemberRole[] = [
  "owner",
  "manager",
  "member",
  "client",
];

export const demoWorkspaceMembers: WorkspaceMember[] = [
  {
    id: "estala@estala.com",
    workspaceId: "workspace-estala",
    email: "estala@estala.com",
    role: "owner",
    createdAt: new Date("2026-06-28T14:00:00.000Z").toISOString(),
  },
];

export function normalizeMemberEmail(email: string) {
  return email.trim().toLowerCase();
}
