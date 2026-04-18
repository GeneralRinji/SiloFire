# Content Authoring Guide v1

This document is the practical authoring guide for writing content in this project and for collaborating with an external AI assistant that does not have direct repo context.

Use it together with:

- `SourceFormatV1.md`
- `NavigationAndTraversalV1.md`
- `ContentSchemasV1.md`
- `ContentContractV1.md`

This guide is intentionally opinionated.

It focuses on authoring useful content that fits the current runtime instead of describing every theoretical option.

## Purpose

The content creator's job in this project is to:

- write readable, hand-authored markdown-like content
- build a clear navigation graph from node to node
- keep pages readable in the current renderer
- reuse the Area, Gate, and Path model consistently
- avoid inventing features the runtime does not support yet

The current project is prose-first.

It is not a scripting sandbox.

If a scene needs heavy state or simulation, that should be designed explicitly instead of being faked through unsupported syntax.

## Current Scope

The current runtime supports:

- `Area`
- `Gate`
- `Path`
- prose slots and flow beats
- exits, choices, and POIs
- visible shortcut keys
- delayed and faded prose
- delayed navigation headings and labels
- directional Gate presentation
- directional Gate blocking
- Path blocking flows

The current runtime does not yet support:

- local runtime flags in content
- conditions such as `when`
- mutable state effects such as `set`
- built-in stateful doors
- arbitrary scripting

Do not ask an AI assistant to author those as if they already exist.

## Project Shape

Current content locations:

- `packages/content/demo`: main demo project and best current authoring examples
- `packages/content/demo02`: starter project folder for new authored content

For external content-authoring AI handoff, start with `ContentSchemasV1.md` for allowed shapes and fields before showing example content from the demo project.

Each folder directly under `packages/content` is one project.

Within a project, content files may live either at the project root or in nested subfolders.

Examples:

- `packages/content/demo/shack_run2.md`
- `packages/content/demo/fixtures/passthrough_chain/demo_fixture_entry.md`

Subfolders are for human organization only.

They do not create a namespace boundary.

Node ids must still stay unique within the whole project, not just within one subfolder.

Current presets location:

- `packages/presets`: reusable authoring presets and fixture-pattern references; use after the schema docs and before richer demo examples

Architecture references:

- `docs/architecture/SourceFormatV1.md`: source syntax
- `docs/architecture/NavigationAndTraversalV1.md`: navigation and route behavior
- `docs/architecture/ContentSchemasV1.md`: schema-level shapes
- `docs/architecture/ContentContractV1.md`: normalized runtime contract

## Required Project Conventions

### Start And End Nodes

Recommended project structure:

- start from a `title_screen` Area-like node
- end in at least one terminal Area-like node such as `game_over_good` or `game_over_bad`
- if a project has multiple endings, keep their final nodes clearly named and clearly terminal

Current demo examples:

- `packages/content/demo/title_screen.md`
- `packages/content/demo/game_over_good.md`
- `packages/content/demo/game_over_bad.md`

### Connectivity

Recommended graph rules:

- prefer Areas connecting to Gates rather than directly into Paths when a threshold matters
- prefer Paths connecting through Gates rather than directly slamming into Areas when a transition matters
- if a threshold is narratively meaningful, make it a Gate
- if movement itself is meaningful, make it a Path
- if lingering and interaction matter, make it an Area

This is a design preference, not a hard parser rule.

### Naming

Use human-readable ids and file names.

Prefer underscores over spaces or camelCase in ids and file names.

Folder names should also stay human-readable, but authored links should continue to use node ids rather than folder paths.

Examples:

- `shack_run2`
- `good_ending_walk`
- `game_over_good`

Gate naming should stay readable like a join table in an ERD.

Preferred Gate naming:

- `<area>_<path>`
- `<path>_<area>`
- or other clearly readable two-node threshold names

Examples:

- `shackrun1_goodendingwalk`
- `goodendingwalk_gameovergood`

If a cluster is likely to grow, prefer numeric suffixes from the start.

Examples:

- `shack_run1`
- `shack_run2`
- `warehouse_01`
- `warehouse_02`

Do not force `001` on every file in the current repo. That is not the current project-wide convention.

When moving a file into a subfolder, keep its authored `id` stable unless the node identity itself is changing.

Do not rewrite `targetId` or `endpoints.*.to` / `endpoints.*.from` to include folder segments.

## Object Families

## Area

### Definition

An Area is a place-like node where the player pauses, reads, inspects, chooses, and exits.

