# Vercel Setup

This project is ready for a GitHub-connected Vercel Hobby deployment.

## Recommended setup

1. In Vercel, choose **Add New Project**
2. Import the GitHub repository:
   - `estalav/madeinm_0A1`
3. Set the root directory to:
   - `web`
4. Framework preset:
   - `Next.js`

## Environment variables

Add these in the Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_REVIEW_KEY`

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` must only be used in server routes.
- `ADMIN_REVIEW_KEY` should be a long random string used only by the admin review screen.
- The app already follows that rule with:
  - `/api/recognize`
  - `/api/draft-products`
  - `/api/admin/drafts`
  - `/api/admin/review`
- For preview deployments on Hobby, this setup is enough.

## After deploy

Test these URLs first:

- `/`
- `/scan`
- `/scan?mode=guest`

Then test:

- a catalog product like `Jitomate Saladet`
- an outside-catalog product that should offer a draft suggestion
- `/admin` with your private admin review key
