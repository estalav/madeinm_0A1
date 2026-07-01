"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  workspaceMemberRoles,
  type WorkspaceMember,
  type WorkspaceMemberRole,
} from "@/lib/workspace-members";

type MembersResponse = {
  ok: boolean;
  storage?: "supabase" | "local";
  members?: WorkspaceMember[];
  message?: string;
};

const roleLabels: Record<WorkspaceMemberRole, string> = {
  owner: "Owner",
  manager: "Manager",
  member: "Member",
  client: "Client",
};

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminConsole() {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [storage, setStorage] = useState<"supabase" | "local">("local");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceMemberRole>("member");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "neutral" | "success" | "error";
    message: string;
  }>({
    tone: "neutral",
    message:
      "Manage the collaborator roster here. Distinct Google sign-in can be added next.",
  });

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      try {
        const response = await fetch("/api/admin/members", { cache: "no-store" });
        const result = (await response.json()) as MembersResponse;

        if (!response.ok || !result.ok || !result.members || !result.storage) {
          throw new Error(result.message || "Failed to load members.");
        }

        if (cancelled) {
          return;
        }

        setMembers(result.members);
        setStorage(result.storage);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFeedback({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Failed to load members.",
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, []);

  const createMember = async () => {
    setIsSaving(true);
    setFeedback({
      tone: "neutral",
      message: "Adding collaborator to the workspace roster...",
    });

    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, role }),
      });

      const result = (await response.json()) as MembersResponse & {
        member?: WorkspaceMember;
      };

      if (!response.ok || !result.ok || !result.member) {
        throw new Error(result.message || "Failed to add collaborator.");
      }

      const member = result.member;

      setMembers((current) =>
        [...current, member].sort((left, right) =>
          left.email.localeCompare(right.email),
        ),
      );
      setEmail("");
      setRole("member");
      setFeedback({
        tone: "success",
        message: `${member.email} is now part of the workspace roster.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to add collaborator.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMember = async (memberId: string) => {
    setDeletingMemberId(memberId);

    try {
      const response = await fetch(
        `/api/admin/members/${encodeURIComponent(memberId)}`,
        {
          method: "DELETE",
        },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Failed to remove collaborator.");
      }

      setMembers((current) =>
        current.filter((member) => member.id !== memberId),
      );
      setFeedback({
        tone: "success",
        message: `${memberId} was removed from the workspace roster.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to remove collaborator.",
      });
    } finally {
      setDeletingMemberId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7efe2_0%,#fdfaf5_100%)] p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-6xl rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] md:p-6">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-teal-800/75">
              Estala PM Admin
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Collaborators
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
              Add or remove people who collaborate on projects. The current app
              still uses one shared workspace login, so this roster is the first
              step before per-user access.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-slate-700"
            >
              Back to workspace
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-slate-700"
            >
              Login screen
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_360px]">
          <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-teal-800/75">
                  Workspace roster
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {isLoading ? "Loading collaborators..." : `${members.length} collaborators`}
                </h2>
              </div>
              <span className="rounded-full bg-[#efe3d1] px-3 py-1 text-sm font-medium text-slate-700">
                {storage === "supabase" ? "Supabase" : "Local fallback"}
              </span>
            </div>

            <div
              className={`mt-4 rounded-[18px] px-4 py-3 text-sm ${
                feedback.tone === "success"
                  ? "bg-emerald-50 text-emerald-900"
                  : feedback.tone === "error"
                    ? "bg-orange-50 text-orange-900"
                    : "bg-[#fbf7f0] text-slate-600"
              }`}
            >
              {feedback.message}
            </div>

            <div className="mt-5 space-y-3">
              {members.map((member) => (
                <article
                  key={member.id}
                  className="rounded-[20px] border border-[var(--line)] bg-[#fbf7f0] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {member.email}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                        <span className="rounded-full bg-white px-3 py-1">
                          {roleLabels[member.role]}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1">
                          Added {formatCreatedAt(member.createdAt)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void deleteMember(member.id);
                      }}
                      disabled={deletingMemberId === member.id}
                      className="rounded-full border border-orange-200 px-4 py-2 text-sm font-medium text-orange-800 disabled:cursor-wait disabled:opacity-60"
                    >
                      {deletingMemberId === member.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </article>
              ))}

              {!isLoading && members.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-slate-600">
                  No collaborators yet. Add the first workspace member from the
                  panel on the right.
                </div>
              ) : null}
            </div>
          </div>

          <aside className="rounded-[24px] border border-[var(--line)] bg-[#17313c] p-5 text-[#f8f1e6]">
            <p className="text-xs uppercase tracking-[0.2em] text-[#d7c4a4]">
              Add collaborator
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Invite by email
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/70">
              Add collaborators to the shared roster now. Google sign-in is
              possible next through Supabase Auth once you want per-user access.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block space-y-2 text-sm text-white/75">
                <span className="font-medium text-[#f8f1e6]">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="teammate@gmail.com"
                  className="w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ring-0 placeholder:text-white/35"
                />
              </label>

              <label className="block space-y-2 text-sm text-white/75">
                <span className="font-medium text-[#f8f1e6]">Role</span>
                <select
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as WorkspaceMemberRole)
                  }
                  className="w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ring-0"
                >
                  {workspaceMemberRoles.map((memberRole) => (
                    <option key={memberRole} value={memberRole} className="text-slate-900">
                      {roleLabels[memberRole]}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  void createMember();
                }}
                disabled={isSaving || !email.trim()}
                className="w-full rounded-full bg-[#d7c4a4] px-5 py-3 text-sm font-semibold text-[#17313c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Adding collaborator..." : "Add collaborator"}
              </button>
            </div>

            <div className="mt-6 rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-white/75">
              <p className="font-medium text-[#f8f1e6]">About Google login</p>
              <p className="mt-2">
                Yes, it is possible. The clean version is to switch this app
                from the current shared username/password cookie to Supabase Auth
                with Google OAuth, then map Google users to workspace roles.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
