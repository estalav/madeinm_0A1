"use client";

import { useEffect, useState } from "react";
import {
  demoProjects,
  lanes,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
  viewModes,
  type ViewMode,
} from "@/lib/demo-data";

type ProjectState = Project[];
type SyncTone = "neutral" | "success" | "error";
type TaskStatusFilter = TaskStatus | "all";
type TaskPriorityFilter = TaskPriority | "all";

type ProjectDraft = {
  name: string;
  client: string;
  phase: string;
  health: Project["health"];
  focus: string;
};

type TaskDraft = {
  title: string;
  owner: string;
  due: string;
  priority: TaskPriority;
  lane: string;
  summary: string;
};

const emptyProjectDraft: ProjectDraft = {
  name: "",
  client: "",
  phase: "",
  health: "On track",
  focus: "",
};

const emptyTaskDraft: TaskDraft = {
  title: "",
  owner: "",
  due: "",
  priority: "medium",
  lane: "General",
  summary: "",
};

const statusTone: Record<TaskStatus, string> = {
  backlog: "bg-white/70 text-stone-700",
  active: "bg-teal-100 text-teal-900",
  review: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-900",
};

const priorityTone: Record<TaskPriority, string> = {
  low: "text-stone-500",
  medium: "text-amber-700",
  high: "text-orange-700",
};

async function fetchWorkspaceProjects() {
  const response = await fetch("/api/projects", { cache: "no-store" });
  const result = (await response.json()) as {
    ok: boolean;
    storage?: "supabase" | "local";
    projects?: Project[];
    message?: string;
  };

  if (!response.ok || !result.ok || !result.projects) {
    throw new Error(result.message || "Failed to load projects.");
  }

  return {
    storage: result.storage,
    projects: result.projects,
  };
}

function taskToDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    owner: task.owner,
    due: task.due,
    priority: task.priority,
    lane: task.lane,
    summary: task.summary,
  };
}

function projectToDraft(project: Project): ProjectDraft {
  return {
    name: project.name,
    client: project.client,
    phase: project.phase,
    health: project.health,
    focus: project.focus,
  };
}

