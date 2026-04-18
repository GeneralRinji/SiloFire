# Content Schemas v1

This document is the working schema reference for the current content object families.

It is written for people authoring content, shaping content conventions, or changing the parser and runtime contracts.

It should also be the first schema document handed to an external content-creator AI.

Use this document to answer:

- what object families exist
- which fields are required
- which fields are optional
- which literal values are currently allowed
- which shape differences exist between Area, Path, and Gate

Use the other v1 docs after this one for source-format examples, traversal semantics, and authoring style.

## Purpose

The content schemas should stay small and prose-first.

They exist to support:

- place-like areas
- traversal-oriented paths
- threshold-like gates
- lightweight authored interaction

The runtime is intentionally simple.

## Shared Fields

All current node families share a common structural core:

- `version`
- `templateSchema`
- `templateSchemaVersion`
- `id`
- optional `name`
- `displayName`
- optional `tagline`
- `region`
- optional `tags`
- optional `signals`

Current required literals for authored content:

- `version: 1`
- `templateSchemaVersion: 1`

Current allowed `templateSchema` values are:

- `area`
- `path`
- `gate`

Additional family-specific fields describe traversal, routing, presentation, and interaction.

Shared authored overrides may also include:

- optional `controlLabels`

## AreaObject

### Purpose

An Area is a place-like node where the player lingers, reads, inspects, chooses, and exits.

### Common Fields

Areas may include:

- shared fields
- optional `blocking`
- optional `navigationLabels`
- optional `controlLabels`
- optional `pois`
- optional `choices`
- optional `exits`
- optional presentation flags
- prose slots

### Area Blocking

Areas may carry an optional blocking object.

Current supported field is:

- `state`

Current supported values are:

- `open`
- `blocked`

Area blocking does not redirect traversal on its own.

It marks the Area as presently obstructed for prose selection and future state-driven authoring.

### POIs

Each POI usually includes:

- `id`
- `displayName`

POIs drive inspect actions.

Their authored prose currently lives in prose slots, not in a separate nested prose object.

### Choices

Each choice usually includes:

- `id`
- `displayName`
- optional `key`

Choices represent authored actions or stances.

### Exits

Each exit usually includes:

- `id`
- `targetId`
- `displayName`
- optional `key`

`targetId` references another node's authored `id`.

It is not a relative file path and does not include subfolder segments.

Exits participate directly in the navigation graph.

### Navigation Labels

Areas may also carry optional section-label overrides for the page navigation buckets.

Current supported overrides are:

- `pois`
- `choices`
- `exits`
- `controls`

These are presentation-facing aliases for renderer headings, not separate interaction types.

### Control Labels

Areas, Paths, and Gates may also carry optional control-label overrides.

Current supported control labels are:

- `continue`
- `skip`
- `back`

These override the visible control text without changing the underlying control kinds.

### Area Prose Families

Common area prose families are:

- `enter`
- `blocked`
- `first_visit`
- `repeat_visit`
- `last_visit`
- `poi_inspect`
- `choice_result`
- `exit_glue`
- `exit_glue_random`

Compatibility note:

- `visit_random` is still tolerated in the normalized trigger set for older content

## PathObject

### Purpose

A Path is a traversal node.

It expresses movement between places with direction, pacing, and possible blockage.

### Common Fields

Paths usually include:

- shared fields
- optional `controlLabels`
- `directionality`
- optional `traversal`
- optional `blocking`
- `endpoints`
- optional prose slots
- optional directional flows

### Directionality

Directionality describes how the path behaves across travel directions.

Current supported values are:

- `bidirectional`
- `forward_only`
- `backward_only`

Author a one-way path when the player should only ever enter and traverse it from one side.

In the current runtime, a one-way Path:

- resolves normally from its authored direction
- fails safely if something tries to enter it from the disallowed side
- suppresses the Path page's history-style `back` control

### Traversal

Traversal config describes pacing-oriented behavior such as first-visit versus repeat treatment.

Current traversal mode fields are:

- `firstVisitMode`
- `repeatVisitMode`

Current supported traversal modes are:

- `paged`
- `compressed`

### Blocking

Blocking describes whether traversal is open or obstructed in a given direction.

In the current runtime, blocked directions prefer `flow:block:<direction>` when that direction is selected.

### Endpoints

Endpoints describe directional routing connections.

The current runtime uses them together with path direction and gate passthrough resolution.

### Flows

Paths are the current flow-bearing object family.

Each flow has:

- a trigger
- a direction
- ordered beats

Current flow triggers are:

- `first_visit`
- `repeat`
- `block`

Current directions are:

- `forward`
- `backward`

## GateObject

### Purpose

A Gate is a threshold or routing node.

It may be visible or it may resolve as passthrough movement.

### Common Fields

Gates usually include:

- shared fields
- optional `directionality`
- optional directional `presentation`
- optional `blocking`
- optional `navigationLabels`
- optional `controlLabels`
- optional `pois`
- optional `choices`
- optional `exits`
- optional `endpoints`
- optional prose slots

### Gate Presentation

Gates may author directional presentation modes.

Current supported fields are:

- `forward`
- `backward`

Current supported values are:

- `passthrough`
- `walkpassthrough`
- `runpassthrough`
- `billboard`

This lets the same Gate behave differently on each face, for example passing through one way while surfacing a visible threshold page on the return.

### Gate Behavior

Some gates render as normal pages.

Some gates resolve to `auto_advance` style movement and do not interrupt the player with a page.

Directional presentation decides that per approached face.

When a Gate authors `directionality`, the current runtime supports the same values used by Paths:

- `bidirectional`
- `forward_only`
- `backward_only`

In the current runtime, a one-way Gate:

- resolves normally from its authored direction
- fails safely if something tries to enter it from the disallowed side
- suppresses the default visible `back` control when the Gate renders as a page

Gates may also author `blocking` with the same directional `open` and `blocked` states used by Paths.

In the current runtime, a blocked Gate:

- is still distinct from a one-way Gate
- may surface blocked threshold prose through `blocked:<direction>`
- stops passthrough resolution on a blocked approach and renders the Gate page instead
- hides onward exit actions while blocked and restores a simple `back` control so the player can retreat

This depends on later projection/runtime behavior, but the schema carries the threshold configuration that enables it.

Visible gates may behave like lightweight interaction pages rather than pure routing stubs.

If a visible Gate face has an endpoint but no authored exit actions, the current runtime synthesizes a simple `continue` control.

## Prose Slots And Variants

Area and Gate content, and some Path content, use prose slots.

Each slot currently has:

- `id`
- `trigger`
- optional `key`
- `mode`
- `variants`

Current selection modes:

- `constant`
- `random`
- `weighted`
- `cycle`
- `silent`

Current variant kinds:

- `text`
- `none`

Text variants may preserve lightweight markers such as `delay` and `fade`.

## Identity Notes

Node ids are the machine-facing identity.

The runtime currently tolerates references that also match a canonicalized form with `_{guid}` removed.

That permissive alias handling is a runtime convenience for the current system, not a separate schema family.

## What v1 Clarifies

This v1 baseline is explicit about:

- explicit prose slot modes such as `weighted` and `cycle`
- the preferred area lifecycle of `enter`, `first_visit`, `repeat_visit`, and optional explicit `last_visit`
- shortcut keys being part of the active interaction contract
- gates participating in passthrough routing behavior
- path flows and prose slots remaining distinct structures