# Project Context

## Repository

- Primary repo: `EstalaProjectManager`
- Current path: `/Users/estalav/Documents/CODEX_Projects_Estala.com/EstalaProjectManager`
- App type: `Next.js 16` App Router project with `React 19`
- Important rule from `AGENTS.md`:
  - this is a newer Next.js version with breaking changes
  - check relevant docs in `node_modules/next/dist/docs/` before major framework edits

## Product Direction

- Goal: build a collaborative project manager for Estala
- Core product direction:
  - multi-project workspace
  - project phases, health, and progress
  - kanban-style task management
  - files / notes
  - local `n8n` automation handoff
  - shared hosted backend
- Desktop direction:
  - same project should work on the hosted web app
  - and in a local macOS wrapper through Tauri

## Current Functional Status

The app now supports real CRUD for the main project management flows:

- project create
- project update
- project delete
- task create
- task update
- task delete
- task status cycling
- task filtering by:
  - search
  - status
  - priority

The app also still supports:

- board view
- timeline view
- files view
- task detail panel
- `n8n` automation send action from the selected task

## Latest QA / Verification Status

Latest confirmed working state:

- `npm run lint` passed
- `npm run build` passed
- Supabase-backed CRUD was tested against the real local dev server
- temporary QA project/task records were created, updated, and deleted successfully
- manual visual QA was run on:
  - desktop at `http://localhost:3001`
  - mobile viewport equivalent to iPhone 13

Visual QA findings:

- desktop layout is working
- no framework error overlay was present
- project and task forms open correctly
- filter empty state works correctly
- mobile layout is functional and stacks vertically
- mobile is usable, but the first viewport is sidebar-first, so mobile UX polish is still a sensible future improvement

## Backend / Database

- Shared backend uses Supabase when env vars are present
- Local fallback uses `data/workspace.json` when Supabase is missing
- Supabase project in use:
  - `https://gdiefcfabsobzfsllhup.supabase.co`
- Production and local app were configured to use this project
- Schema and seed were already applied successfully

### Important backend files

- `src/server/supabase.ts`
- `src/server/workspace-store.ts`
- `src/server/local-workspace-store.ts`
- `supabase/migrations/20260628140000_init.sql`
- `supabase/seed.sql`
- `.env.local`

### Current storage/API shape

Routes currently implemented:

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

Files directly involved in CRUD work:

- `src/app/api/projects/route.ts`
- `src/app/api/projects/[projectId]/route.ts`
- `src/app/api/projects/[projectId]/tasks/route.ts`
- `src/app/api/tasks/[taskId]/route.ts`
- `src/server/workspace-store.ts`
- `src/server/local-workspace-store.ts`
- `src/components/workspace-app.tsx`

### Credentials

- Supabase URL, publishable key, and service credentials were provided earlier
- They were already added where needed:
  - local `.env.local`
  - Vercel environment variables
- Do not duplicate raw secrets in tracked docs

## n8n Context

- Local `n8n` instance:
  - `http://localhost:5678/home/workflows`
- The PM app includes an automation panel to send the selected task into local `n8n`
- An `n8n` API key was shared earlier in the session history
- Do not re-copy the raw key into docs

## Vercel / Deployment

- Vercel account/team in use:
  - account: `estalav`
  - team: `estalavs-projects`
- PM app Vercel project:
  - name: `estala-project-manager`
  - production URL: `https://estala-project-manager.vercel.app`
- Local Vercel link exists in `.vercel/project.json`

Configured Vercel env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Desktop / Mac App Work

- Tauri support has already been scaffolded
- Rust was installed
- Desktop shell and native integration exist

### Desktop features implemented

- app shell in `src-tauri/`
- macOS app bundle generation
- native menu actions
- deep link handling
- single-instance behavior
- remembered window state
- browser handoff

### Important desktop files

- `src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/default.json`
- `desktop-shell/index.html`
- `src/app/page.tsx`
- `src/components/workspace-app.tsx`
- `package.json`

### Desktop scripts

- `dev:desktop:web`
- `desktop:dev`
- `desktop:build`

### Desktop runtime notes

- `desktop:dev` starts the local web app on port `3001`
- packaged mode opens the live hosted app
- if another `next dev` instance for the same repo is already active in a conflicting way, stop that process before retrying `desktop:dev`

### Desktop build status

- Desktop build succeeded earlier
- Generated app bundle:
  - `/Users/estalav/Documents/CODEX_Projects_Estala.com/EstalaProjectManager/src-tauri/target/release/bundle/macos/Estala Project Manager.app`

## UI / UX Status In This Repo

- Earlier overlapping-card layout bug was fixed
- Main UI work continues in:
  - `src/components/workspace-app.tsx`

Current UI state now includes:

- left sidebar with project switching and project creation
- project edit and delete actions
- task create/edit/delete actions
- task filter section
- empty-state handling when no tasks match filters
- empty-state handling when no projects exist

Known UX note:

- mobile layout is functionally correct, but the first viewport is sidebar-first, so mobile prioritization can still be improved

## Domain / Site Architecture Decisions

- User wants `estala.io` as the central entry point
- preferred direction:
  - root domain as central hub
  - each project on its own subdomain

### Current domain structure

- `estala.io`
  - central hub / landing page
- `www.estala.io`
  - same root-site project as `estala.io`
- `pm.estala.io`
  - dedicated PM app entry
- `madeinm.estala.io`
  - separate product site

## Root Site (`web` sibling project) Context

- The root domain site is not this repo
- It lives in sibling project:
  - `/Users/estalav/Documents/CODEX_Projects_Estala.com/web`
- Vercel root-domain project:
  - `madeinm-0-a1-si9m`

### Root site work already completed

- `estala.io` redesigned toward a darker blue product-style landing page
- Art section removed from the hub
- `/art` redirects to `https://estala.com`
- navigation includes:
  - Home
  - Project Manager
  - MadeinM
  - Estala.com

## Current Live Status

- Project Manager web app is live and using Supabase
- `pm.estala.io` points to the PM app
- `estala.io` is live as the central landing page
- `madeinm.estala.io` remains live
- `estala.io/art` redirects to `https://estala.com`

## Important Constraints / Habits

- Avoid copying secrets into tracked markdown files
- Use `apply_patch` for manual file edits
- Prefer `rg` for file/text search
- For this repo specifically, check local Next.js 16 docs before major framework edits
- Be careful not to confuse:
  - `EstalaProjectManager`
  - sibling `web` repo for `estala.io`

## Suggested Starting Points For Next Session

If continuing in the PM app, the best next areas are:

1. improve mobile UX so the main workspace actions surface sooner
2. add authentication and workspace membership
3. add attachment upload/download flows
4. add richer task editing and comments
5. add admin/settings areas for clients, templates, and permissions
