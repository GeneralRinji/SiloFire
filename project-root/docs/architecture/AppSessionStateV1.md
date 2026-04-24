# App Session State v1

This document is the working reference for client-side app/session concerns above pure runtime projection.

Use it when changing save and continue flows, recent log behavior, per-node visit state, or route replacement logic in the web app.

It complements Runtime Composition, not replaces it.

For gameplay-facing rules about visible text, recent text, weather, ambient events, restore behavior, and ownership boundaries, see `SessionBehaviorRulesV1.md`.

## Why This Exists

The runtime core already owns authored navigation semantics.

That includes:

- gate direction resolution
- passthrough routing
- path traversal mode selection
- path and gate back-control resolution
- node-entry event evaluation
- projected page selection from authored content

The browser app still needs client-side state that is not part of authored content itself.

That state had started to accumulate directly inside App.tsx.

This document makes the boundary explicit so future gate and path work does not drift back into ad hoc shell logic.

## Client-Owned App State

The client app/session layer should own only state needed to render and orchestrate the current client experience:

- display-only route/view state
- keyboard and focus handling
- debug and inspection pane state
- renderer-local stabilization needed to avoid remounting visible prose unnecessarily
- subscribed live snapshots mirrored from the server for rendering
- lightweight UI baselines such as last displayed weather announcement per project

This is client state because it affects presentation and orchestration, not gameplay truth.

Important boundary:

- the client may cache subscribed snapshots, but those snapshots are mirrors of server truth rather than authority
- the client must not invent navigation semantics such as a browser-history-style `back` fallback
- if a control changes location, runtime/authored resolution must say where it goes

## Migration Target

Current code still contains older browser-managed run/session artifacts.

Treat these as migration targets rather than the desired boundary:

- browser-managed history stacks
- browser-managed visit counts
- browser-managed action attempt counts
- browser-managed save/continue authority
- browser-managed runtime session state

These values affect traversal, projection inputs, or persistence and should move behind a server/runtime session boundary as the architecture continues to shift toward server authority.

## What Must Stay Out Of The App Session Layer

Do not put these in the app session layer:

- gate passthrough semantics
- path direction inference
- one-way gate or path validation
- blocked gate or path routing rules
- gate or path `back` destination rules
- authored visibility rules for weather, time, or ambient systems
- prose selection rules that belong to runtime interpretation
- visit-count authority that affects authored prose selection
- action-attempt authority that affects authored outcomes
- canonical traversal position or run progression
- authoritative save/continue persistence

Those belong in runtime helpers or deeper authored/runtime layers where they can be tested without React.

## Current Code Split

Current browser session code is split across:

- apps/web/src/App.tsx
- apps/web/src/saveState.ts
- apps/web/src/recentLog.ts
- apps/web/src/projectSession.ts

### projectSession.ts

This module is the normalization layer for app-session bookkeeping.

It currently owns:

- project route construction
- project node-id collection
- selecting project-scoped node maps
- replacing project-scoped node maps without touching other projects

If more run replacement logic appears, prefer extracting it here before adding more inline object surgery to App.tsx.

### saveState.ts

This module currently owns persisted snapshot policy and local storage serialization.

That is current implementation, not long-term architectural intent.

Browser-local persistence should be treated as optional convenience tooling rather than the primary authority boundary.

It should stay ignorant of React.

### recentLog.ts

This module owns duplicate suppression and capped recent-log accumulation.

It should stay ignorant of project routing rules.

## Gate And Path Safety Rule

When new gate or path content exposes a bug, first ask which layer is actually wrong.

Use this rule:

- if the bug is about how authored nodes resolve, it belongs in runtime
- if the bug is about how the browser preserves or restores run-local state, it belongs in app-session helpers

Do not patch authored traversal bugs with extra App.tsx flags.

Do not patch traversal bugs with client-side history fallback.

## Save And Continue Expectations

Current code saves and restores browser session state.

That behavior should be treated as transitional.

The target model is that save and continue restore authoritative session state without requiring the browser to be the source of truth for traversal or authored outcomes.

While the current implementation preserves the following locally, these are the values expected to move to server/session ownership over time:

- active node id
- path direction
- path beat index
- run nonce
- visit counts
- recent log
- action attempt counts
- session state

Any temporary client-side normalization of that data should happen in dedicated session helpers rather than inline in React effects.

## Weather Announcement Policy

Weather announcement behavior is app-session policy, not projected node content.

The detailed rule set lives in `SessionBehaviorRulesV1.md`.

Keep the implementation boundary here simple:

- do not bake weather prose into authored visible text
- do not let rerenders or remounts replay weather prose
- treat weather announcements as recent-log behavior governed by the session behavior contract

## Projection And Debug UI Boundary

Do not bake weather announcement prose into projected page prose.

Projected node content should stay about authored node content plus runtime projection concerns such as prose selection.

Live state refreshes such as clock phase, weather, or other runtime state may change available controls or recent-log state without replaying visible node-enter prose.

If the app needs navigation timing to refresh after a live-state update, refresh navigation timing only. Do not remount the whole projected page just to update controls.

Do not make debug or sidebar status boxes part of runtime behavior.

Debug UI may show structured current state for humans, but game behavior must not depend on those components or on props passed only for inspection.

## Practical Refactor Rule

If App.tsx starts doing any of the following more than once, extract a helper:

- route object reconstruction
- filtering maps down to project node ids
- replacing one project's node-scoped entries inside a global map
- save snapshot shaping
- start or continue restoration normalization

If App.tsx is deciding visit semantics, attempt semantics, traversal progression, or persisted run truth, move that responsibility out of the client instead of extracting a bigger helper.