---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: front_door_gate
displayName: Front Door
region: starter_region

presentation:
  forward: billboard
  backward: billboard

endpoints:
  forward:
    from: yard_area
    to: entry_path
  backward:
    from: entry_path
    to: yard_area
---

# Front Door

## billboard:forward
The front door marks the boundary between yard and house.

## enter:forward
You step inside.

## enter:backward
The yard lies beyond the threshold.