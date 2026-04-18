---
presetId: one_room_shack
presetType: object
nodeKind: area
category: small-room
summary: Small single-room Area built around POIs and one or two exits rather than heavy traversal.
tags:
  - area
  - shack
  - room
  - interior
  - poi
searchTerms:
  - one room house
  - shack interior
  - hut
  - cabin room
  - sparse interior
useCases:
  - small dwelling
  - storage room
  - fisherman shack
  - abandoned hut
relatedFixtures:
  - dead_end_area_behind_gate
  - invisible_area_gate_path_gate_area
complexity: low
---

# One-Room Shack

## When To Use

Use this when the player should pause and inspect a small interior rather than traverse through multiple movement beats.

## When Not To Use

- Do not use it for a space that obviously wants multiple rooms.
- Do not use it when the movement through the space is the point; use a Path or layout preset instead.

## Required Structure

- `templateSchema: area`
- `templateSchemaVersion: 1`
- `id`, `displayName`, `region`
- one arrival prose family such as `enter`, `first_visit`, or `repeat_visit`

## Useful Optional Structure

- `pois` for cot, table, stove, crate, window, shelf
- `choices` for rest, listen, search, wait
- one exit back to the threshold node

## Suggested POI Ideas

- cot or bedroll
- crate or chest
- small table
- stove or brazier
- shelf or peg rail
- window slit

## Authoring Rules

- Favor POIs over too many exits.
- Keep the room readable at a glance.
- Use repeated POI sections for layered inspection rather than adding too many separate POIs.

## Minimal Stripped Example

```md
---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: one_room_shack
displayName: One-Room Shack
region: old_harbor

pois:
  - id: cot
    displayName: Cot
  - id: crate
    displayName: Crate

exits:
  - id: back_to_door
    targetId: shack_door
    displayName: Back To The Door
    key: B
---

# One-Room Shack

## enter
One room. A cot, a crate, and enough open floor to make the place feel temporary.

## poi:cot
The rope is long gone.

## poi:crate
Empty.
```

## Variation Ideas

- inhabited versus abandoned
- fishing gear versus domestic clutter
- child-sized details versus adult-sized details
- storm damage versus careful repair

## Related Fixtures

- `fixtures/invisible_area_gate_path_gate_area.md`