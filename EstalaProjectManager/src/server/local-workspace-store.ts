import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  demoProjects,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/demo-data";

type WorkspaceData = {
  projects: Project[];
};

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

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "workspace.json");

let writeChain = Promise.resolve();

function cloneProjects(projects: Project[]) {
  return structuredClone(projects);
}

function calculateProgress(tasks: Task[]) {
  if (tasks.length === 0) {
    return 0;
  }

  return Math.round(
    (tasks.filter((task) => task.status === "done").length / tasks.length) * 100,
  );
}

async function ensureWorkspaceDataFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    const initialData: WorkspaceData = {
      projects: cloneProjects(demoProjects),
    };

    await writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

async function readWorkspaceData() {
  await ensureWorkspaceDataFile();
  const contents = await readFile(DATA_FILE, "utf8");
  return JSON.parse(contents) as WorkspaceData;
}

async function writeWorkspaceData(data: WorkspaceData) {
  writeChain = writeChain.then(() =>
    writeFile(DATA_FILE, JSON.stringify(data, null, 2)),
  );

  await writeChain;
}

function withDerivedProjectValues(project: Project): Project {
  return {
    ...project,
    progress: calculateProgress(project.tasks),
  };
}

export async function listLocalProjects() {
  const data = await readWorkspaceData();
  return data.projects.map(withDerivedProjectValues);
}

export async function createLocalProject(input: CreateProjectInput) {
  const data = await readWorkspaceData();

  const project: Project = {
    id: `project-${randomUUID().slice(0, 8)}`,
    name: input.name,
    client: input.client,
    phase: input.phase,
    health: input.health,
    focus: input.focus,
    progress: 0,
    tasks: [],
    attachments: [],
  };

  data.projects.unshift(project);
  await writeWorkspaceData(data);

  return withDerivedProjectValues(project);
}

export async function updateLocalProject(
  projectId: string,
  input: UpdateProjectInput,
) {
  const data = await readWorkspaceData();
  const project = data.projects.find((entry) => entry.id === projectId);

  if (!project) {
    return null;
  }

  if (input.name !== undefined) project.name = input.name;
  if (input.client !== undefined) project.client = input.client;
  if (input.phase !== undefined) project.phase = input.phase;
  if (input.health !== undefined) project.health = input.health;
  if (input.focus !== undefined) project.focus = input.focus;

  await writeWorkspaceData(data);

  return withDerivedProjectValues(project);
}

export async function deleteLocalProject(projectId: string) {
  const data = await readWorkspaceData();
  const projectIndex = data.projects.findIndex((entry) => entry.id === projectId);

  if (projectIndex === -1) {
    return false;
  }

  data.projects.splice(projectIndex, 1);
  await writeWorkspaceData(data);

  return true;
}

export async function createLocalTask(
  projectId: string,
  input: CreateTaskInput,
) {
  const data = await readWorkspaceData();
  const project = data.projects.find((entry) => entry.id === projectId);

  if (!project) {
    return null;
  }

  const task: Task = {
    id: `task-${randomUUID().slice(0, 8)}`,
    title: input.title,
    owner: input.owner,
    due: input.due,
    status: input.status,
    priority: input.priority,
    lane: input.lane,
    summary: input.summary,
    checklist: [],
    comments: [
      {
        id: `comment-${randomUUID().slice(0, 8)}`,
        author: "System",
        note: "Task created from the shared backend API.",
        timestamp: new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      },
    ],
  };

  project.tasks.unshift(task);
  project.progress = calculateProgress(project.tasks);

  await writeWorkspaceData(data);

  return {
    project: withDerivedProjectValues(project),
    task,
  };
}

export async function updateLocalTask(taskId: string, input: UpdateTaskInput) {
  const data = await readWorkspaceData();

  for (const project of data.projects) {
    const task = project.tasks.find((entry) => entry.id === taskId);

    if (!task) {
      continue;
    }

    const previousStatus = task.status;

    if (input.title !== undefined) task.title = input.title;
    if (input.owner !== undefined) task.owner = input.owner;
    if (input.due !== undefined) task.due = input.due;
    if (input.status !== undefined) task.status = input.status;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.lane !== undefined) task.lane = input.lane;
    if (input.summary !== undefined) task.summary = input.summary;

    if (input.status && input.status !== previousStatus) {
      task.comments.unshift({
        id: `comment-${randomUUID().slice(0, 8)}`,
        author: "System",
        note: `Status moved from ${previousStatus} to ${input.status}.`,
        timestamp: new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    }

    project.progress = calculateProgress(project.tasks);

    await writeWorkspaceData(data);

    return {
      project: withDerivedProjectValues(project),
      task,
    };
  }

  return null;
}

export async function deleteLocalTask(taskId: string) {
  const data = await readWorkspaceData();

  for (const project of data.projects) {
    const taskIndex = project.tasks.findIndex((entry) => entry.id === taskId);

    if (taskIndex === -1) {
      continue;
    }

    project.tasks.splice(taskIndex, 1);
    project.progress = calculateProgress(project.tasks);

    await writeWorkspaceData(data);

    return {
      project: withDerivedProjectValues(project),
      deletedTaskId: taskId,
    };
  }

  return null;
}
