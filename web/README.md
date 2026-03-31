## Web App

This folder contains the `Next.js` frontend for the MadeinM pilot.

It currently includes:

- a basic Supabase server client
- environment-based Supabase configuration
- a branded homepage connected to `product_summary`
- a scan/upload flow with guest and authenticated modes
- result pages with trust labels and manual product confirmation
- an optional AI suggestion route at `/api/recognize`

## Local Setup

Create `web/.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-api-key
```

You can copy from [`web/.env.example`](/Users/estalav/Documents/CODEX_Projects_Estala.com/web/.env.example).

`OPENAI_API_KEY` is optional. Without it, the app still works, but the AI suggestion button on scan results will return a friendly configuration message instead of a product suggestion.

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

## Recognition Flow

Today the scan experience works like this:

- upload a product image
- store the scan in Supabase
- open a result page with the uploaded image
- try an exact barcode-based match when a barcode is available
- let the user confirm the correct product manually
- optionally ask the AI route for a suggested catalog match

The AI route is intentionally advisory. It suggests a candidate and reasoning, but the user still confirms the final match.

## Next Steps

- connect OCR and stronger barcode extraction
- persist AI suggestions and confidence evidence
- improve the mobile-first camera flow
- add richer product detail, nutrition, and recipe screens

## Reference

Project-level setup and architecture notes live in the repository root `README.md`.
