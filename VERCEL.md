# Deploying on Vercel

The frontend and API are deployed together. The API handler is available whether
the Vercel project Root Directory is the repository root or `client`.

## Configure the database

Vercel function filesystems are temporary, so appointments use Neon Postgres
instead of the local SQLite database:

1. Create a Neon Postgres project and copy its connection string.
2. In Vercel, open the project's **Settings → Environment Variables**.
3. Add `DATABASE_URL` with the Neon connection string for Production (and Preview
   if you use preview deployments).
4. Remove `VITE_API_URL` or set it to `/api` so the frontend calls the Vercel
   functions in this project.
5. Redeploy the project.

The API creates its tables and initial services, dentists, and appointment times
on the first request. To send confirmation emails, also set `RESEND_API_KEY` and,
optionally, `FROM_EMAIL` in Vercel.

For local development, `npm run dev` continues to use the Express server and
SQLite database; it does not need `DATABASE_URL`.
