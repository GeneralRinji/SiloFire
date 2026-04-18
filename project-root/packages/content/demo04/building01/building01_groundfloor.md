---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
tagline: A compact front room with enough detail to feel lived in and enough openness to keep moving.

region: diorama_block

pois:
  - id: front_window
    displayName: Front Window
  - id: vase_01
    displayName: Ceramic Vase
    key: V

choices:
  - id: straighten_vase
    displayName: Straighten The Vase
    key: S

exits:
  - id: building01_to_north
    targetId: sidewalk_north
    displayName: Out To North Sidewalk
    key: O
  - id: building01_to_upstairs
    targetId: building01_upstairs
    displayName: Upstairs
    key: U
---

# Building 01 Ground Floor

## enter
This is the cleanest introduction to the block: one room, one stair, and a window framing the street like a model.

## poi:front_window
From here, the north sidewalk feels almost diagrammatic.

## poi:vase_01
The ceramic glaze looks older than it is.