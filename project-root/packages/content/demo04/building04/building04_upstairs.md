---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building04_upstairs
displayName: Building 04 Upstairs
tagline: The smallest and most private room on the block, arranged like an ending that was waiting for you to notice it.

region: diorama_block

pois:
  - id: bed
    displayName: Bed
    key: B
  - id: night_light
    displayName: Night Light
    key: N
  - id: bedside_lamp
    displayName: Bedside Lamp
    key: L

exits:
  - id: building04_downstairs
    targetId: building04_groundfloor
    displayName: Downstairs
    key: D
---

# Building 04 Upstairs

## enter
The room is simple, but in a diorama that matters. It tells you where the day can actually end.

## poi:bed
In daylight the bed looks tidy rather than tempting, something prepared in advance for a later hour.

## poi:night_light
The little night light is plugged in low near the floor, easy to ignore until the room goes dark.

## poi:bedside_lamp
The bedside lamp throws most of the room's character when it is allowed to.