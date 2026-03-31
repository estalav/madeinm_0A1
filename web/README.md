## Web App

This folder contains the `Next.js` frontend for the MadeinM pilot.

It currently includes:

- a basic Supabase server client
- environment-based Supabase configuration
- a connection check homepage that reads from `product_summary`

## Local Setup

Create `web/.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Purpose

This app will evolve into the public-facing experience for:

- product search
- image and barcode-based identification
- origin confidence display
- recipe and nutrition discovery
- rewards and badges

## Next Steps

- connect storage for uploaded product images
- add the first branded landing and scan experience
- add real search and product detail screens
- introduce auth-aware user flows for favorites and rewards

## Reference

Project-level setup and architecture notes live in the repository root `README.md`.
