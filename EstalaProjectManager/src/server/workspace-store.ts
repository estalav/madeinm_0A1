import {
  type Attachment,
  type Comment,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/demo-data";
import {
  createLocalProject,
  createLocalTask,
  deleteLocalProject,
  deleteLocalTask,
  listLocalProjects,
  updateLocalProject,
  updateLocalTask,
} from "@/server/local-workspace-store";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/server/supabase";

type CreateProjectInput = {
  name: string;
  client: string;
  phase: string;
  health: Project["health"];
  focus: string;
};

type UpdateProjectInput = Partial<CreateProjectInput>;

type CreateTaskInput = {
  title: string;
  owner: string;
  due: string;
  status: TaskStatus;
  priority: TaskPriority;
  lane: string;
  summary: string;
};

type UpdateTaskInput = Partial<
  Pick<Task, "title" | "owner" | "due" | "status" | "priority" | "lane" | "summary">
>;

type ProjectRow = {
  id: string;
  name: string;
  client_name: string;
  phase: string;
  health: "On track" | "Needs review";
  focus: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  owner_name: string;
  due_label: string;
  status: TaskStatus;
  priority: TaskPriority;
  lane: string;
  summary: string;
  sort_order: number;
};

type CommentRow = {
  id: string;
  task_id: string;
  author_name: string;
  note: string;
  timestamp_label: string;
  created_at: string;
};

type AttachmentRow = {
  id: string;
  project_id: string;
  name: string;
  kind: Attachment["kind"];
  visibility: Attachment["visibility"];
  updated_at_label: string;
};

type WorkspaceRow = {
  id: string;
};

type ExistingTaskProjectRow = {
  project_id: string;
};

function calculateProgress(tasks: Task[]) {
  if (tasks.length === 0) {
    return 0;
  }

  return Math.round(
    (tasks.filter((task) => task.status === "done").length / tasks.length) * 100,
  );
}

function groupByKey<TValue extends { [key: string]: string }, TKey extends keyof TValue>(
  rows: TValue[],
  key: TKey,
) {
  return rows.reduce<Record<string, TValue[]>>((groups, row) => {
    const groupKey = row[key];
    groups[groupKey] ??= [];
    groups[groupKey].push(row);
    return groups;
  }, {});
}

function mapComments(rows: CommentRow[]): Comment[] {
  return rows
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((row) => ({
      id: row.id,
      author: row.author_name,
      note: row.note,
      timestamp: row.timestamp_label,
    }));
}

function mapTasks(rows: TaskRow[], commentsByTaskId: Record<string, CommentRow[]>) {
  return rows
    .slice()
    .sort((left, right) => left.sort_order - right.sort_order)
    .map<Task>((row) => ({
      id: row.id,
      title: row.title,
      owner: row.owner_name,
      due: row.due_label,
      status: row.status,
      priority: row.priority,
      lane: row.lane,
      summary: row.summary,
      checklist: [],
      comments: mapComments(commentsByTaskId[row.id] ?? []),
    }));
}

function mapAttachments(rows: AttachmentRow[]): Attachment[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    updatedAt: row.updated_at_label,
    visibility: row.visibility,
  }));
}

