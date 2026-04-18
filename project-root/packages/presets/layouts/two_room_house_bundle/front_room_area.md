---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: front_room_area
displayName: Front Room
region: starter_region

pois:
  - id: table
    displayName: Table

exits:
  - id: front_room_to_entry
    targetId: entry_path
    displayName: Back To The Entry
    key: B
  - id: front_room_to_rear_gate
    targetId: room_transition_gate
    displayName: Toward The Rear Room
    key: R
---

# Front Room

## enter
The front room handles most of the day-to-day use of the house.

## poi:table
The table anchors the room.