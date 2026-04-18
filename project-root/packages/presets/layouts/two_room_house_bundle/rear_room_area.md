---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: rear_room_area
displayName: Rear Room
region: starter_region

pois:
  - id: bedroll
    displayName: Bedroll

exits:
  - id: rear_room_to_front_gate
    targetId: room_transition_gate
    displayName: Back To The Front Room
    key: F
---

# Rear Room

## enter
The rear room is smaller and more private.

## poi:bedroll
The sleeping space is kept simple.