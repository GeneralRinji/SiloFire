---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building02_groundfloor
displayName: Building 02 Ground Floor
tagline: A street-facing room that feels like it was once more public than it is now.

region: diorama_block

pois:
  - id: counter
    displayName: Counter
  - id: sample_bowl
    displayName: Sample Bowl

choices:
  - id: take_counter_mint
    displayName: Take Wrapped Mint
    key: M

exits:
  - id: building02_to_north
    targetId: sidewalk_north
    displayName: Out To North Sidewalk
    key: O
  - id: building02_to_upstairs
    targetId: building02_upstairs
    displayName: Upstairs
    key: U
---

# Building 02 Ground Floor

## enter
The room still reads like a shop, even without customers to prove it.

## poi:counter
The counter is the sort of object that makes an empty room feel recently abandoned.

## poi:sample_bowl
A small bowl sits near the till, the kind of thing meant to make a room feel hospitable even when no one is tending it.