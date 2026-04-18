---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: interior_area
displayName: Interior Area
region: starter_region

pois:
  - id: counter
    displayName: Counter

exits:
  - id: back_to_door
    targetId: business_door_gate
    displayName: Back To The Door
    key: B
---

# Interior Area

## enter
The interior is small enough to read as one place.

## poi:counter
The counter defines how the room is used.