async function listSupabaseProjects() {
  const supabase = getSupabaseAdmin();

  const [{ data: projects, error: projectError }, { data: tasks, error: taskError }, { data: comments, error: commentError }, { data: attachments, error: attachmentError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, client_name, phase, health, focus")
        .order("name", { ascending: true }),
      supabase
        .from("tasks")
        .select(
          "id, project_id, title, owner_name, due_label, status, priority, lane, summary, sort_order",
        )
        .order("sort_order", { ascending: true }),
      supabase
        .from("task_comments")
        .select("id, task_id, author_name, note, timestamp_label, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("attachments")
        .select("id, project_id, name, kind, visibility, updated_at_label")
        .order("name", { ascending: true }),
    ]);

  if (projectError || taskError || commentError || attachmentError) {
    throw new Error(
      projectError?.message ||
        taskError?.message ||
        commentError?.message ||
        attachmentError?.message ||
        "Failed to load workspace data from Supabase.",
    );
  }

  const tasksByProjectId = groupByKey(tasks ?? [], "project_id");
  const commentsByTaskId = groupByKey(comments ?? [], "task_id");
  const attachmentsByProjectId = groupByKey(attachments ?? [], "project_id");

  return (projects ?? []).map<Project>((project: ProjectRow) => {
    const mappedTasks = mapTasks(tasksByProjectId[project.id] ?? [], commentsByTaskId);

    return {
      id: project.id,
      name: project.name,
      client: project.client_name,
      phase: project.phase,
      health: project.health,
      focus: project.focus,
      progress: calculateProgress(mappedTasks),
      tasks: mappedTasks,
      attachments: mapAttachments(attachmentsByProjectId[project.id] ?? []),
    };
  });
}

async function createSupabaseTask(projectId: string, input: CreateTaskInput) {
  const supabase = getSupabaseAdmin();

  const { data: existingTasks, error: countError } = await supabase
    .from("tasks")
    .select("id", { count: "exact" })
    .eq("project_id", projectId);

  if (countError) {
    throw new Error(countError.message);
  }

  const taskId = crypto.randomUUID();
  const commentId = crypto.randomUUID();
  const now = new Date();

  const { error: insertTaskError } = await supabase.from("tasks").insert([
    {
      id: taskId,
      project_id: projectId,
      title: input.title,
      owner_name: input.owner,
      due_label: input.due,
      status: input.status,
      priority: input.priority,
      lane: input.lane,
      summary: input.summary,
      sort_order: existingTasks?.length ?? 0,
    },
  ] as never[]);

  if (insertTaskError) {
    throw new Error(insertTaskError.message);
  }

  const { error: insertCommentError } = await supabase
    .from("task_comments")
    .insert([
      {
        id: commentId,
        task_id: taskId,
        author_name: "System",
        note: "Task created from the shared backend API.",
        timestamp_label: now.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      },
    ] as never[]);

  if (insertCommentError) {
    throw new Error(insertCommentError.message);
  }

  const project = await getProject(projectId);

  if (!project) {
    return null;
  }

  const task = project.tasks.find((entry) => entry.id === taskId) ?? null;

  if (!task) {
    return null;
  }

  return { project, task };
}

async function getDefaultWorkspaceId() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("workspaces")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const workspace = data as WorkspaceRow | null;

  if (!workspace?.id) {
    throw new Error("No workspace exists yet to attach a project.");
  }

  return workspace.id;
}

async function createSupabaseProject(input: CreateProjectInput) {
  const supabase = getSupabaseAdmin();
  const workspaceId = await getDefaultWorkspaceId();
  const projectId = crypto.randomUUID();

  const { error } = await supabase.from("projects").insert([
    {
      id: projectId,
      workspace_id: workspaceId,
      name: input.name,
      client_name: input.client,
      phase: input.phase,
      health: input.health,
      focus: input.focus,
    },
  ] as never[]);

  if (error) {
    throw new Error(error.message);
  }

  return getProject(projectId);
}

