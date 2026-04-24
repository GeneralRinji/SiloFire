# Predicate Reference v1

This document is the compact working reference for authored predicate shapes that are currently supported.

Use it when writing or reviewing predicate sidecars such as `predicates/project.yaml`, NPC-local predicate blocks, and `when` clauses inside sidecar events or schedules.

This is a practical reference, not a future-feature wishlist.

If a form is not listed here, do not assume it exists.

## Supported Predicate Shapes

### Named Predicate Reference

Use this when you want one predicate to reuse another predicate by name.

```yaml
predicate: is_dawn
```

Current practical use:

- reuse shared project predicates inside `all` and `any`
- keep repeated conditions in one place instead of restating them everywhere

### Equality Check

Use `equals` when you want to compare two operands.

```yaml
equals: [world.time.phase, dawn]
```

Current practical use:

- compare state fields to literal values
- compare story state to authored labels such as `idle`
- compare object booleans to `true` or `false`

### Presence Check

Use `present` when you only need truthiness.

```yaml
present: [objects.building04_morning_paper.available]
```

Current practical use:

- truthy flags
- optional values that should count as present when non-empty

If you need explicit `true` or `false`, prefer `equals` instead.

### Same-Location Check

Use `same_location` when two location-like operands should match.

```yaml
same_location: [npcs.resident_01.location, player.location]
```

Current practical use:

- actor/NPC proximity checks
- player and NPC location alignment checks

This currently resolves like an equality comparison, but `same_location` is the clearer authored form for location intent.

### All Of

Use `all` when every nested condition must pass.

```yaml
all:
  - predicate: is_night
  - predicate: night_light_is_on
  - predicate: bedside_lamp_is_off
```

Current practical use:

- multi-condition gates
- dialogue progression requirements
- state plus time combinations

### Any Of

Use `any` when at least one nested condition must pass.

```yaml
any:
  - predicate: resident_dialog_greeting
  - predicate: resident_dialog_room_advice
```

Current practical use:

- grouped dialogue states
- open-hours style checks spanning multiple phases

## Operand Resolution Rules

Predicate operands may be literal values or scoped runtime paths.

Current practical rule:

- if a string matches a known runtime path, the runtime resolves its current value
- if a string does not resolve as a known path, it is treated as a literal string

That is why this works:

```yaml
equals: [world.time.phase, dawn]
```

`world.time.phase` resolves to the current phase value, while `dawn` remains the literal string to compare against.

## Common Operand Paths

Common current examples include:

- `world.time.phase`
- `world.weather.kind`
- `objects.<object_id>.<field>`
- `npcs.<npc_id>.location`
- `story.<branch>.<field>`
- `player.location`
- `actor.<field_path>`
- `viewer.<field_path>`

Use existing demo content as the baseline for path style.

## Current Examples

Time checks:

```yaml
is_dawn:
  equals: [world.time.phase, dawn]
```

Object availability:

```yaml
counter_mint_available:
  equals: [objects.building02_counter_mint.available, true]
```

Location match:

```yaml
resident_is_nearby:
  same_location: [npcs.resident_01.location, player.location]
```

Composed state:

```yaml
building04_can_sleep:
  all:
    - predicate: is_night
    - predicate: night_light_is_on
    - predicate: bedside_lamp_is_off
```

## Practical Authoring Rules

- keep reusable conditions in named predicates instead of repeating large inline trees everywhere
- prefer `equals` over `present` when exact `true` or `false` matters
- prefer `same_location` over raw `equals` when the intent is proximity or co-location
- use `all` and `any` to compose readable rules rather than inventing unsupported operators
- if you need a pattern not shown here, check runtime support before authoring it

## Current Non-Goals

Do not assume these exist unless the runtime is extended and the docs are updated:

- `not`
- `not_equals`
- comparison operators like `gt`, `lt`, `gte`, `lte`
- regex or substring operators
- freeform expression languages

Current safe rule:

- if you cannot express the behavior with `predicate`, `equals`, `present`, `same_location`, `all`, or `any`, do not invent new predicate syntax in content.