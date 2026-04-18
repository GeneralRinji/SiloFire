# App Session State v1

This document is the working reference for browser-only run state that exists above pure runtime projection.

Use it when changing save and continue flows, recent log behavior, per-node visit state, or route replacement logic in the web app.

It complements Runtime Composition, not replaces it.

## Why This Exists

The runtime core already owns authored navigation semantics.

That includes:

- gate direction resolution
- passthrough routing
- path traversal mode selection
- path and gate back-control resolution
- node-entry event evaluation
- projected page selection from authored content

The browser app still needs session state that is not part of authored content itself.

That state had started to accumulate directly inside App.tsx.

This document makes the boundary explicit so future gate and path work does not drift back into ad hoc shell logic.

## Browser-Owned Session State

The app session layer owns only run-local state needed to drive the current browser experience:

- current project route
- per-project history stack
- per-project Area and Gate visit counts
- per-project Path visit counts
- per-node recent log entries
- per-node action attempt counts
- persisted save snapshots
- lightweight UI baselines such as last displayed weather announcement per project

This is browser state because it is about the player session, not about authored node meaning.

Important boundary:

- app-session may remember prior route snapshots for save and restore bookkeeping
- app-session must not invent navigation semantics such as a browser-history-style `back` fallback
- if a control changes location, runtime/authored resolution must say where it goes

## What Must Stay Out Of The App Session Layer

Do not put these in the app session layer:

- gate passthrough semantics
- path direction inference
- one-way gate or path validation
- blocked gate or path routing rules
- gate or path `back` destination rules
- authored visibility rules for weather, time, or ambient systems
- prose selection rules that belong to runtime interpretation

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

This module owns persisted snapshot policy and local storage serialization.

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

Save and continue should restore browser session state, not reinterpret authored traversal rules differently.

That means restore should preserve:

- active node id
- path direction
- path beat index
- run nonce
- history
- visit counts
- recent log
- action attempt counts
- session state

Any normalization of that data should happen in dedicated session helpers rather than inline in React effects.

## Weather Announcement Policy

Weather announcement behavior is app-session policy, not projected node content.

Current rule set:

- initial game start may announce current weather once if the destination node allows weather visibility
- continue may announce current weather once if the restored node allows weather visibility
- same-node weather changes may announce when the visible weather state meaningfully changes
- moving from one weather-visible node to another weather-visible node must not repeat the same weather message if the state is unchanged
- moving from a weather-hidden node to a weather-visible node may announce the current weather once on re-entry to visibility

This rule exists because the player is re-entering weather visibility, not because node traversal itself should spam state.

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