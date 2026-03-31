# MadeinM 0A1

MadeinM is the starting repository for a consumer platform focused on helping people identify, value, and support products that are grown, produced, or made in Mexico.

The first pilot is centered on `Central de Abasto CDMX` and is designed as:

- a `web app` first
- a future `SwiftUI iOS app`
- a `Supabase` backend shared by both
- a trust-first data model that never fakes product origin

## Current Scope

This repository already includes:

- a first `Supabase` schema draft
- a starter seed dataset for the pilot market
- a `Next.js` web app with upload, scan result pages, trust labels, and optional AI suggestion hooks
- a `SwiftUI` iOS pilot app connected to the public catalog in Supabase

## Repository Structure

- [`docs/supabase-schema.sql`](/Users/estalav/Documents/CODEX_Projects_Estala.com/docs/supabase-schema.sql): core database schema for products, origin evidence, prices, recipes, rewards, and classification runs
- [`docs/supabase-seed.sql`](/Users/estalav/Documents/CODEX_Projects_Estala.com/docs/supabase-seed.sql): starter pilot data for `Central de Abasto CDMX`
- [`docs/automatic-recognition-plan.md`](/Users/estalav/Documents/CODEX_Projects_Estala.com/docs/automatic-recognition-plan.md): plan for barcode, OCR, AI, and confidence-based product recognition
- [`web`](/Users/estalav/Documents/CODEX_Projects_Estala.com/web): Next.js app that connects to Supabase
- [`ios`](/Users/estalav/Documents/CODEX_Projects_Estala.com/ios): SwiftUI app prototype for catalog browsing and mobile scan confirmation

## Product Principles

- Never fake origin information
- Show confidence and evidence behind product classification
- Start with a focused pilot before scaling across Mexico
- Build reusable backend foundations for both web and iOS

## Supabase Setup

1. Create a Supabase project
2. Run [`docs/supabase-schema.sql`](/Users/estalav/Documents/CODEX_Projects_Estala.com/docs/supabase-schema.sql) in the Supabase SQL Editor
3. Run [`docs/supabase-seed.sql`](/Users/estalav/Documents/CODEX_Projects_Estala.com/docs/supabase-seed.sql)
4. Copy the project URL and `anon` key into `web/.env.local`

Expected env vars:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5-mini
```

`OPENAI_API_KEY` is only required when you want to enable the optional AI suggestion endpoint at `/api/recognize`.
`OPENAI_MODEL` is optional. The app defaults to `gpt-5-mini`, which OpenAI documents as a faster, cost-efficient model that supports image input through the Responses API.

## Running the Web App

From [`web`](/Users/estalav/Documents/CODEX_Projects_Estala.com/web):

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Current Phase 1 Status

- Supabase schema, seed data, RLS, and storage policies are in place
- the web app supports guest preview, authenticated uploads, result pages, and manual confirmation
- the web result page can use a barcode exact match when available
- an optional AI suggestion route is ready, pending `OPENAI_API_KEY`
- the iOS app can browse the pilot catalog and test a simple scan-confirmation flow

## Next Recommended Steps

- activate and test AI suggestions with a real `OPENAI_API_KEY`
- add OCR and barcode extraction as stronger first-pass signals
- persist iOS scan confirmations to Supabase instead of keeping them local
- prepare an HTTPS deployment for phone-first testing
