# Content Contract v1

This document is the working reference for the normalized content model used by the current parser, interpreter, projection layer, and web runtime.

It is not the authoring format itself, but it is the contract that authored content is normalized into.

## Purpose

The system is still prose-first.

The contract supports:

- ambient place text
- directional traversal text
- lightweight thresholds
- simple exits, choices, and POIs
- visible shortcut keys
- non-interrupting passthrough movement

The contract is intentionally small.

It supports authored movement and pacing, not a heavy simulation model.

## Content Object Families

The current runtime supports three normalized node families:

- `AreaObject`
- `PathObject`
- `GateObject`

All three share:

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
- optional traversal presentation flags
- optional `controlLabels`

## Area

An Area is a place-like node.

Areas may expose:

- POIs
- choices
- exits
- prose slots

Areas do not carry flow beats directly.

They are mainly slot-based.

## Path

A Path is a traversal node.

Paths currently carry:

- `directionality`
- optional traversal config
- optional blocking config
- required directional `endpoints`
- optional prose slots
- optional directional `flows`
- optional `controlLabels`

Paths are the only current node family that is explicitly flow-based.

Their traversal config determines whether first and repeat traversal is paged or compressed.

Their directionality also determines whether the runtime should accept entry from both sides or only from one authored direction.

## Gate

A Gate is a threshold node.

Gates currently carry:

- optional `directionality`
- optional `navigationLabels`
- optional `controlLabels`
- optional `pois`
- optional `choices`
- optional `exits`
- optional directional `endpoints`
- optional prose slots
- traversal presentation flags such as `passthrough` or `presentationMode: passthrough`

In practice, Gates are often used as threshold metadata plus routing rules.

Some gates may surface as visible pages.

Some gates may route through without rendering a page at all.

Visible gates may behave more like lightweight threshold encounters than pure routing-only nodes.

If a Gate authors `directionality`, the current runtime treats `forward_only` and `backward_only` as active movement constraints rather than decorative metadata.

## Prose Trigger Set

The current normalized prose trigger set is:

- `enter`
- `billboard`
- `first_visit`
- `repeat_visit`
- `visit_random`
- `last_visit`
- `choice_result`
- `exit_glue`
- `exit_glue_random`
- `poi_inspect`

This is the current baseline trigger set.

Treat this list as the current baseline until a later version replaces it.

Compatibility note:

- `visit_random` still exists in the normalized trigger set for compatibility with older authored content
- preferred area lifecycle authoring should move toward `enter`, `first_visit`, `repeat_visit`, and optional explicit `last_visit`

## Area Arrival Lifecycle

Preferred area arrival semantics are:

- `enter`: always-available arrival prose
- `first_visit`: prose that only appears on the first arrival to that node
- `repeat_visit`: prose that appears on later arrivals to that node
- `last_visit`: optional explicit terminal-arrival prose, only when some higher-level state selects it

This keeps lifecycle state separate from variant selection.

Variation inside `repeat_visit` should come from slot mode and variants, not from a separate lifecycle trigger.

That means repeated `repeat_visit` sections, weighted `repeat_visit` sections, or later `cycle` behavior are the preferred place for revisit variation.

`last_visit` should not be inferred from raw visit count alone.

It is better treated as an explicit narrative override for cases such as:

- the place is about to disappear from the route
- the place has been permanently changed by an event
- the story knows this is the final meaningful arrival

## Prose Slot Model

Prose slots are the ambient and event-oriented delivery system.

Each slot has:

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

`silent` means the slot intentionally produces no visible text.

`none` means the authored variant intentionally produces no visible text.

Those are not the same as missing content.

## Text Lane Policy

The runtime distinguishes between two gameplay-facing text lanes:

- visible text
- recent text

Current policy:

- authored node entry prose resolves into visible text
- authored POI result prose resolves into recent text by default
- authored choice result prose resolves into visible text by default
- directional entry prose such as `enter:forward` and `enter:backward` resolves into visible text
- generated traversal/control text resolves into recent text
- weather and ambient status prose resolve into recent text

At the projection/runtime layer this may be represented by a `lane` field on emitted log entries.

That field is runtime metadata for projected entries.

Sidecar events also support an explicit authored `lane` override with values `visible` or `recent`.

Project time schedules use the same lane vocabulary for authored schedule emissions.

Authoring boundary reminder:

- do not add `lane` directly to normal Area, Gate, or Path markdown
- use sidecar events or time schedules when authored lane choice is needed

## Flow Model

Flows are the ordered delivery system.

The current runtime uses them for Paths.

Each flow has:

- `id`
- `trigger`
- `direction`
- ordered `beats`

Current flow triggers:

- `first_visit`
- `repeat`
- `block`

Current directions:

- `forward`
- `backward`

Each beat may preserve simple markers such as:

- `delay`
- `fade`

When a Path is traversed in paged mode, the browser runtime may reveal one beat at a time while keeping the same active Path node.

One-way note:

- `forward_only` and `backward_only` are now active runtime behavior, not just reserved schema values
- entering a Path from the disallowed side fails safely
- one-way Paths omit the history-style `back` control from their projected page

## References And Keys

POIs, choices, and exits may expose visible shortcut keys.

Those keys are not just cosmetic.

They are used both for rendering labels like `[R]` and for actual keyboard matching in the web shell.

Treat shortcut keys as part of the user-facing interaction contract.

Authored shortcut keys may be normalized from simple scalar values.

For example, `key: 1` may normalize into the runtime as `'1'`.

Controls may also expose authored label overrides through `controlLabels` while retaining stable control kinds such as `continue`, `skip`, and `back`.

## Identity And Alias Resolution

The runtime currently tolerates both full node ids and canonicalized ids with `_{guid}` removed.

This behavior exists to make authored references more forgiving in the current system.

That alias resolution belongs to runtime navigation, not to the authoring format itself.

## Layer Boundary

This contract sits below authoring and above rendering.

In practical terms:

- source files are handwritten markdown-like documents
- parser normalizes them into content objects, slots, and flows
- interpreter chooses the currently relevant content
- projection turns that into a simple page model
- web runtime adds project discovery, navigation resolution, recent log behavior, and keyboard handling

That last layer matters.

The current browser app is not only rendering projected pages; it is also assembling project-local runtime state and resolving movement across nodes.