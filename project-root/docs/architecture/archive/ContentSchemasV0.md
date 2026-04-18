# Content Schemas v0

Status note:
Use ContentSchemasV1.md as the current baseline for the human-readable schema reference.
This v0 file is kept as earlier design context.

This document is the human-readable schema reference for the three core content object families:

- AreaObject
- PathObject
- GateObject

It exists to describe the shape of each object in plain language before those shapes are turned into code.

This is not a parser doc and not a TypeScript doc.

It is the prose version of the schema.

## Purpose

The goal of these schemas is to keep content authoring understandable while still giving the runtime enough structure to project a readable page-like experience.

The system is not trying to simulate a complicated physical world.

It is trying to support authored places, traversal, and thresholds with low author friction.

## Shared Shape

All three object families share a common high-level structure:

1. front matter metadata/config
2. authored body content

Each object should usually have:

- a schema identity
- a content identity
- a human-readable display name
- a region or grouping context
- enough config to describe navigation and presentation

## Shared Fields

These are the common fields that are likely to appear across object types.

### `version`

Content document version.

Useful for format evolution later.

### `templateSchema`

The object family.

Expected v0 values:

- `area`
- `path`
- `gate`

### `templateSchemaVersion`

Schema version for that object family.

### `id`

Machine-unique content id.

For v0, a readable-name-plus-guid pattern is acceptable and preferred for author sanity.

Example:

- `sunbleached_tree_{guid}`

### `name`

Optional shorter human-readable identifier.

Useful when authors need a stable readable name alongside a longer machine-safe id.

### `displayName`

The main human-facing name for the object.

Usually the page title.

### `tagline`

Optional supporting flavor line.

Useful for a short subheading or atmosphere cue at the top of the page.

### `region`

Grouping field for the part of the world this object belongs to.

### `tags`

Optional static classification labels.

Used for grouping, route marking, quest-like grouping, or later discovery patterns.

### `signals`

Optional mood or behavior metadata.

Used to describe feel more than strict logic.

### presentation mode fields

Objects may also carry presentation or traversal fields such as:

- `passthrough`
- `presentationMode`
- later posture-sensitive passthrough settings

These fields influence whether a node visibly interrupts the player.

## AreaObject

### What It Is

An AreaObject is a place the player inhabits.

It is the most page-like and detail-rich object type.

Areas are where the player is most likely to:

- receive atmosphere prose
- inspect optional details
- choose posture or tone
- select exits to other nodes

### Area Config Shape

An AreaObject usually has:

- shared identity fields
- region
- optional tags and signals
- optional presentation settings
- optional POIs
- optional choices
- optional exits

### POIs

POIs are optional inspectable points of interest.

Each POI usually has:

- an `id`
- a `displayName`

The POI list exists so projection can show optional inspectable details when present.

If no POIs exist, no POI UI needs to render.

### Choices

Choices are authored actions or stances available in the Area.

Each choice usually has:

- an `id`
- a `displayName`
- optional shortcut key

Choices often shape tone, pacing, or posture more than hard mechanics.

### Exits

Exits connect the Area to other nodes.

Each exit usually has:

- an `id`
- a `targetId`
- a `displayName`
- optional shortcut key

The exit list is the main way an Area participates in the navigation graph.

### Area Body Content

Areas are section-based.

Common section families include:

- `enter`
- `first_visit`
- `repeat_visit`
- `visit_random`
- `poi:<id>`
- `choice:<id>`
- `exit_glue:<id>`
- `exit_glue_random:<id>`

Repeated sections are allowed.

When repeated sections are used, they should be grouped together for readability.

### Area Mental Model

AreaObject is the general-purpose location type.

If the player is meant to linger, inspect, choose a tone, or browse exits, it is probably an Area.

## PathObject

### What It Is

A PathObject is traversal.

It is not mainly a place to inhabit.

It exists to express movement between places with pacing, direction, and sometimes blockage.

### Path Config Shape

A PathObject usually has:

- shared identity fields
- region
- optional presentation settings
- `directionality`
- `traversal` settings
- `blocking` settings
- `endpoints`

### Directionality

Directionality describes whether the path behaves the same in both directions.

The most obvious early value is `bidirectional`, but the model should allow the possibility of more constrained path behavior later.

### Traversal Settings

Traversal settings describe how the path is experienced.

Examples:

- first-visit mode is paged
- repeat mode is compressed

This is about player-facing pacing, not deep simulation.

### Blocking

Blocking describes whether a path is open or obstructed in a given direction.

This is path-internal obstruction logic, not threshold logic.

If the problem is a door, guard, or threshold encounter, that is more likely Gate territory.

### Endpoints

Endpoints describe what nodes the path connects.

For v0, a Path is expected to connect endpoints directly and simply.

That simplicity is intentional.

### Path Body Content

Paths are flow-based.

Common section families include:

- `flow:first_visit:forward`
- `flow:first_visit:backward`
- `flow:repeat:forward`
- `flow:repeat:backward`
- `flow:block:forward`
- `flow:block:backward`

Within a flow, content is written as ordered beats.

This is what allows continue, skip, and back style traversal controls.

### Path Mental Model

If the content is mostly about crossing, moving through, compressing revisit text, or handling directional traversal, it is probably a Path.

## GateObject

### What It Is

A GateObject is a threshold.

It mediates passage rather than functioning as a full location or a full traversal sequence.

Gates are the best fit for things like:

- business doors
- guarded entrances
- locked or blocked thresholds
- speak-easy or password doors
- billboard-like surfaces that are visible but not deeply enterable

### Gate Config Shape

A GateObject usually has:

- shared identity fields
- region
- optional tags
- optional presentation settings
- optional threshold-specific settings

Presentation settings matter a lot for gates because some gates should:

- surface as full threshold pages
- surface only as billboards
- disappear into passthrough

### Gate Body Content

Gate content is usually lighter than Area content.

Common section families may include:

- `enter`
- `billboard`
- state-aware threshold prose later
- threshold action prose later

For v0, Gate content can stay simple.

It only needs to support enough flavor and decision-making to prove the threshold idea.

### Gate Mental Model

If the main question is not “what is this place like?” or “how do I traverse this route?” but instead “does this threshold let me through, delay me, or give me a little interaction first?”, it is probably a Gate.

## Choosing The Right Object Type

Use an AreaObject when:

- the player is in a place
- optional inspection matters
- multiple exits or choices should be visible together
- the page should feel like a location

Use a PathObject when:

- the player is moving through a route
- pacing and directional traversal matter
- continue, skip, and back are the main controls
- the content is an ordered sequence of beats

Use a GateObject when:

- the player is dealing with a threshold
- the main question is passage, delay, denial, or a light threshold action
- the object may be shallow, billboard-like, or invisible via passthrough

## What These Schemas Are Not

These schemas are not trying to define:

- deep inventory systems
- full NPC systems
- complex dialogue trees
- long-term persistence behavior
- a heavy simulation model

Those can come later if they are still useful.

## Minimum Success Criteria

These schema descriptions are good enough for v0 if:

1. a human can read them and understand what each object family is for
2. the sample content docs clearly fit one of the three families
3. parser and projection work can proceed without inventing new object meanings on the fly
4. the project can start coding without first re-litigating what Area, Path, and Gate fundamentally mean