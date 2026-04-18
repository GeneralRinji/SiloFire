---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: room_transition_gate
displayName: Room Transition
region: starter_region

presentation:
  forward: billboard
  backward: billboard

endpoints:
  forward:
    from: front_room_area
    to: rear_room_area
  backward:
    from: rear_room_area
    to: front_room_area
---

# Room Transition

## billboard:forward
The rear room lies beyond a smaller interior threshold.

## enter:forward
You move into the rear room.

## enter:backward
The front room opens up again behind you.