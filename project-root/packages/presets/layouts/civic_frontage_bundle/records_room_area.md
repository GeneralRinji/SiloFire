---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: records_room_area
displayName: Records Room
region: starter_region

pois:
  - id: filing_wall
    displayName: Filing Wall

exits:
  - id: back_to_service_entrance
    targetId: service_entrance_gate
    displayName: Back To The Service Entrance
    key: B
---

# Records Room

## enter
The room is built for storage, process, and controlled access.

## poi:filing_wall
Rows of labeled storage make the room's purpose unmistakable.