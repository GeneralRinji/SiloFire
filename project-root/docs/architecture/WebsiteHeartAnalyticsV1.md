# Website Heart Analytics V1

This document describes the current website-level heart analytics feature and the separate admin view used to inspect it.

For the shortest setup path, see `../AdminAnalyticsQuickstart.md` first.

This is not gameplay state.

Heart analytics are website telemetry attached to nodes so the project owner can see what public content is landing well.

## Purpose

The public site exposes a lightweight heart control beneath node navigation.

The admin surface exposes ranked project totals, per-node heart counts, and a read-only inspection view of current runtime-derived state.

This feature exists to answer questions like:

- which projects are drawing the most appreciation
- which nodes inside a project are receiving hearts
- what authored/runtime state is currently associated with a project while reviewing that analytics data

## Public Behavior

The public control is intentionally lightweight.

Current behavior:

- the control appears beneath node navigation on projected pages
- the label is `Show this node some love (analytics only)`
- toggling on sends a heart for the current node
- toggling off removes that heart from analytics
- this is analytics behavior, not gameplay progression

The server treats the heart route as explicit set/unset behavior:

- `POST /api/runtime-heart/:projectId/:nodeId` adds a heart
- `DELETE /api/runtime-heart/:projectId/:nodeId` removes a heart

The response payload is the current stored count for that node after the update.

## Admin Behavior

The admin UI is a separate route family.

Current routes:

- `/admin`
- `/admin/projects/:projectId`

Current admin flow:

- `/admin` shows a password gate first
- after unlock, the overview ranks projects by total hearts
- selecting a project shows per-node heart counts, a plain node list, and state inspection panes
- the admin project page intentionally does not expose public gameplay `open/<node>` links
- project totals can be reset manually from the admin project page

The admin surface is password-gated, not private-by-network.

That means:

- the route can exist on a public deployment
- analytics data is only returned when the correct admin password is supplied
- production safety depends on secret handling and deployment configuration

## Data Ownership

Heart analytics are server-owned website data.

They should not be treated as authoritative gameplay state.

Keep these boundaries:

- the client renders the heart control and sends the intended on/off state
- the server owns the stored counts
- the admin overview and project detail screens read server-owned analytics
- resetting hearts is an admin/server operation

## Local Development Setup

For local Vite development, the admin password lives in:

- `project-root/apps/web/.env.local`

Example:

```env
SILOFIRE_ADMIN_PASSWORD=change-me
```

Notes:

- `.env.local` is local-only and should not be committed
- `project-root/apps/web/.env.example` is the checked-in reminder template
- the Vite dev server reads `SILOFIRE_ADMIN_PASSWORD` from the local env file

Local analytics persistence:

- heart analytics are stored under `project-root/.silofire/runtime-hearts`
- runtime session snapshots are stored under `project-root/.silofire/runtime-snapshots`

If local analytics need to be reset, clear the persisted heart store under `project-root/.silofire/runtime-hearts`.

## Production Setup For Deno Deploy

For production on Deno Deploy, do not put the password in the repository.

Set the password as an environment variable or secret in the Deno Deploy app settings:

- `SILOFIRE_ADMIN_PASSWORD`

Production source of truth:

- `scripts/serve_static.ts` reads `Deno.env.get('SILOFIRE_ADMIN_PASSWORD')`
- the same server stores heart analytics in Deno KV
- the same server stores runtime snapshots in Deno KV

Practical production checklist:

1. Add `SILOFIRE_ADMIN_PASSWORD` in the Deno Deploy dashboard.
2. Redeploy the application.
3. Visit `/admin` on the deployed site.
4. Enter the configured password in the admin gate.

## What The Admin Screen Shows

The overview screen shows:

- project title
- project id
- total heart count
- node count

The project detail screen shows:

- total hearts for the project
- nodes sorted by heart count
- a plain current node list for reference
- runtime-derived clock, weather, ambient NPC, NPC state, and object state panes

The admin screen is intended for inspection and ranking, not for public play navigation.

## Current Security Model

Current model:

- shared password gate
- browser sends the password to admin endpoints via request header
- server rejects unauthorized admin requests

This is adequate for a lightweight owner-only admin surface, but it is not equivalent to full user authentication.

Do not describe it as strong auth.

Describe it as:

- password-gated admin analytics

## AI Handoff Notes

If an AI assistant is extending this feature, it should assume:

- public heart controls are website analytics controls, not gameplay mechanics
- admin analytics are a separate route family from public content play
- counts are server-owned
- local dev passwords belong in `project-root/apps/web/.env.local`
- production passwords belong in the Deno Deploy dashboard, not the repo
- Deno Deploy persistence uses Deno KV

The AI should not assume:

- browser-local heart counts are authoritative
- the admin page should expose spoiler navigation links
- production secrets belong in tracked files
- heart analytics are the same thing as player save data or gameplay state