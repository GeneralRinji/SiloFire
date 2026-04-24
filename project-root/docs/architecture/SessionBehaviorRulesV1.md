# Session Behavior Rules v1

This document is the working behavior contract for gameplay-facing session state.

Use it when changing save and continue behavior, recent-log semantics, weather and ambient announcements, or the boundary between runtime truth and renderer orchestration.

This file is intentionally short.

If code and older docs disagree, this file describes the behavior the app should converge toward.

## Canonical Page Truth

The client is not allowed to compose gameplay prose.

The canonical gameplay-facing page should come from the authoritative session/runtime layer.

The client may still own:

- layout and component structure
- keyboard and focus behavior
- debug and inspection UI
- renderer-local refresh behavior needed for live updates

The client must not invent or replay gameplay-significant prose on top of canonical session output.

## Visible Text vs Recent Text

The system supports two gameplay-facing text lanes with different jobs.

### Visible Text

Visible text is the primary prose surface.

Use it for:

- authored node entry prose
- longer story-facing prose
- action-result prose the player should be able to read without status noise pushing it aside

### Recent Text

Recent text is the status/event lane.

Use it for:

- weather announcements
- ambient arrival and departure events
- other frequent, system-generated status-like updates that should not clutter visible prose

The runtime/projection layer now has an explicit `lane` concept for emitted log entries.

Current values are `visible` and `recent`.

This is runtime metadata, not a direct markdown source field for authors.

## Behavior Rules

### Authored Node Entry Prose

- authored node entry prose belongs in visible text
- it shows when the authored node entry actually happens
- it must not replay solely because the renderer rerendered or remounted

### Action Result Prose

- authored POI result prose belongs in recent text by default
- authored choice result prose belongs in visible text by default
- repeatable actions may legitimately produce different authored results on later attempts
- action-result prose only appears as the result of that action unless preserved in canonical saved session state

### Directional Entry Prose

- directional entry prose such as `enter:forward` and `enter:backward` belongs in visible text
- directional entry prose follows the same rules as other node entry prose

### Generated Traversal / Control Text

- generated traversal and control text belongs in recent text
- examples include `You keep moving.`, `You skip ahead.`, `You step through.`, `You step back.`, and `Taking exit: ...`

### Sidecar Event Text

- sidecar event text belongs in recent text by default
- sidecar events may explicitly override lane to `visible` when the result should become primary prose
- sidecar lane must not be inferred from renamed navigation labels alone

### Weather Prose

- weather prose belongs in recent text
- weather prose is system-generated and rule-based rather than authored node prose
- on new game or continue, current weather may seed once if the destination node allows weather visibility
- after the initial seed, weather prose should only appear when the current node allows weather visibility and the weather phase meaningfully changed while the player remained in that node
- moving from one weather-visible node to another weather-visible node must not replay unchanged weather prose
- moving from a weather-hidden node to a weather-visible node may announce current weather once to restore player context
- weather prose must not replay if the same weather line is already represented in the canonical restored recent log

### Ambient NPC Prose

- non-dramatic ambient NPC arrival, presence, transit, and departure prose belongs in recent text
- ambient prose is live-event driven
- ambient prose must never replay solely because of restore, rerender, remount, or route reapplication

### Continue / Restore

- continue restores one canonical snapshot of gameplay-facing page state and recent text
- continue must not replay weather, ambient arrivals, or entry events that are already represented in that restored snapshot
- location restore is the minimum requirement; additional run state may expand over time as the runtime grows
- restore must not fork shared world-time assumptions by inventing client-local weather or clock truth

### New Game / Reset

- new game and reset clear all run-scoped gameplay state
- this includes recent text, action attempts, visit counts, temporary observer memory, and other run-local artifacts

## Ownership Rules

The server/runtime session layer should own authoritative gameplay state, including:

- route progression
- current node and path position
- recent text
- action attempts
- visit counts
- session state
- ambient event history
- weather visibility decisions

The client should own only purely visual UI state.

## Transitional Rule

Local fallback logic may remain only when needed to avoid breaking the app during migration.

Treat that fallback logic as temporary.

When behavior rules and fallback code disagree, add tests for the rules and remove the fallback rather than deepening the client-side workaround.