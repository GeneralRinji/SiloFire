---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: North Sidewalk
tagline: The brighter side of the block, with windows full of other people's arrangements.

region: diorama_block

pois:
  - id: streetlamps
    displayName: Streetlamps

exits:
  - id: north_to_building01
    targetId: building01_groundfloor
    displayName: Building 01
    key: A
  - id: north_to_building02
    targetId: building02_groundfloor
    displayName: Building 02
    key: B
  - id: north_to_east
    targetId: sidewalk_east
    displayName: East
    key: E
  - id: north_to_west
    targetId: sidewalk_west
    displayName: West
    key: W
---

# North Sidewalk

## enter
The north side of the block feels arranged for looking more than lingering.

## poi:streetlamps
The lamps make even the ordinary storefront glass feel slightly staged.