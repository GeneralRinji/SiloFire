# Content Talking Points v0

This note collects current talking points from the project discussion.

It is not a strict spec.

The goal is to capture the current shape of the project, what seems decided enough to build against, and what still needs follow-up later.

## Source Format Draft

Current direction:

- author content in markdown-like files
- keep prose easy to read and edit by hand
- use simple front matter for metadata/config
- use headings and subheadings for sections
- allow plain markdown emphasis inside prose, but do not chase fancy markup right now

Talking points:

- the source format should remain human-first
- the parser should do the heavy lifting
- authoring should not require JSON
- advanced formatting experiments can wait until much later

Current prototype shape by object type:

### Area

- front matter for metadata, POIs, choices, exits, and presentation settings
- prose sections like `enter`, `first_visit`, `repeat_visit`, `visit_random`, `poi:<id>`, `choice:<id>`, and `exit_glue:<id>`
- repeated sections are acceptable during prototyping

### Path

- front matter for metadata, directionality, traversal settings, blocking, and endpoints
- flow sections like `flow:first_visit:forward`, `flow:repeat:backward`, and `flow:block:forward`
- beat subheadings for ordered traversal prose

### Gate

- front matter for metadata and presentation settings
- short threshold-oriented prose sections
- may be full, billboard-like, or effectively passthrough depending on use case

## Parser Normalization Rules

Current direction:

- parser consumes human-friendly source files
- parser produces normalized internal objects
- parser is responsible for mapping loose source conventions to stable runtime structures

Talking points:

- duplicate headings should be preserved in source order
- repeated prose sections can normalize into slot variants
- `[none]` should normalize into an explicit none variant rather than disappearing
- beat blocks should normalize into ordered flow beats
- keyed sections such as `poi:wildraspberrybush` or `choice:walk` should normalize into a trigger plus a key
- markdown inside prose should remain simple and mostly pass through as content
- fancy embedded markup is out of scope for now

Normalization examples to settle later:

- whether repeated `repeat_visit` sections imply `random` by default
- whether weighted variants need explicit source markers
- whether cycle behavior needs explicit source markers
- whether delays become inline tokens, structured annotations, or retained raw markers on the first pass

## Visit Semantics

Current direction:

- this deserves a dedicated pass later
- it is important enough to call out now, but not yet locked

Talking points:

- what exactly counts as a visit
- when `enter` prose fires relative to `first_visit`, `repeat_visit`, or `last_visit`
- how `last_visit` is determined in practice
- whether traversal through passthrough nodes counts as a visit at all
- how looping, random, weighted random, and explicit silence should interact with visit timing

Provisional stance:

- keep visit logic light in v0
- do not let unresolved visit semantics block the first slice

## Movement Posture Rules

Current direction:

- movement posture matters because it changes pacing and tone
- passthrough behavior is separate from prose behavior

Talking points:

- `passthrough` means the node does not interrupt movement and may effectively route through invisibly
- `walkpassthrough` and `runpassthrough` should allow different surfacing behavior depending on movement posture
- posture is partly about player experience, not just routing logic
- some content should feel social or sticky when walking, but easily skimmed or bypassed when running

Open questions:

- whether posture is selected explicitly by the player each time or inferred from choice context
- whether posture lives on the navigation action, the current node, or both

## Graph And Navigation Model

Current direction:

- keep this dumb
- think old HTML webring or choose-your-own-adventure links, not a complex spatial simulation

Talking points:

- schema/config content should already carry most navigation data
- navigation should transform into a simple React presentation of links, controls, or lists
- areas usually have the richest navigation surfaces
- a room-sized area may still expose several internal POIs or exits if there is interesting detail to surface
- paths usually surface simpler traversal controls like continue, skip, and back
- gates usually surface continue or back only if they surface at all
- a passthrough doorway may never need to present navigation because it is not meaningfully surfaced

Examples:

```yaml
exits:
  - id: shack_run
    targetId: shack_run_{guid}
    displayName: Through ShackRun
    key: R

  - id: harbor_edge
    targetId: harbor_edge_{guid}
    displayName: Back to Harbor Edge Road
    key: H
```

Important note:

- `key` here means a shortcut key for navigation, not a unique identifier

Open questions:

- whether gates are best treated as nodes, threshold wrappers, or both depending on preset
- what the runtime considers the current node during a multi-beat path traversal

## Projection And View Model

Current direction:

- this probably is needed for architecture
- the exact explanation is still fuzzy right now

Talking points:

- interpreter and projection are still a useful split
- renderer should ideally receive already-decided player-facing data
- projection likely needs to answer what text is visible, what controls are visible, and whether the current interaction should auto-advance or render a page shell

Open questions:

- whether no-prose output still yields a visible page
- when to auto-advance versus stop and show controls
- how much path-specific control logic belongs in projection versus interpreter

## Randomness Policy

Current direction:

- randomness matters, but session and login concerns should not block the prototype
- deeper persistence can be a later phase

Talking points:

- support `random`, `weighted`, `cycle`, and explicit none outcomes
- do not require account or session infrastructure in the first prototype
- later phases may care about stable cycling, anti-repeat behavior, or session persistence

Possible future note:

- planned-features or future-phase doc for persistence-oriented behavior

## IDs And Naming Conventions

Current direction:

- use GUIDs early
- keep a human-readable piece near the GUID because plain GUIDs are bad for human authoring

Talking points:

- IDs should likely be globally unique in the normalized system
- `name_{guid}` is a useful author-facing compromise during prototyping
- humans need to see meaningful names while still getting machine-safe uniqueness
- later CMS-like tooling could reduce this problem, but that is not available now

Examples:

- `sunbleached_tree_{guid}`
- `old_harbor_edge_road_{guid}`

Open questions:

- whether front matter should keep both `id` and a separate short `name`
- how section names like `choice:walk` or `flow:first_visit:forward` normalize into machine fields

## Preset Philosophy

Current direction:

- presets exist to reduce author friction, not to create runtime inheritance chains

Talking points:

- base schema defines runtime shape
- presets are authoring helpers that prefill common config and content structure
- presets should prevent repetitive setup for common objects without creating ad hoc one-off runtime behaviors
- optional fields in area, path, and gate configs make presets especially useful

Examples:

- business door
- guarded door
- secret door
- password door

Important distinction:

- a business door may mainly add richer descriptive defaults such as business hours, closed/open flavor, or storefront POIs
- a speak-easy or password door may later grow extra functionality, but that should still build on a gate shape rather than becoming a completely different system too early

## Minimal Vertical Slice

Current direction:

- keep the first slice small, but do include the idea of a gate

Talking points:

- include at least one Area
- include at least one Path
- include at least one Gate
- keep state shallow or mostly absent
- no inventory or full NPC systems yet
- support first visit, repeat visit, random variants, and explicit none
- render it in the minimal terminal-style UI

Useful gate example for the slice:

- a business door that is billboard-like and not enterable yet
- it can still expose useful flavor such as open/closed messaging, business hours, interior sound hints, a knock action, or a vitrine-like look-in option

Why this matters:

- it proves the gate idea without requiring full interior content
- it keeps the prototype grounded in player feel rather than system depth

## Follow-Up Docs To Write

Most useful next notes:

1. `SourceFormatV0.md`
2. `ParserRulesV0.md`
3. `NavigationAndTraversalV0.md`
4. a future-phase note for persistence and randomness policy

These would convert the current conversation into implementation-ready guidance without forcing the whole system to become rigid too early.