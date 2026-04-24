# Navigation And Traversal v1

This document is the working reference for how movement behaves in the current project.

Use it when authoring exits, paths, and gates, or when changing the runtime rules that resolve them.

## Core Principle

Navigation is intentionally simple.

The player moves between authored nodes.

The UI should feel closer to linked pages than to a simulation-heavy game shell.

The complexity lives in how authored references resolve, not in the presentation shell.

## Route State

The active runtime/session route state is represented as:

- `projectId`
- `nodeId`
- optional `pathDirection`
- optional `pathBeatIndex`

`pathDirection` is important.

It lets the runtime render and resolve the same Path differently depending on which side the player entered from.

`pathBeatIndex` matters when a Path is being traversed in paged mode.

It keeps the player on the same Path node while advancing through authored beats one at a time.

## Project Runtime

Each content folder under `packages/content/<project>` becomes a project runtime.

The runtime currently exposes:

- a start node id
- a node list for the sidebar
- projected pages keyed by node id
- internal node records and alias maps used for movement resolution

The start-node rule is simple:

- first discovered Area in sorted source order
- otherwise first discovered node

## Area Navigation

Areas can expose:

- POIs
- choices
- exits

Author against these runtime rules:

- POIs and choices may append recent log text without moving the player
- exits attempt to resolve a reachable node from `targetId`
- exit activation may also append a simple navigation log entry
- blocked Areas may author `blocking.state: blocked` plus `blocked` prose for an obstructed arrival state
- Area blocking currently affects prose selection, not route resolution

`targetId` is a node-id reference, not a file path.

If a content file moves into a subfolder, authored exits should usually stay unchanged as long as the destination node id stays the same.

An exit target does not need to be the final visible destination.

It may resolve through a passthrough gate into a path or another node.

## Path Navigation

Paths expose traversal controls.

Current controls are:

- `continue`
- `skip`
- `back`

Author against these traversal rules:

- traversal mode comes from the Path's authored `traversal` config
- `firstVisitMode` and `repeatVisitMode` may be `paged` or `compressed`
- in `paged` mode, a multi-beat Path stays on the same node and exposes one beat at a time
- `continue` advances to the next beat until the final beat is reached
- on the final beat, `continue` resolves the active directional endpoint and moves onward
- `skip` resolves the active directional endpoint immediately, but is only surfaced when a paged Path has more than one beat
- a one-beat Path effectively behaves like a single-step traversal and shows `continue` plus `back`
- `compressed` traversal projects the selected flow without beat-by-beat stepping
- the resulting destination may itself be a passthrough gate that resolves again before landing on a visible node
- the path remains the active node while its projected page is being shown

Blocked traversal is its own authored flow family.

- if `blocking.<direction> === blocked`, the runtime prefers `flow:block:<direction>`
- blocked flows currently page through beats one at a time
- intermediate blocked beats may still show `continue`
- the final blocked beat does not traverse the endpoint
- blocked beats preserve markers such as `delay` and `fade` like any other Path beat

Directionality also affects what the player can do once they are on the Path.

- `bidirectional` Paths keep the current `back` control
- `forward_only` and `backward_only` Paths do not surface `back`
- if movement tries to enter a one-way Path from the disallowed side, route resolution fails safely instead of forcing a direction

Path `back` is runtime-resolved.

- it returns to the side of the Path the player is currently standing on
- it is not a browser-history fallback
- when the return side resolves through a passthrough gate, runtime continues resolving that threshold as usual

## Gate Navigation

Gates are threshold nodes.

They may either:

- surface as visible pages
- behave as passthrough routing nodes

That decision is now directional.

A Gate may be passthrough on one face and visible on the other.

Visible gates may expose:

- POIs
- choices
- exits
- simple control labels such as a custom `back` label

Visible gate `back` is also runtime-resolved.

- it means step away from the threshold on the side currently being viewed
- it is not a client-side route-history operation
- this matters for authored states such as locked doors, because the threshold itself owns which side the player is on

Gates may also be one-way.

- `bidirectional` remains the default behavior
- `forward_only` and `backward_only` reject entry from the disallowed side
- visible one-way gates omit the default history-style `back` control

