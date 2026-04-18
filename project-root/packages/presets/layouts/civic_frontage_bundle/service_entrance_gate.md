---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: service_entrance_gate
displayName: Service Entrance
region: starter_region

presentation:
  forward: billboard
  backward: billboard

endpoints:
  forward:
    from: side_lane_area
    to: records_room_area
  backward:
    from: records_room_area
    to: side_lane_area
---

# Service Entrance

## billboard:forward
This door looks like it exists for deliveries and staff, not visitors.

## enter:forward
The side entrance opens on practical hinges.

## enter:backward
The service lane waits behind you.