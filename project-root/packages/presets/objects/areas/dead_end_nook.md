---
presetId: dead_end_nook
presetType: object
nodeKind: area
category: nook
summary: Small optional stop Area for a lookout, alcove, storage niche, or shrine corner.
tags:
  - area
  - nook
  - dead-end
  - optional-stop
searchTerms:
  - nook area
  - alcove
  - dead end area
  - lookout pocket
useCases:
  - shrine corner
  - lookout niche
  - small storage stop
  - quiet pocket
relatedFixtures:
  - dead_end_area_behind_gate
complexity: low
---

# Dead-End Nook

## When To Use

Use this when the player should take a short detour for inspection, mood, or a minor discovery.

## Required Structure

- one arrival prose family
- one clear return exit
- optional 1-2 POIs

## Variation Ideas

- shrine shelf
- ruined alcove
- narrow lookout
- tool niche
- side bench

## Minimal Stripped Example

```md
---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: dead_end_nook
displayName: Dead-End Nook
region: starter_region

pois:
  - id: ledge
    displayName: Ledge

exits:
  - id: back_out
    targetId: nook_gate
    displayName: Back Out
    key: B
---

# Dead-End Nook

## enter
The space closes in quickly, but it holds just enough to reward a pause.

## poi:ledge
Something small has been left here.
```