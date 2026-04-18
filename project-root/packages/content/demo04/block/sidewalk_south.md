---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_south
displayName: South Sidewalk
tagline: The softest edge of the block, where evening feels like it has already arrived.

region: diorama_block

pois:
  - id: benches
    displayName: Benches

exits:
  - id: south_to_east
    targetId: sidewalk_east
    displayName: East
    key: E
  - id: south_to_west
    targetId: sidewalk_west
    displayName: West
    key: W
  - id: south_to_building04
    targetId: building04_groundfloor
    displayName: Building 04
    key: B
---

# South Sidewalk

## enter
The south side of the block has the kind of calm that makes a last stop feel plausible.

## poi:benches
The benches are not comfortable, but they are exactly placed.