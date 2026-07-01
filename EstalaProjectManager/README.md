# Estala Project Manager

A collaborative project manager for Estala built with `Next.js 16`, `React 19`, Supabase, and a lightweight Tauri desktop shell.

## Current App Status

The app currently supports:

- multi-project workspace navigation
- board, timeline, and files views
- username/password login with a secure session cookie
- compact task board cards that show titles first
- horizontal task detail strip with edit, delete, stage update, and `n8n` actions
- collapsible left sidebar for more workspace width
- project CRUD
- task CRUD
- task filtering by search, status, and priority
- shared backend storage through Supabase
- local JSON fallback storage when Supabase env vars are missing
- local `n8n` automation handoff from the selected task
- Tauri-based macOS desktop wrapper

Recent verification completed:

- `npm run lint` passes
- `npm run build` passes
- Supabase-backed project/task CRUD was tested through the real API
- auth flow was tested locally against the real dev server
- a manual visual QA pass was run on desktop and mobile against `http://localhost:3001`

## Run It

Install dependencies and start the web app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

If auth is configured, the app first opens on `/login`.

## Desktop App

For local desktop development:

```bash
npm run desktop:dev
```

This starts the Next.js app on `http://localhost:3001` and opens the Tauri shell.

If you already have `npm run dev` running on port `3000`, that is fine. But do not start a second `next dev` process for the same repo directory before running `desktop:dev`.

To build the packaged macOS app:

```bash
npm run desktop:build
```

Current packaged app output:

- `src-tauri/target/release/bundle/macos/Estala Project Manager.app`

## Key API Routes

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/projects`
- `POST /api/projects`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `POST /api/projects/:projectId/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/n8n/health`
- `POST /api/automations/dispatch`
- `POST /api/n8n/callback`

## Project Structure

- `src/app/page.tsx`: route entry
- `src/app/login/page.tsx`: login screen
- `src/components/login-form.tsx`: client-side sign-in form
- `src/components/workspace-app.tsx`: primary workspace UI and CRUD interactions
- `src/lib/demo-data.ts`: local seed types and demo content
- `src/lib/n8n.ts`: local `n8n` integration helpers
- `src/proxy.ts`: request protection for app and API routes
- `src/server/auth.ts`: session cookie auth helpers
- `src/server/supabase.ts`: lazy Supabase admin client
- `src/server/workspace-store.ts`: shared backend storage abstraction
- `src/server/local-workspace-store.ts`: local fallback store
- `src/app/api/auth/login/route.ts`: create authenticated session
- `src/app/api/auth/logout/route.ts`: clear authenticated session
- `src/app/api/projects/route.ts`: list and create projects
- `src/app/api/projects/[projectId]/route.ts`: update and delete projects
- `src/app/api/projects/[projectId]/tasks/route.ts`: create tasks
- `src/app/api/tasks/[taskId]/route.ts`: update and delete tasks
- `src/app/api/automations/dispatch/route.ts`: app-to-`n8n` webhook bridge
- `src/app/api/n8n/callback/route.ts`: `n8n`-to-app callback endpoint
- `src-tauri/`: macOS desktop shell
- `desktop-shell/index.html`: packaged desktop handoff screen
- `data/workspace.json`: local persistent workspace data for development fallback
- `supabase/migrations/20260628140000_init.sql`: Supabase schema migration
- `supabase/seed.sql`: starter workspace seed data
- `n8n/workflows/estala-project-events.json`: starter workflow definition

## Supabase Setup

1. Copy `.env.example` to `.env.local`.
2. Add:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. In Supabase SQL editor, run:

- `supabase/migrations/20260628140000_init.sql`
- `supabase/seed.sql`

4. Restart the dev server.

When configured, `GET /api/projects` returns `storage: "supabase"`.

## App Login

The workspace can be protected with a simple built-in username/password gate.

Required env vars:

```bash
APP_AUTH_USERNAME=admin
APP_AUTH_PASSWORD=change-me-now
APP_AUTH_SECRET=replace-this-with-a-long-random-secret
```

Behavior:

- `/login` shows the sign-in screen
- the app sets an `httpOnly` session cookie after successful login
- the workspace page and protected CRUD APIs require that session
- `POST /api/n8n/callback` stays open for automation callbacks and continues to rely on the callback secret flow

For local development, these values now exist in `.env.local`. Change them before exposing the app publicly.

## Local n8n Integration

Default local webhook:

```text
http://localhost:5678/webhook/estala-project-events
```

Optional env vars:

```bash
N8N_WEBHOOK_URL=http://localhost:5678/webhook/estala-project-events
N8N_CALLBACK_SECRET=change-me
```

To use the included workflow:

1. Import `n8n/workflows/estala-project-events.json` into local `n8n`.
2. Activate the workflow.
3. Run the app.
4. Open a task and click `Send to n8n`.

## Notes For Future Work

- This repo uses a newer `Next.js 16` release with breaking changes. Read relevant docs in `node_modules/next/dist/docs/` before major framework edits.
- Do not copy secrets into tracked markdown files.
- The PM app lives in `EstalaProjectManager`; the root domain site lives in the sibling `web` project.

## Suggested Next Steps

1. Replace shared credentials with per-user auth and workspace membership.
2. Add file upload and attachment management.
3. Improve mobile UX so project switching and task actions surface sooner above the fold.
4. Add richer task editing, comments, checklist editing, and due-date workflows.
5. Add admin/settings views for clients, templates, and permissions.
