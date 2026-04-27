# Silofire Agent Notes

## Purpose

This file is the working reference for future agent sessions and refactors.

Use it to recover the intended architecture quickly when docs or code have drifted.

## Project Summary

Silofire is an old-school text MUD-style project built with a web UI instead of a terminal UI.

The browser client exists because HTML and React are faster to iterate on, easier to inspect, and better for real-time feedback during development.

This is not a browser-first architecture where the client owns game truth.

## Current Architectural Direction

- The client is a React and HTML presentation shell. Do not store stuff in the client, we have a server for that.
- The server is the authoritative source for stateful behavior.
- Multiplayer correctness matters more than preserving older browser-only patterns.
- Separation of concerns matters more than short-term convenience.

## Authority Boundaries

### Server-Owned Responsibilities

These should live on the server unless there is a very explicit reason not to:

- player session state
- world state
- multi-player interaction state
- authoritative action resolution
- event effects and state mutation
- ambient simulation state
- clock and weather truth
- persistence across sessions
- consistency rules between players

### Client-Owned Responsibilities

The browser app should stay focused on:

- rendering projected pages and UI state
- collecting player intent
- sending actions and controls to the server
- subscribing to live updates
- showing debug and inspection views
- handling temporary display-only concerns

The client should not quietly become the source of truth for gameplay state.

## Refactor North Star

When refactoring, prefer moving toward this shape:

1. Content parsing and interpretation remain domain/runtime concerns.
2. Runtime rules stay testable outside React.
3. React components become thinner orchestration and display layers.
4. Server APIs and streams own authoritative live state.
5. Browser-local persistence is optional tooling, not a core runtime dependency.

## Known Drift In Current Code

Parts of the current web app still reflect an older browser-managed model.

Treat these as likely drift unless a new decision explicitly keeps them:

- browser-managed history stacks
- local save and continue snapshots in localStorage
- browser-owned visit counters as gameplay-significant state
- browser-owned action attempt tracking as authoritative state
- client-side page caching as a design assumption

Current code may still contain these patterns in `apps/web/src/App.tsx`, `apps/web/src/saveState.ts`, `apps/web/src/projectSession.ts`, and `apps/web/src/pageSelection.ts`.

That does not automatically mean they are still desired architecture.

## Interpreting The Existing Docs

The docs in `project-root/docs/architecture` are useful, but they may not be fully current.

Use them as reference material for vocabulary, content model, and prior intent.

Do not assume they fully describe the current desired client/server boundary.

If code and docs disagree, prefer:

1. current architectural intent from this file
2. verified behavior in code
3. older docs as historical context

## Agent Rules For This Repo

- Do not reintroduce browser fallback history as a substitute for proper runtime navigation.
- Do not add client-side caches or persistence layers unless there is a clear, current requirement.
- Do not patch server-authority problems by hardcoding state in React.
- Keep domain logic out of UI components whenever practical.
- Keep parsing, interpretation, projection, and runtime rules testable without React.
- Prefer explicit boundaries and data flow over hidden convenience state.
- When docs and code conflict, call out the conflict directly.
- When refactoring, fix the architecture at the boundary instead of layering another workaround on top.

## Practical Guidance For Future Sessions

Before making architecture-sensitive changes:

1. Check whether the state in question is authoritative gameplay state or display-only state.
2. If it affects multiplayer correctness, treat it as server-owned by default.
3. If it is pure rendering or inspection behavior, keep it in the client.
4. If the existing app shell already does too much, prefer extracting or deleting responsibilities rather than extending them.

## Why This Changed

The initial plan tried to avoid server-side state.

That stopped fitting once correct state handling mattered across multiple players.

Server-side authority is now the intended direction, even if some older client-side structures are still present in the codebase.