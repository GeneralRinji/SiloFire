---
presetId: street_corner
presetType: object
nodeKind: area
category: street-node
summary: Area preset for a corner, fork, or junction where multiple routes meet but the node should still feel like a place.
tags:
  - area
  - street
  - corner
  - junction
searchTerms:
  - street corner
  - junction area
  - fork area
  - crossroads node
useCases:
  - corner lot
  - alley mouth
  - fork in road
  - small plaza corner
relatedFixtures:
  - visible_gate_threshold_between_areas
complexity: medium
---

# Street Corner

## When To Use

Use this when several routes meet, but the spot itself should still support inspection and authored arrival prose.

## Authoring Rules

- Keep exits legible and grouped.
- Use POIs to make the corner feel inhabited.
- Split the space if the exit list gets too dense.

## Variation Ideas

- signpost
- public bench
- shuttered kiosk
- lamp post
- corner shrine
- storm drain

## Minimal Stripped Example

```md
---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: street_corner
displayName: Street Corner
region: starter_region

pois:
  - id: signpost
    displayName: Signpost

exits:
  - id: west_exit
    targetId: west_route
    displayName: West
    key: W
  - id: east_exit
    targetId: east_route
    displayName: East
    key: E
  - id: south_exit
    targetId: south_route
    displayName: South
    key: S
---

# Street Corner

## enter
The corner gathers movement from several directions without becoming calm itself.

## poi:signpost
The signs are practical and worn.
```