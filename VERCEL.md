# Deploying on Vercel

The frontend and API are deployed together. The API handler is available whether
the Vercel project Root Directory is the repository root or `client`.

## Configure the database

Vercel function filesystems are temporary, so appointments use Supabase instead
of the local SQLite database:

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql),
   and run it. This creates the tables, seeds services/dentists/times, and locks
   down public access with Row Level Security.
3. In Supabase, open **Project Settings → API** and copy the **Project URL** and
   the **service_role** key.
4. In Vercel, open the project's **Settings → Environment Variables** and add:
   - `SUPABASE_URL` — the project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — the service_role key (server-side only)
   for Production (and Preview if you use preview deployments).
5. Remove `VITE_API_URL` or set it to `/api` so the frontend calls the Vercel
   functions in this project.
6. Redeploy the project.

> The service_role key bypasses Row Level Security and must never be exposed to
> the browser. It is only read by the serverless handler.

To send confirmation emails, also set `RESEND_API_KEY` and, optionally,
`FROM_EMAIL` in Vercel.

For local development, `npm run dev` continues to use the Express server and
SQLite database; it does not need Supabase credentials.