async function updateSupabaseTask(taskId: string, input: UpdateTaskInput) {
  const supabase = getSupabaseAdmin();

  const { data: existingTaskData, error: existingTaskError } = await supabase
    .from("tasks")
    .select("project_id, status")
    .eq("id", taskId)
    .maybeSingle();

  if (existingTaskError) {
    throw new Error(existingTaskError.message);
  }

  const existingTask = existingTaskData as {
    project_id: string;
    status: TaskStatus;
  } | null;

  if (!existingTask) {
    return null;
  }

  const updatePayload: Record<string, string> = {};

  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.owner !== undefined) updatePayload.owner_name = input.owner;
  if (input.due !== undefined) updatePayload.due_label = input.due;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.priority !== undefined) updatePayload.priority = input.priority;
  if (input.lane !== undefined) updatePayload.lane = input.lane;
  if (input.summary !== undefined) updatePayload.summary = input.summary;

  const { error: updateError } = await supabase
    .from("tasks")
    .update(updatePayload as never)
    .eq("id", taskId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (input.status && input.status !== existingTask.status) {
    const { error: commentError } = await supabase
      .from("task_comments")
      .insert([
        {
          id: crypto.randomUUID(),
          task_id: taskId,
          author_name: "System",
          note: `Status moved from ${existingTask.status} to ${input.status}.`,
          timestamp_label: new Date().toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        },
      ] as never[]);

    if (commentError) {
      throw new Error(commentError.message);
    }
  }

  const project = await getProject(existingTask.project_id);

  if (!project) {
    return null;
  }

  const task = project.tasks.find((entry) => entry.id === taskId) ?? null;

  if (!task) {
    return null;
  }

  return { project, task };
}

async function updateSupabaseProject(
  projectId: string,
  input: UpdateProjectInput,
) {
  const supabase = getSupabaseAdmin();
  const updatePayload: Record<string, string> = {};

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.client !== undefined) updatePayload.client_name = input.client;
  if (input.phase !== undefined) updatePayload.phase = input.phase;
  if (input.health !== undefined) updatePayload.health = input.health;
  if (input.focus !== undefined) updatePayload.focus = input.focus;

  const { data: existingProject, error: existingProjectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (existingProjectError) {
    throw new Error(existingProjectError.message);
  }

  if (!existingProject) {
    return null;
  }

  const { error } = await supabase
    .from("projects")
    .update(updatePayload as never)
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  return getProject(projectId);
}

async function deleteSupabaseTask(taskId: string) {
  const supabase = getSupabaseAdmin();

  const { data: existingTask, error: existingTaskError } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .maybeSingle();

  if (existingTaskError) {
    throw new Error(existingTaskError.message);
  }

  const taskProject = existingTask as ExistingTaskProjectRow | null;

  if (!taskProject) {
    return null;
  }

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) {
    throw new Error(error.message);
  }

  const project = await getProject(taskProject.project_id);

  if (!project) {
    return null;
  }

  return {
    project,
    deletedTaskId: taskId,
  };
}

async function deleteSupabaseProject(projectId: string) {
  const supabase = getSupabaseAdmin();

  const { data: existingProject, error: existingProjectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (existingProjectError) {
    throw new Error(existingProjectError.message);
  }

  if (!existingProject) {
    return false;
  }

  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function listProjects() {
  if (isSupabaseConfigured()) {
    return listSupabaseProjects();
  }

  return listLocalProjects();
}

export async function getProject(projectId: string) {
  const projects = await listProjects();
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function createProject(input: CreateProjectInput) {
  if (isSupabaseConfigured()) {
    return createSupabaseProject(input);
  }

  return createLocalProject(input);
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  if (isSupabaseConfigured()) {
    return updateSupabaseProject(projectId, input);
  }

  return updateLocalProject(projectId, input);
}

export async function deleteProject(projectId: string) {
  if (isSupabaseConfigured()) {
    return deleteSupabaseProject(projectId);
  }

  return deleteLocalProject(projectId);
}

export async function createTask(projectId: string, input: CreateTaskInput) {
  if (isSupabaseConfigured()) {
    return createSupabaseTask(projectId, input);
  }

  return createLocalTask(projectId, input);
}

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  if (isSupabaseConfigured()) {
    return updateSupabaseTask(taskId, input);
  }

  return updateLocalTask(taskId, input);
}

export async function deleteTask(taskId: string) {
  if (isSupabaseConfigured()) {
    return deleteSupabaseTask(taskId);
  }

  return deleteLocalTask(taskId);
}