Use an Area when the player is meant to linger.

### Common Properties

Common Area front matter properties:

- shared node fields such as `id`, `displayName`, `region`
- optional `blocking.state`
- optional `navigationLabels`
- optional `controlLabels`
- optional `pois`
- optional `choices`
- optional `exits`

### Markdown Allowed

Allowed in Area body content:

- `## enter`
- `## blocked`
- `## first_visit`
- `## repeat_visit`
- `## last_visit`
- `## poi:<id>`
- `## choice:<id>`
- `## exit_glue:<id>`
- `## exit_glue_random:<id>`
- inline emphasis like `*italic*` and `**bold**`
- markers like `[none]`, `[delay: medium]`, and `[fade: out 5000]`

### Evaluation Order

Current preferred area prose order:

- `first_visit` or `repeat_visit`
- then `blocked` if the Area is blocked
- then `enter`

POIs and choices may append local prose without moving the player.

Exits move the player to another node or threshold.

### Usage

Use an Area for:

- rooms
- streets
- yards
- docks
- endings
- title screens

If the page mostly asks the player to move through space, it may be a Path instead.

If the page mostly represents a threshold, it may be a Gate instead.

### Example

```md
---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: empty_shack
displayName: Empty Shack
region: old_harbor

choices:
  - id: inspect_cot
    displayName: Look Over the Broken Cot
    key: I

exits:
  - id: emptyshack_door
    targetId: dilapidated_shop_open
    displayName: Back to the Door
    key: B
---

# Empty Shack

## first_visit
A broken cot leans into one wall beside a crate split by age and damp.

---

## enter
With the door open, enough harbor light gets in to prove there is no one waiting here.

---

## choice:inspect_cot
The cot rope is long gone.
```

## Gate

### Definition

A Gate is a threshold node.

It may be visible or passthrough, depending on the authored presentation and approached direction.

Use a Gate when the threshold itself matters.

### Common Properties

Common Gate front matter properties:

- shared node fields
- optional `directionality`
- optional directional `presentation`
- optional directional `blocking`
- optional `navigationLabels`
- optional `controlLabels`
- optional `pois`
- optional `choices`
- optional `exits`
- optional `endpoints`

### Markdown Allowed

Allowed in Gate body content:

- `## enter`
- `## enter:<direction>`
- `## billboard`
- `## billboard:<direction>`
- `## blocked:<direction>`
- `## poi:<id>`
- `## choice:<id>`

### Evaluation Order

Current Gate prose resolution favors:

- `first_visit` if authored
- then directional or generic `blocked`
- otherwise directional or generic `billboard`
- then directional or generic `enter`

Visible Gates may expose POIs, choices, exits, and sometimes synthesized `continue`.

Blocked visible Gates suppress exits while blocked and may preserve `back`.

### Usage

Use a Gate for:

- doors
- thresholds
- guarded entrances
- magical boundaries
- named transitions between an Area and a Path

If the threshold does not matter and should simply resolve through, use passthrough presentation.

### Example

```md
---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: dilapidated_shop
displayName: Empty Shack Door
region: old_harbor

presentation:
  forward: billboard
  backward: billboard

choices:
  - id: test_latch
    displayName: Try the Latch
    key: T

exits:
  - id: open_door
    targetId: dilapidated_shop_open
    displayName: [delay: medium] Open the Door
    key: A

endpoints:
  forward:
    from: shack_run2
    to: empty_shack
  backward:
    from: empty_shack
    to: shack_run2
---

# Empty Shack Door

## enter:forward
The door is shut, swollen with damp, but not locked.

---

## choice:test_latch
The latch gives with a tired metal click.
```

## Path

### Definition

A Path is a traversal node.

Use a Path when movement itself should be authored as beats.

### Common Properties

Common Path front matter properties:

- shared node fields
- `directionality`
- optional `traversal`
- optional `blocking`
- required `endpoints`

### Markdown Allowed

Allowed in Path body content:

- `## flow:first_visit:forward`
- `## flow:first_visit:backward`
- `## flow:repeat:forward`
- `## flow:repeat:backward`
- `## flow:block:forward`
- `## flow:block:backward`
- `### beat`
- inline emphasis and markers

### Evaluation Order

Current Path flow selection favors:

- blocked flow if the selected direction is blocked
- otherwise `repeat` on later visits when available
- otherwise `first_visit`
- otherwise fallback to `repeat` or `block`

Traversal controls then depend on traversal mode and beat count.

### Usage

