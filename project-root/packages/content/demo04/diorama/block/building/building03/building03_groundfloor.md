---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building03_groundfloor
displayName: Building 03 Ground Floor
tagline: A narrow east-side room with more shadow than floor space.

region: diorama_block

pois:
  - id: back_shelves
    displayName: Back Shelves

exits:
  - id: building03_to_east
    targetId: building03groundfloor_sidewalk_east
    displayName: Out To East Sidewalk
    key: O
  - id: building03_to_upstairs
    targetId: building03_upstairs
    displayName: Upstairs
    key: U
---

# Building 03 Ground Floor

## enter
This room feels more like a side find than a main destination, which helps the block feel larger than it is.
The bell over the door gives a quick bright jingle behind you.

## enter
This room feels more like a side find than a main destination, which helps the block feel larger than it is.
The bell over the door answers with a softer, more uncertain ring.

## enter
This room feels more like a side find than a main destination, which helps the block feel larger than it is.
The bell at the door rattles harder than the movement deserved, then settles.

## poi:back_shelves
The shelves hold enough objects to imply history without resolving it.