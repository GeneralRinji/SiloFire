---
presetId: service_entrance
presetType: object
nodeKind: gate
category: service-door
summary: Low-ceremony side or back entrance threshold for alleys, delivery doors, staff access, and secondary building entry.
tags:
  - gate
  - service-door
  - back entrance
  - alley
searchTerms:
  - service entrance
  - back door
  - delivery door
  - side entrance
  - staff entrance
useCases:
  - alley access
  - loading entrance
  - staff-only threshold
  - side building entry
relatedFixtures:
  - visible_gate_threshold_between_areas
  - invisible_area_gate_path_gate_area
complexity: low
---

# Service Entrance

## When To Use

Use this when the threshold should feel quieter and less ceremonial than a front-facing business door.

## When Not To Use

- Do not use it when public signage or invitation is the point.
- Do not use it when the threshold should carry a formal or guarded presence.

## Required Structure

- `templateSchema: gate`
- `templateSchemaVersion: 1`
- `id`, `displayName`, `region`
- directional `presentation` if the two faces differ
- `endpoints` if the threshold resolves onward movement

## Variation Ideas

- metal delivery door
- side stairwell entrance
- grimy alley access
- employee-only notice
- latch, buzzer, or pull-chain

## Minimal Stripped Example

```md
---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: service_entrance
displayName: Service Entrance
region: town_row

presentation:
  forward: billboard
  backward: billboard

endpoints:
  forward:
    from: alley_area
    to: back_room_area
  backward:
    from: back_room_area
    to: alley_area
---

# Service Entrance

## billboard:forward
The entrance is plain, functional, and easy to overlook.

## enter:forward
The door yields with a practical scrape.

## enter:backward
The alley waits behind you.
```