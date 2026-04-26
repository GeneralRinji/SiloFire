# Admin Analytics Quickstart

Use this file when you need the shortest path to getting website heart analytics working locally or in production.

## What This Feature Is

Silofire has a public heart control on project nodes and a separate `/admin` route for website analytics.

The public control records hearts per node.

The admin route shows:

- projects ranked by total hearts
- per-node heart counts inside each project
- runtime inspection panes for the selected project

## Local Dev

Put the password in:

- `project-root/apps/web/.env.local`

Example:

```env
SILOFIRE_ADMIN_PASSWORD=change-me
```

Then run:

```powershell
npm --prefix ./project-root/apps/web run dev
```

Then:

1. Open the site.
2. Click a heart on a public node.
3. Visit `/admin`.
4. Enter the same password from `.env.local`.

Local persisted analytics live in:

- `project-root/.silofire/runtime-hearts`

If local counts get confusing during development, clear that folder to reset local analytics back to zero.

## Production On Deno Deploy

Do not put the production password in the repo.

Instead, in the Deno Deploy app dashboard:

1. Open the app.
2. Go to `Settings`.
3. Open `Environment Variables and Secrets`.
4. Add:

```env
SILOFIRE_ADMIN_PASSWORD=change-me
```

5. Save it.
6. Redeploy the app.

After deploy:

1. Open the production site.
2. Go to `/admin`.
3. Enter the same password you saved in Deno Deploy.

## Where To Look Later

If you forget where this is wired:

- local dev password template: `project-root/apps/web/.env.example`
- local dev actual password: `project-root/apps/web/.env.local`
- production password source: Deno Deploy dashboard secret `SILOFIRE_ADMIN_PASSWORD`
- detailed architecture reference: `project-root/docs/architecture/WebsiteHeartAnalyticsV1.md`

## AI Handoff Shortcut

If an AI is helping with this feature, tell it:

- heart analytics are website analytics, not gameplay state
- local Vite uses `project-root/apps/web/.env.local`
- production Deno Deploy uses the `SILOFIRE_ADMIN_PASSWORD` environment variable
- local analytics persistence is `project-root/.silofire/runtime-hearts`
- admin analytics live at `/admin`