Use a Path for:

- roads
- alleys
- piers
- causeways
- final walks

If the player is mostly reading a place rather than moving through beats, use an Area.

### Example

```md
---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: good_ending_walk
displayName: The Last Walk
region: old_harbor

directionality: forward_only

traversal:
  firstVisitMode: paged
  repeatVisitMode: paged

endpoints:
  forward:
    from: shackrun1_goodendingwalk
    to: goodendingwalk_gameovergood
---

# The Last Walk

## flow:first_visit:forward

### beat
You keep walking until the shacks stop pretending to be part of town.

### beat
The boards underfoot sound steadier the farther you get from everything you meant to say.
```

## Special Nodes

### title_screen

Recommended use:

- begin the project here
- keep it simple
- one clear exit into the first meaningful node
- include a little tone-setting prose

Current demo example:

- `packages/content/demo/title_screen.md`

### game_over_good

Recommended use:

- terminal good ending Area
- usually no outward navigation except return-to-title or restart
- may include a small optional POI such as credits or a tucked-away coda

Current demo example:

- `packages/content/demo/game_over_good.md`

### game_over_bad

Recommended use:

- terminal bad ending Area
- keep navigation simple
- usually return-to-title or restart only

Current demo example:

- `packages/content/demo/game_over_bad.md`

## Prose

### Formatting Allowed

Currently supported prose formatting:

- plain paragraphs
- repeated sections and variants
- inline `*italic*`
- inline `**bold**`
- `[none]`
- `[delay: <value>]`
- `[fade: <value>]`

Do not invent additional inline grammar unless it is explicitly documented elsewhere.

### Prose Functions

The current prose functions are practical rather than abstract:

- set mood and scene
- explain thresholds and movement
- respond to POIs and choices
- glue exits together
- pace movement through Paths
- hide or reveal beats with delay and fade markers

Current supported marker use:

- prose-block delay
- prose-block fade
- navigation label delay
- action/control/exit label delay

## Evaluation Summary

When unsure, remember this:

- Areas are places
- Gates are thresholds
- Paths are traversal

And:

- prose defines what the player reads
- exits define where the player can go
- choices and POIs define what the player can do without leaving the node

## Best Practices

Recommended best practices for this repo:

- prefer human-readable ids and file names with underscores
- prefer numeric suffixes when a content cluster is likely to expand
- keep visible navigation lists to about 4-6 items when possible
- if an Area would need too many doors or exits, split it into adjacent Areas instead of making one giant door list
- keep shortcut keys close together and easy to scan
- prefer stable navigation order so common actions stay in familiar screen positions when possible
- put likely primary movement near the top of the visible list
- if `continue` exists, keep it visually prominent and stable
- use Gates to make transitions legible instead of skipping directly from one unlike node type to another when the threshold matters

### Example Of Splitting A Busy Area

Prefer this:

- `warehouse_yard_01` with 3 exits
- `warehouse_yard_02` with 3 exits
- a short connecting threshold or path between them

Over this:

- one `warehouse_yard` Area with 9 doors stretching the page and scattering shortcuts

### Example Navigation Order

Good:

- `Continue`
- `Main Door`
- `Side Door`
- `Look At The Crate`

Less good:

- `Look At The Crate`
- `Continue`
- `Hidden Hatch`
- `Main Door`

The goal is not rigid uniformity.

The goal is helping the player's eyes learn where important information tends to appear.

## What To Reuse

When authoring new content, check these first:

- `docs/architecture/ContentSchemasV1.md`
- `packages/presets`
- `packages/content/demo`
- `packages/content/demo02`
- `docs/architecture/SourceFormatV1.md`
- `docs/architecture/NavigationAndTraversalV1.md`

Use `packages/presets` for reusable structure and stripped examples, then use `packages/content/demo` for richer authored tone and composition.

## Instructions For External AI Helpers

If you are using a browser AI assistant without repo context, tell it to do all of the following:

- treat `Area`, `Gate`, and `Path` as the only current node families
- use `packages/presets` for reusable patterns and stripped examples after reading the schema docs
- preserve existing source format and naming patterns
- do not invent unsupported features such as local flags, `when`, or `effects`
- ground all examples in `packages/content/demo` and `docs/architecture`
- keep navigation concise and readable
- prefer Gates for meaningful thresholds
- prefer Paths only when traversal beats matter
- prefer Areas when the player is meant to linger

If the assistant proposes a new feature, it should label it clearly as a proposal instead of presenting it as already implemented.