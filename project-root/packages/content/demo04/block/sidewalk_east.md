---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_east
displayName: East Sidewalk
tagline: A narrower run of paving where the block seems to turn inward on itself.

region: diorama_block

exits:
  - id: east_to_north
    targetId: sidewalk_north
    displayName: North
    key: N
  - id: east_to_south
    targetId: sidewalk_south
    displayName: South
    key: S
  - id: east_to_building03
    targetId: building03groundfloor_sidewalk_east
    displayName: Building 03
    key: B
---

# East Sidewalk

## enter
Here the block feels less public, as if the windows have started keeping count of who passes.