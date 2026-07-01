insert into workspaces (id, name, slug)
values ('workspace-estala', 'Estala Studio Workspace', 'estala-studio')
on conflict (id) do nothing;

insert into projects (id, workspace_id, name, client_name, phase, health, focus)
values
  ('launch', 'workspace-estala', 'Summer Launch', 'Estala Studio', 'Execution sprint', 'On track', 'Bring campaign planning, content review, and launch assets into one shared rhythm.'),
  ('ops', 'workspace-estala', 'Client Ops Hub', 'Internal', 'Template setup', 'Needs review', 'Standardize intake, delivery steps, and shared templates for recurring projects.')
on conflict (id) do nothing;

insert into tasks (id, project_id, title, owner_name, due_label, status, priority, lane, summary, sort_order)
values
  ('t1', 'launch', 'Finalize kickoff timeline', 'Maya', 'Jun 29', 'active', 'high', 'Planning', 'Align channel launch dates, owners, and review windows before Friday handoff.', 0),
  ('t2', 'launch', 'Build launch asset tracker', 'Estala', 'Jul 1', 'review', 'medium', 'Assets', 'Track deck, copy doc, creative pack, and final export links in one place.', 1),
  ('t3', 'launch', 'Approve homepage copy', 'Nina', 'Jul 2', 'backlog', 'medium', 'Content', 'Collect brand edits and sign off on the final copy blocks for the launch page.', 2),
  ('t4', 'launch', 'Launch readiness review', 'Dario', 'Jul 5', 'done', 'low', 'Operations', 'Close out blockers and make sure the team has one place to monitor progress.', 3),
  ('t5', 'ops', 'Template the intake form', 'Estala', 'Jul 3', 'active', 'high', 'Systems', 'Turn repeated kickoff questions into a reusable intake workflow.', 0),
  ('t6', 'ops', 'Review delivery checklist', 'Maya', 'Jul 6', 'backlog', 'medium', 'Operations', 'Make sure recurring projects follow the same delivery process and handoff notes.', 1)
on conflict (id) do nothing;

insert into task_comments (id, task_id, author_name, note, timestamp_label)
values
  ('c1', 't1', 'Leo', 'Client asked for a shorter approval loop on social assets.', 'Today, 9:10 AM'),
  ('c2', 't1', 'Maya', 'Updated the review dates and moved the paid media handoff to Wednesday.', 'Today, 11:34 AM'),
  ('c3', 't2', 'Sofia', 'Tracker structure looks good. We only need a separate row for final video captions.', 'Yesterday'),
  ('c4', 't4', 'Dario', 'No blockers left. Added owners for launch-day monitoring.', 'Monday')
on conflict (id) do nothing;

insert into attachments (id, project_id, name, kind, visibility, updated_at_label)
values
  ('a1', 'launch', 'Launch plan v3', 'doc', 'team', '2h ago'),
  ('a2', 'launch', 'Creative tracker', 'sheet', 'team', 'Today'),
  ('a3', 'launch', 'Client brief', 'brief', 'lead', 'Yesterday'),
  ('a4', 'ops', 'Intake template', 'doc', 'team', 'Today')
on conflict (id) do nothing;