export function WorkspaceApp({
  initialProjectId,
  initialTaskId,
}: {
  initialProjectId?: string;
  initialTaskId?: string;
}) {
  const [projects, setProjects] = useState<ProjectState>(demoProjects);
  const [activeProjectId, setActiveProjectId] = useState(demoProjects[0]?.id ?? "");
  const [view, setView] = useState<ViewMode>("board");
  const [selectedTaskId, setSelectedTaskId] = useState(
    demoProjects[0]?.tasks[0]?.id ?? "",
  );
  const [, setIsLoadingProjects] = useState(true);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(emptyProjectDraft);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(emptyTaskDraft);
  const [taskQuery, setTaskQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [priorityFilter, setPriorityFilter] =
    useState<TaskPriorityFilter>("all");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [, setSyncState] = useState<{
    tone: SyncTone;
    message: string;
  }>({
    tone: "neutral",
    message: "Loading workspace data from the shared backend...",
  });
  const [automationState, setAutomationState] = useState<{
    sending: boolean;
    tone: "neutral" | "success" | "error";
    message: string;
  }>({
    sending: false,
    tone: "neutral",
    message: "Send the selected task to n8n to kick off downstream automation.",
  });
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      try {
        const result = await fetchWorkspaceProjects();
        const loadedProjects = result.projects;

        if (cancelled) {
          return;
        }

        const preferredProject =
          (initialProjectId
            ? loadedProjects.find((project) => project.id === initialProjectId)
            : undefined) ?? loadedProjects[0];
        const preferredTask =
          (initialTaskId
            ? preferredProject?.tasks.find((task) => task.id === initialTaskId)
            : undefined) ?? preferredProject?.tasks[0];

        setProjects(loadedProjects);
        setActiveProjectId(preferredProject?.id ?? "");
        setSelectedTaskId(preferredTask?.id ?? "");
        setSyncState({
          tone: "success",
          message:
            result.storage === "supabase"
              ? "Supabase connected. Changes now persist in the hosted shared backend."
              : "Running on local fallback storage until Supabase environment values are added.",
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSyncState({
          tone: "error",
          message:
            error instanceof Error
              ? `${error.message} Showing local seed data for now.`
              : "Failed to load shared data. Showing local seed data for now.",
        });
      } finally {
        if (!cancelled) {
          setIsLoadingProjects(false);
        }
      }
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [initialProjectId, initialTaskId]);

  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;

  const filteredTasks = activeProject
    ? activeProject.tasks.filter((task) => {
        const normalizedQuery = taskQuery.trim().toLowerCase();
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [task.title, task.owner, task.summary, task.lane].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          );
        const matchesStatus =
          statusFilter === "all" || task.status === statusFilter;
        const matchesPriority =
          priorityFilter === "all" || task.priority === priorityFilter;

        return matchesQuery && matchesStatus && matchesPriority;
      })
    : [];

  const hasActiveFilters =
    taskQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    priorityFilter !== "all";

  const selectedTask =
    filteredTasks.find((task) => task.id === selectedTaskId) ??
    (!hasActiveFilters
      ? activeProject?.tasks.find((task) => task.id === selectedTaskId)
      : undefined) ??
    filteredTasks[0] ??
    (!hasActiveFilters ? activeProject?.tasks[0] : undefined);

  const completion = activeProject
    ? activeProject.tasks.length === 0
      ? 0
      : Math.round(
          (activeProject.tasks.filter((task) => task.status === "done").length /
            activeProject.tasks.length) *
            100,
        )
    : 0;

  const replaceProject = (nextProject: Project) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === nextProject.id ? nextProject : project,
      ),
    );
  };

  const openCreateProjectForm = () => {
    setEditingProjectId(null);
    setProjectDraft(emptyProjectDraft);
    setIsProjectFormOpen(true);
  };

  const openEditProjectForm = () => {
    if (!activeProject) {
      return;
    }

    setEditingProjectId(activeProject.id);
    setProjectDraft(projectToDraft(activeProject));
    setIsProjectFormOpen(true);
  };

  const openCreateTaskForm = () => {
    if (!activeProject) {
      return;
    }

    setEditingTaskId(null);
    setTaskDraft(emptyTaskDraft);
    setIsTaskFormOpen(true);
  };

  const openEditTaskForm = () => {
    if (!selectedTask) {
      return;
    }

    setEditingTaskId(selectedTask.id);
    setTaskDraft(taskToDraft(selectedTask));
    setIsTaskFormOpen(true);
  };

  const saveProject = async () => {
    setIsSavingProject(true);

    try {
      const response = await fetch(
        editingProjectId ? `/api/projects/${editingProjectId}` : "/api/projects",
        {
          method: editingProjectId ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(projectDraft),
        },
      );

      const result = (await response.json()) as {
        ok: boolean;
        project?: Project;
        message?: string;
      };

      if (!response.ok || !result.ok || !result.project) {
        throw new Error(result.message || "Failed to save project.");
      }

      const savedProject = result.project;

      setProjects((current) => {
        const exists = current.some((project) => project.id === savedProject.id);
        return exists
          ? current.map((project) =>
              project.id === savedProject.id ? savedProject : project,
            )
          : [savedProject, ...current];
      });
      setActiveProjectId(savedProject.id);
      setSelectedTaskId(savedProject.tasks[0]?.id ?? "");
      setProjectDraft(emptyProjectDraft);
      setEditingProjectId(null);
      setIsProjectFormOpen(false);
      setSyncState({
        tone: "success",
        message: editingProjectId
          ? `Updated "${savedProject.name}" in the shared backend.`
          : `Created "${savedProject.name}" in the shared backend.`,
      });
    } catch (error) {
      setSyncState({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to save the project.",
      });
    } finally {
      setIsSavingProject(false);
    }
  };

  const deleteCurrentProject = async () => {
    if (!activeProject) {
      return;
    }

    if (!window.confirm(`Delete "${activeProject.name}" and all of its tasks?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${activeProject.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        ok: boolean;
        deletedProjectId?: string;
        projects?: Project[];
        message?: string;
      };

      if (!response.ok || !result.ok || !result.projects) {
        throw new Error(result.message || "Failed to delete project.");
      }

      const nextActiveProject = result.projects[0] ?? null;
      setProjects(result.projects);
      setActiveProjectId(nextActiveProject?.id ?? "");
      setSelectedTaskId(nextActiveProject?.tasks[0]?.id ?? "");
      setIsProjectFormOpen(false);
      setEditingProjectId(null);
      setIsTaskFormOpen(false);
      setEditingTaskId(null);
      setProjectDraft(emptyProjectDraft);
      setTaskDraft(emptyTaskDraft);
      setSyncState({
        tone: "success",
        message: `Deleted "${activeProject.name}" from the shared backend.`,
      });
    } catch (error) {
      setSyncState({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete the project.",
      });
    }
  };

  const saveTask = async () => {
    if (!activeProject) {
      return;
    }

    setIsSavingTask(true);

    try {
      const response = await fetch(
        editingTaskId
          ? `/api/tasks/${editingTaskId}`
          : `/api/projects/${activeProject.id}/tasks`,
        {
          method: editingTaskId ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            ...taskDraft,
            status: editingTaskId ? selectedTask?.status ?? "backlog" : "backlog",
          }),
        },
      );

      const result = (await response.json()) as {
        ok: boolean;
        project?: Project;
        task?: Task;
        message?: string;
      };

      if (!response.ok || !result.ok || !result.project) {
        throw new Error(result.message || "Failed to save task.");
      }

      replaceProject(result.project);
      setActiveProjectId(result.project.id);
      setSelectedTaskId(
        result.task?.id ??
          editingTaskId ??
          result.project.tasks[0]?.id ??
          "",
      );
      setTaskDraft(emptyTaskDraft);
      setEditingTaskId(null);
      setIsTaskFormOpen(false);
      setSyncState({
        tone: "success",
        message: editingTaskId
          ? `Updated "${result.task?.title ?? "task"}" in the shared backend.`
          : `Created "${result.task?.title ?? "task"}" in the shared backend.`,
      });
    } catch (error) {
      setSyncState({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to save the task.",
      });
    } finally {
      setIsSavingTask(false);
    }
  };

  const moveTask = async (taskId: string, nextStatus: TaskStatus) => {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    });

    const result = (await response.json()) as {
      ok: boolean;
      project?: Project;
      task?: Task;
      message?: string;
    };

    if (!response.ok || !result.ok || !result.project) {
      throw new Error(result.message || "Failed to update task status.");
    }

    replaceProject(result.project);
    setSelectedTaskId(result.task?.id ?? taskId);
    setSyncState({
      tone: "success",
      message: `Saved "${result.task?.title ?? "task"}" to the shared backend.`,
    });
  };

  const deleteCurrentTask = async () => {
    if (!selectedTask) {
      return;
    }

    if (!window.confirm(`Delete "${selectedTask.title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        ok: boolean;
        project?: Project;
        deletedTaskId?: string;
        message?: string;
      };

      if (!response.ok || !result.ok || !result.project) {
        throw new Error(result.message || "Failed to delete task.");
      }

      replaceProject(result.project);
      setSelectedTaskId(result.project.tasks[0]?.id ?? "");
      setEditingTaskId(null);
      setIsTaskFormOpen(false);
      setTaskDraft(emptyTaskDraft);
      setSyncState({
        tone: "success",
        message: `Deleted "${selectedTask.title}" from the shared backend.`,
      });
    } catch (error) {
      setSyncState({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete the task.",
      });
    }
  };

  const sendTaskToN8n = async () => {
    if (!selectedTask || !activeProject) {
      return;
    }

    setAutomationState({
      sending: true,
      tone: "neutral",
      message: `Sending "${selectedTask.title}" to n8n...`,
    });

    try {
      const response = await fetch("/api/automations/dispatch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          eventType: "task.sent_to_n8n",
          source: "estala-project-manager",
          occurredAt: new Date().toISOString(),
          project: {
            id: activeProject.id,
            name: activeProject.name,
            client: activeProject.client,
            phase: activeProject.phase,
            health: activeProject.health,
            progress: activeProject.progress,
          },
          task: {
            id: selectedTask.id,
            title: selectedTask.title,
            owner: selectedTask.owner,
            due: selectedTask.due,
            status: selectedTask.status,
            priority: selectedTask.priority,
            lane: selectedTask.lane,
            summary: selectedTask.summary,
          },
        }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        workflowResponse?: {
          summary?: string;
          message?: string;
        };
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ||
            result.workflowResponse?.message ||
            "n8n did not accept the automation event.",
        );
      }

      setAutomationState({
        sending: false,
        tone: "success",
        message:
          result.workflowResponse?.summary ||
          `n8n accepted "${selectedTask.title}" for automation.`,
      });
    } catch (error) {
      setAutomationState({
        sending: false,
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to reach n8n.",
      });
    }
  };

  const signOut = async () => {
    setIsSigningOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <main className="min-h-screen p-4 text-[15px] text-slate-900 md:p-6">
      <div
        className={`mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1500px] gap-4 rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)] md:p-4 ${
          isSidebarCollapsed
            ? "md:grid-cols-[92px_minmax(0,1fr)]"
            : "md:grid-cols-[248px_minmax(0,1fr)]"
        }`}
      >
        <aside
          className={`rounded-[24px] bg-[#17313c] text-[#f8f1e6] shadow-[var(--shadow-md)] transition-all ${
            isSidebarCollapsed ? "p-3" : "p-5"
          }`}
        >
          <div className="mb-6 flex items-center justify-between">
            {isSidebarCollapsed ? (
              <div className="flex w-full flex-col items-center gap-3">
                <div className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/75">
                  CRUD
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/10"
                >
                  <span className="flex flex-col gap-1">
                    <span className="block h-px w-4 bg-current" />
                    <span className="block h-px w-4 bg-current" />
                    <span className="block h-px w-4 bg-current" />
                  </span>
                </button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#d7c4a4]">
                    Estala PM
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                    Workspaces
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(true)}
                    aria-label="Collapse sidebar"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/75 transition hover:bg-white/10"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="block h-px w-4 bg-current" />
                      <span className="block h-px w-4 bg-current" />
                      <span className="block h-px w-4 bg-current" />
                    </span>
                  </button>
                  <div className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/75">
                    CRUD
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={openCreateProjectForm}
            className={`mb-5 rounded-[18px] bg-[#d7c4a4] text-sm font-semibold text-[#17313c] transition hover:bg-[#e4d4b8] ${
              isSidebarCollapsed ? "w-full px-0 py-3" : "w-full px-4 py-3"
            }`}
          >
            {isSidebarCollapsed ? "+" : "New project"}
          </button>

          <nav className="space-y-3">
            {projects.map((project) => {
              const isActive = project.id === activeProject?.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    setActiveProjectId(project.id);
                    setSelectedTaskId(project.tasks[0]?.id ?? "");
                  }}
                  className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                    isActive
                      ? "border-[#d7c4a4]/20 bg-white/10"
                      : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  {isSidebarCollapsed ? (
                    <div className="flex flex-col items-center gap-3 px-0 py-1 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-[#f8f1e6]">
                        {project.name
                          .split(" ")
                          .slice(0, 2)
                          .map((word) => word[0] ?? "")
                          .join("")
                          .slice(0, 2)}
                      </span>
                      <span className="text-xs text-white/60">{project.progress}%</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{project.name}</span>
                        <span className="text-xs text-white/60">{project.progress}%</span>
                      </div>
                      <p className="mt-2 text-sm text-white/65">{project.phase}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#d7c4a4]">
                        {project.client}
                      </p>
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {projects.length === 0 && (
            <div className="mt-4 rounded-[18px] border border-dashed border-white/15 px-4 py-5 text-sm leading-6 text-white/70">
              Create your first project to start adding tasks, notes, and automation.
            </div>
          )}
        </aside>

        <section className="min-w-0 rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
          {isProjectFormOpen && (
            <section className="rounded-[24px] border border-[var(--line)] bg-[#fbf7f0] p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-teal-800/75">
                    Shared backend
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    {editingProjectId ? "Edit project" : "Create a project"}
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProjectFormOpen(false);
                      setEditingProjectId(null);
                      setProjectDraft(emptyProjectDraft);
                    }}
                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void saveProject();
                    }}
                    disabled={
                      isSavingProject ||
                      !projectDraft.name ||
                      !projectDraft.client ||
                      !projectDraft.phase ||
                      !projectDraft.focus
                    }
                    className="rounded-full bg-[#17313c] px-4 py-2 text-sm font-semibold text-[#f8f1e6] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingProject
                      ? "Saving..."
                      : editingProjectId
                        ? "Save project"
                        : "Create project"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">Project name</span>
                  <input
                    value={projectDraft.name}
                    onChange={(event) =>
                      setProjectDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                    placeholder="Summer Retainer"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">Client</span>
                  <input
                    value={projectDraft.client}
                    onChange={(event) =>
                      setProjectDraft((current) => ({
                        ...current,
                        client: event.target.value,
                      }))
                    }
                    className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                    placeholder="Estala Studio"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">Phase</span>
                  <input
                    value={projectDraft.phase}
                    onChange={(event) =>
                      setProjectDraft((current) => ({
                        ...current,
                        phase: event.target.value,
                      }))
                    }
                    className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                    placeholder="Planning"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">Health</span>
                  <select
                    value={projectDraft.health}
                    onChange={(event) =>
                      setProjectDraft((current) => ({
                        ...current,
                        health: event.target.value as Project["health"],
                      }))
                    }
                    className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                  >
                    <option value="On track">On track</option>
                    <option value="Needs review">Needs review</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm text-slate-600 md:col-span-2">
                  <span className="font-medium text-slate-900">Focus</span>
                  <textarea
                    value={projectDraft.focus}
                    onChange={(event) =>
                      setProjectDraft((current) => ({
                        ...current,
                        focus: event.target.value,
                      }))
                    }
                    className="min-h-28 w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                    placeholder="Describe the main outcome this project should drive."
                  />
                </label>
              </div>
            </section>
          )}

          {activeProject ? (
            <>
              <header className={`${isProjectFormOpen ? "mt-6" : ""} grid gap-4 border-b border-[var(--line)] pb-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)] xl:items-start`}>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.24em] text-teal-800/75">
                    Collaborative planning workspace
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <h2 className="min-w-0 truncate text-[clamp(2rem,2.6vw,3rem)] font-semibold tracking-tight text-slate-900 xl:whitespace-nowrap">
                      {activeProject.name}
                    </h2>
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium text-[var(--accent-strong)]">
                      {activeProject.health}
                    </span>
                  </div>
                  <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-700">
                    {activeProject.focus}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:self-start">
                  <MetricCard
                    label="Project phase"
                    value={activeProject.phase}
                    detail="Shared across the team"
                  />
                  <MetricCard
                    label="Current progress"
                    value={`${activeProject.progress}%`}
                    detail={`${completion}% tasks complete`}
                  />
                  <MetricCard
                    label="Team files"
                    value={`${activeProject.attachments.length}`}
                    detail="Private attachments ready"
                  />
                </div>
              </header>

              <div className="mt-5 flex flex-col gap-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="inline-flex rounded-full bg-[#efe3d1] p-1">
                    {viewModes.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setView(mode.id)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                          view === mode.id
                            ? "bg-[#17313c] text-[#f8f1e6]"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void signOut();
                      }}
                      disabled={isSigningOut}
                      className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-wait disabled:opacity-70"
                    >
                      {isSigningOut ? "Signing out..." : "Sign out"}
                    </button>
                    <button
                      type="button"
                      onClick={openEditProjectForm}
                      className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      Edit project
                    </button>
                    <button
                      type="button"
                      onClick={deleteCurrentProject}
                      className="rounded-full border border-orange-200 px-4 py-2 text-sm font-medium text-orange-800"
                    >
                      Delete project
                    </button>
                    <button
                      type="button"
                      onClick={openCreateTaskForm}
                      className="rounded-full bg-[#c96f44] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b85f34]"
                    >
                      New task
                    </button>
                  </div>
                </div>

                <section className="rounded-[24px] border border-[var(--line)] bg-[#fbf7f0] p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="min-w-[220px] flex-1 space-y-2 text-sm text-slate-600">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-teal-800/75">
                        Search
                      </span>
                      <input
                        value={taskQuery}
                        onChange={(event) => setTaskQuery(event.target.value)}
                        className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                        placeholder="Search title, owner, lane, or summary"
                      />
                    </label>
                    <label className="w-full space-y-2 text-sm text-slate-600 sm:w-[180px]">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-teal-800/75">
                        Status
                      </span>
                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value as TaskStatusFilter)
                        }
                        className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                      >
                        <option value="all">All statuses</option>
                        {lanes.map((lane) => (
                          <option key={lane.id} value={lane.id}>
                            {lane.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="w-full space-y-2 text-sm text-slate-600 sm:w-[180px]">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-teal-800/75">
                        Priority
                      </span>
                      <select
                        value={priorityFilter}
                        onChange={(event) =>
                          setPriorityFilter(event.target.value as TaskPriorityFilter)
                        }
                        className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                      >
                        <option value="all">All priorities</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          setTaskQuery("");
                          setStatusFilter("all");
                          setPriorityFilter("all");
                        }}
                        disabled={!hasActiveFilters}
                        className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Clear filters
                      </button>
                        </div>
                    <div className="ml-auto pb-3 text-sm text-slate-500">
                      {filteredTasks.length} of {activeProject.tasks.length} tasks
                    </div>
                  </div>
                </section>
              </div>

              {isTaskFormOpen && (
                <section className="mt-6 rounded-[24px] border border-[var(--line)] bg-[#fbf7f0] p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-teal-800/75">
                        Shared backend
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">
                        {editingTaskId
                          ? `Edit task in ${activeProject.name}`
                          : `Create a task in ${activeProject.name}`}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsTaskFormOpen(false);
                          setEditingTaskId(null);
                          setTaskDraft(emptyTaskDraft);
                        }}
                        className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void saveTask();
                        }}
                        disabled={
                          isSavingTask ||
                          !taskDraft.title ||
                          !taskDraft.owner ||
                          !taskDraft.due ||
                          !taskDraft.summary
                        }
                        className="rounded-full bg-[#17313c] px-4 py-2 text-sm font-semibold text-[#f8f1e6] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSavingTask
                          ? "Saving..."
                          : editingTaskId
                            ? "Save task"
                            : "Create task"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-900">Title</span>
                      <input
                        value={taskDraft.title}
                        onChange={(event) =>
                          setTaskDraft((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                        placeholder="Add a clear task title"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-900">Owner</span>
                      <input
                        value={taskDraft.owner}
                        onChange={(event) =>
                          setTaskDraft((current) => ({
                            ...current,
                            owner: event.target.value,
                          }))
                        }
                        className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                        placeholder="Who owns this?"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-900">Due</span>
                      <input
                        value={taskDraft.due}
                        onChange={(event) =>
                          setTaskDraft((current) => ({
                            ...current,
                            due: event.target.value,
                          }))
                        }
                        className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                        placeholder="Jul 12"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-900">Lane</span>
                      <input
                        value={taskDraft.lane}
                        onChange={(event) =>
                          setTaskDraft((current) => ({
                            ...current,
                            lane: event.target.value,
                          }))
                        }
                        className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                        placeholder="Planning"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-600 md:col-span-2">
                      <span className="font-medium text-slate-900">Summary</span>
                      <textarea
                        value={taskDraft.summary}
                        onChange={(event) =>
                          setTaskDraft((current) => ({
                            ...current,
                            summary: event.target.value,
                          }))
                        }
                        className="min-h-28 w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                        placeholder="Describe the outcome you want from this task."
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-900">Priority</span>
                      <select
                        value={taskDraft.priority}
                        onChange={(event) =>
                          setTaskDraft((current) => ({
                            ...current,
                            priority: event.target.value as TaskPriority,
                          }))
                        }
                        className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                  </div>
                </section>
              )}

              <section className="mt-6 rounded-[24px] border border-[var(--line)] bg-[#fff9f0] p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 xl:max-w-[34rem]">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Task detail
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                      {selectedTask?.title ?? "No task matches these filters"}
                    </h3>
                    {selectedTask ? (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone[selectedTask.status]}`}
                          >
                            {selectedTask.status}
                          </span>
                          <span
                            className={`rounded-full bg-white px-3 py-1 text-xs font-medium ${priorityTone[selectedTask.priority]}`}
                          >
                            {selectedTask.priority} priority
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                            Owner {selectedTask.owner}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                            Due {selectedTask.due}
                          </span>
                        </div>
                        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
                          {selectedTask.summary}
                        </p>
                      </>
                    ) : (
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        Click a task title from the board to see its details here.
                      </p>
                    )}
                  </div>

                  {selectedTask && (
                    <div className="xl:w-[520px]">
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <button
                          type="button"
                          onClick={openEditTaskForm}
                          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          Edit task
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void deleteCurrentTask();
                          }}
                          className="rounded-full border border-orange-200 px-4 py-2 text-sm font-medium text-orange-800"
                        >
                          Delete task
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void sendTaskToN8n();
                          }}
                          disabled={automationState.sending}
                          className="rounded-full bg-[#c96f44] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b85f34] disabled:cursor-wait disabled:opacity-70"
                        >
                          {automationState.sending ? "Sending..." : "Send to n8n"}
                        </button>
                      </div>

                      <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">Update task</p>
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Move across stages
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {lanes.map((lane) => (
                            <button
                              key={lane.id}
                              type="button"
                              disabled={selectedTask.status === lane.id}
                              onClick={() => {
                                void moveTask(selectedTask.id, lane.id);
                              }}
                              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                selectedTask.status === lane.id
                                  ? "bg-[#17313c] text-[#f8f1e6]"
                                  : "border border-[var(--line)] bg-white text-slate-700 hover:border-[var(--line-strong)]"
                              }`}
                            >
                              {lane.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {automationState.message && (
                        <div
                          className={`mt-3 rounded-[18px] px-4 py-3 text-sm leading-6 ${
                            automationState.tone === "success"
                              ? "bg-emerald-50 text-emerald-900"
                              : automationState.tone === "error"
                                ? "bg-orange-50 text-orange-900"
                                : "bg-[#fbf7f0] text-slate-600"
                          }`}
                        >
                          {automationState.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <div className="mt-6">
                <div className="min-w-0">
                  {view === "board" && (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                      {lanes.map((lane) => {
                        const items = filteredTasks.filter(
                          (task) => task.status === lane.id,
                        );

                        return (
                          <div
                            key={lane.id}
                            className="rounded-[22px] border border-[var(--line)] bg-[#fbf7f0] p-4"
                          >
                            <div className="mb-4 flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-slate-900">
                                  {lane.label}
                                </h3>
                                <p className="text-sm text-slate-500">
                                  {items.length} active cards
                                </p>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                                {lane.id}
                              </span>
                            </div>

                            <div className="space-y-3">
                              {items.map((task) => (
                                <button
                                  key={task.id}
                                  type="button"
                                  onClick={() => setSelectedTaskId(task.id)}
                                  className={`w-full rounded-[20px] border px-4 py-3 text-left transition ${
                                    selectedTask?.id === task.id
                                      ? "border-teal-300 bg-white shadow-sm"
                                      : "border-transparent bg-white/80 hover:border-[var(--line)] hover:bg-white"
                                  }`}
                                >
                                  <p className="text-base font-semibold leading-7 text-slate-900">
                                    {task.title}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {view === "timeline" && (
                    <div className="overflow-hidden rounded-[24px] border border-[var(--line)] bg-[#fbf7f0]">
                      <div className="grid grid-cols-[220px_repeat(5,minmax(0,1fr))] border-b border-[var(--line)] bg-white/75 px-4 py-3 text-sm font-medium text-slate-500">
                        <span>Workstream</span>
                        <span>Mon</span>
                        <span>Tue</span>
                        <span>Wed</span>
                        <span>Thu</span>
                        <span>Fri</span>
                      </div>
                      {filteredTasks.map((task, index) => (
                        <div
                          key={task.id}
                          className="grid grid-cols-[220px_repeat(5,minmax(0,1fr))] items-center border-b border-[var(--line)] px-4 py-4 last:border-b-0"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{task.title}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {task.owner} · {task.lane}
                            </p>
                          </div>
                          {[0, 1, 2, 3, 4].map((day) => {
                            const active = day >= index % 2 && day <= (index % 2) + 1;
                            return (
                              <div key={day} className="px-2">
                                <div
                                  className={`h-11 rounded-2xl ${
                                    active
                                      ? "bg-gradient-to-r from-teal-700 to-teal-500"
                                      : "bg-white"
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  {view === "files" && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {activeProject.attachments.map((file) => (
                        <article
                          key={file.id}
                          className="rounded-[22px] border border-[var(--line)] bg-[#fbf7f0] p-5"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-teal-800/70">
                                {file.kind}
                              </p>
                              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                                {file.name}
                              </h3>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
                              {file.visibility}
                            </span>
                          </div>
                          <p className="mt-8 text-sm text-slate-500">
                            Updated {file.updatedAt}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-[var(--line-strong)] bg-[#fbf7f0] px-6 py-10 text-center">
              <p className="text-xs uppercase tracking-[0.22em] text-teal-800/75">
                Workspace ready
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                No projects yet
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-slate-600">
                Start with a project, then add tasks, notes, and automation flows from
                the same workspace.
              </p>
              <button
                type="button"
                onClick={openCreateProjectForm}
                className="mt-6 rounded-full bg-[#17313c] px-5 py-3 text-sm font-semibold text-[#f8f1e6]"
              >
                Create your first project
              </button>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="min-w-0 rounded-[20px] border border-[var(--line)] bg-[#fbf7f0] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </article>
  );
}
