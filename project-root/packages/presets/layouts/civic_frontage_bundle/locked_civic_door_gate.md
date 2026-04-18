---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: locked_civic_door_gate
displayName: Locked Civic Door
region: starter_region

presentation:
  forward: billboard
  backward: billboard

blocking:
  forward: blocked

endpoints:
  forward:
    from: public_frontage_area
    to: records_room_area
  backward:
    from: records_room_area
    to: public_frontage_area
---

# Locked Civic Door

## billboard:forward
Official notices and dark glass make the entrance feel unavailable.

## blocked:forward
The main entrance is locked to the public right now.