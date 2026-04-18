---
presetId: two_room_house_bundle
presetType: layout
category: house-bundle
summary: Concrete file bundle for the two-room-house layout preset.
tags:
  - layout
  - bundle
  - house
  - two-room
searchTerms:
  - two room house bundle
  - cottage bundle
  - shack bundle
  - multi file house layout
useCases:
  - ai content generation planning
  - layout output counting
relatedFixtures:
  - invisible_area_gate_path_gate_area
complexity: medium
---

# Two-Room House Bundle

This folder shows the exact file set an AI would usually generate for the `two_room_house` layout.

## File Count

- `6 content files`
- `1 bundle README`

## Graph Shape

```mermaid
flowchart LR
  yard_area[yard_area]
  front_door_gate[front_door_gate]
  entry_path[entry_path]
  front_room_area[front_room_area]
  room_transition_gate[room_transition_gate]
  rear_room_area[rear_room_area]

  yard_area --> front_door_gate --> entry_path --> front_room_area --> room_transition_gate --> rear_room_area
```

## Files

- `yard_area.md`
- `front_door_gate.md`
- `entry_path.md`
- `front_room_area.md`
- `room_transition_gate.md`
- `rear_room_area.md`

## Intent

Use this bundle when one interior Area would be too crowded, but a larger mansion or compound layout would be excessive.

Keep the node prose stripped at first.

Add richer style after the file set and routing are correct.