Gates may also be blocked.

- Gate blocking is separate from one-way directionality
- a one-way Gate says a side is not valid for traversal at all
- a blocked Gate says the side is valid in principle but currently obstructed by authored fiction such as rubble, guards, crowds, or a locked mechanism
- blocked approaches may author `blocked:<direction>` prose on the Gate itself
- if a passthrough Gate is blocked on the approached side, passthrough resolution stops and the Gate page renders instead of auto-advancing

The runtime treats a gate face as passthrough if that approached direction resolves to one of the passthrough presentation modes.

Preferred authoring is:

- `presentation.forward`
- `presentation.backward`

Legacy whole-node fields still map to the same runtime behavior, but new content should use directional presentation.

Visible directional faces may author:

- `billboard:<direction>`
- `enter:<direction>`

If a visible gate face has an endpoint but no authored exits, the runtime surfaces `continue` so that the threshold can still advance without extra action boilerplate.

If a visible gate face exposes `back`, runtime resolves it to the current-side node rather than to a remembered browser route.

Legacy passthrough fields that still resolve are:

- `presentationMode === 'passthrough'`
- `presentationMode === 'walkpassthrough'`
- `presentationMode === 'runpassthrough'`
- `passthrough === true`
- `walkpassthrough === true`
- `runpassthrough === true`

## Passthrough Resolution

This is the key routing rule for the current system.

When movement resolves to a passthrough gate, the gate does not become the final visible destination by default.

Instead, the runtime keeps resolving until it reaches a Path or a non-passthrough node.

Resolution depends on where the player is coming from.

### Area Or Gate To Path

If the source side is area-like, the runtime prefers to move outward:

- explicit gate forward endpoint if present
- inferred connected path if present
- directional endpoint fallback

### Path To Area

If the source side is path-like, the runtime prefers to move inward:

- explicit gate backward endpoint if present
- inferred attached area if present
- directional endpoint fallback

This is why the same passthrough gate can serve both directions cleanly when endpoints are authored correctly.

For one-way gates, the inferred gate direction must still agree with authored `directionality` or the route fails safely.

## Direction Resolution

When the runtime lands on a Path, it infers the active direction from the relationship between the source node and the path endpoints.

Current rule order:

- if source matches `forward.from`, direction is `forward`
- if source matches `forward.to`, direction is `backward`
- if source matches `backward.from`, direction is `backward`
- if source matches `backward.to`, direction is `forward`
- otherwise fall back to the incoming direction hint

Author endpoints with that rule in mind so the same Path can resolve correctly from both ends.

For one-way Paths, the inferred direction must still agree with the authored `directionality` value or entry will fail safely.

The runtime applies the same rule to Gates when a gate authors `directionality`.

## Alias Resolution

The runtime currently canonicalizes references by also checking a version of the id with `_{guid}` removed.

That means authored references may resolve whether they use the full id or the readable canonicalized form.

This behavior exists for authoring convenience in the current system.

It should be treated as runtime tolerance, not as a guarantee that all future authoring forms will remain loose forever.

## Keyboard Shortcuts

Keyboard shortcuts are part of navigation behavior, not just presentation.

The web shell matches visible action and control keys case-insensitively.

Numeric keys are also supported.

The app ignores keyboard shortcut handling when focus is in an editable element.

## Recent Log And Session Artifacts

The current app code also tracks:

- per-project path visit counts
- per-node recent log entries

Recent log is appended after projection rather than being baked into every projected page by default.

Path visit counts are currently used to decide whether a Path should project its `first_visit`, `repeat`, or fallback flow behavior.

Treat browser-managed history as drift rather than intended traversal behavior.

`back` behavior should come from runtime/authored resolution, not from a remembered browser route.

Visit-count authority that affects authored projection is also a migration target toward server/session ownership rather than a client-side architectural goal.

## Non-Goals

The current navigation model does not try to provide:

- rich world simulation
- stance-sensitive routing beyond a few passthrough labels
- a complex inventory or command parser
- persistent authored visit-state beyond the current runtime rules

The model is page-like on purpose.