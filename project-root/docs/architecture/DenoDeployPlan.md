# Deno Deploy Plan

This document records the current feasibility and migration shape for hosting Silofire on Deno Deploy.

It is a planning reference, not a promise that the app is deploy-ready today.

## Short Answer

Deno Deploy looks like a plausible hosting target for `silofire.net`.

The current app is not ready to deploy there as a pure static site.

The reason is simple: the current web app depends on runtime endpoints that only exist inside the Vite development server plugin.

## Current State

The frontend is a Vite and React app.

The current local development experience works because `project-root/apps/web/vite.config.ts` injects runtime endpoints during dev.

Those endpoints currently include:

- `/api/runtime-clock/<projectId>`
- `/api/runtime-clock/<projectId>/stream`
- `/api/runtime-weather/<projectId>/stream`
- `/api/runtime-ambient/<projectId>/stream`

The client consumes those endpoints through `EventSource`-based subscriptions and runtime snapshot helpers.

That means the current build is not just a static site with optional API calls elsewhere.

It expects a server runtime to exist.

## Why Deno Deploy Still Makes Sense

Deno Deploy is still a strong candidate because:

- it supports static sites
- it supports server applications
- it can host JavaScript and TypeScript runtimes directly
- it is a better fit for server-authoritative direction than trying to preserve a browser-only model

This aligns with the current architecture direction in `AGENTS.md`.

## Main Blocker

The main blocker is that production runtime behavior is currently embedded in Vite dev-server middleware rather than in a standalone server entrypoint.

That creates two problems:

1. local dev works because Vite is doing double duty as app server and runtime server
2. production hosting has no real server module to deploy yet

## Required Refactor

Before Deno Deploy can be a proper hosting target, move runtime endpoint behavior out of `project-root/apps/web/vite.config.ts` and into a dedicated server module.

That module should own:

- runtime clock snapshot endpoints
- runtime weather snapshot and stream endpoints
- runtime ambient NPC stream endpoints
- shared project-content loading logic needed by those endpoints

The Vite config should stop being the place where production-like server behavior lives.

## Recommended Deployment Shape

Preferred shape:

1. build the React frontend as static assets
2. run authoritative runtime endpoints from a real server entrypoint
3. deploy both under Deno Deploy so the browser talks to actual production endpoints

Two likely implementation options exist.

### Option A: Single Deno Deploy App

One app serves:

- static frontend assets
- API routes
- SSE streams

This is the simplest mental model.

It also fits the long-term architecture better if Silofire is moving toward stronger server authority.

### Option B: Static Frontend Plus Separate Runtime App

Split hosting into:

- one static site deployment for the frontend
- one Deno Deploy app for runtime APIs and streams

This is workable, but it adds CORS, routing, and deployment coordination overhead.

Unless there is a strong reason to split them, Option A is probably cleaner.

## Architecture Guidance

When doing this refactor:

- do not preserve Vite dev middleware as the production runtime model
- do not patch production hosting by hardcoding fake browser-side fallbacks
- keep runtime logic testable outside React
- keep server-owned state and live simulation on the server side
- keep the client focused on rendering, intent dispatch, and subscription updates

## Immediate Next Steps

1. Extract the runtime route logic from `project-root/apps/web/vite.config.ts` into a dedicated server module.
2. Define the production server entrypoint shape for Deno Deploy.
3. Decide whether static asset serving and runtime APIs live in one app or two.
4. Verify SSE behavior works on the chosen Deno Deploy setup.
5. Replace any client assumptions that only hold in Vite dev mode.

## Open Questions

- Should Deno Deploy be the permanent runtime host, or just the first production target?
- Do clock, weather, and ambient streams remain SSE, or should any of them become a different transport later?
- How much of the current dev-only content loading should be preserved versus replaced by a more explicit production content-loading model?
- When multiplayer login arrives, does the same Deno Deploy app own auth and session handling as well?

## Current Conclusion

Deno Deploy is likely viable.

Silofire is not blocked by the platform.

Silofire is blocked by needing a real production server boundary instead of relying on Vite development middleware.