---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building04_groundfloor
displayName: Building 04 Ground Floor
tagline: A softer room on the south side, more residence than frontage.

region: diorama_block

pois:
  - id: coat_rack
    displayName: Coat Rack
  - id: doormat
    displayName: Front Doormat
    key: F

exits:
  - id: building04_to_south
    targetId: sidewalk_south
    displayName: Out To South Sidewalk
    key: O
  - id: building04_to_upstairs
    targetId: building04_upstairs
    displayName: Upstairs
    key: U
---

# Building 04 Ground Floor

## enter
This building feels like the place where the whole little block stops performing and starts settling down.

## poi:coat_rack
Everything about the rack suggests someone expects to come home at the end of the walk.

## poi:doormat
The mat sits square to the door, the kind of small threshold detail that only looks important when something has been left on it.