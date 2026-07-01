create table workspaces (
  id text primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner', 'manager', 'member', 'client')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table projects (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  client_name text not null,
  phase text not null,
  health text not null check (health in ('On track', 'Needs review')),
  focus text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_workspace_id_idx on projects (workspace_id);

create table tasks (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  owner_name text not null,
  due_label text not null,
  status text not null check (status in ('backlog', 'active', 'review', 'done')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  lane text not null,
  summary text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_project_id_idx on tasks (project_id);
create index tasks_project_status_idx on tasks (project_id, status);

create table task_comments (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  author_name text not null,
  note text not null,
  timestamp_label text not null,
  created_at timestamptz not null default now()
);

create index task_comments_task_id_idx on task_comments (task_id);

create table attachments (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('doc', 'sheet', 'brief')),
  visibility text not null check (visibility in ('team', 'lead')),
  updated_at_label text not null,
  created_at timestamptz not null default now()
);

create index attachments_project_id_idx on attachments (project_id);

create table automation_runs (
  id text primary key,
  project_id text references projects(id) on delete set null,
  task_id text references tasks(id) on delete set null,
  provider text not null default 'n8n',
  event_type text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automation_runs_project_id_idx on automation_runs (project_id);
create index automation_runs_task_id_idx on automation_runs (task_id);
