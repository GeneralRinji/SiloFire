---
presetId: visible_gate_threshold_between_areas
presetType: fixture
category: threshold
summary: Direct Area-to-Area threshold pattern where the Gate itself is the important authored page.
tags:
  - fixture
  - gate
  - threshold
  - visible
searchTerms:
  - visible gate between rooms
  - threshold page
  - direct gate connection
  - billboard threshold
useCases:
  - front door
  - checkpoint
  - guarded interior doorway
  - named threshold
relatedFixtures:
  - blocked_visible_gate
  - dead_end_area_behind_gate
complexity: low
---

# Visible Gate Threshold Between Areas

## When To Use

Use this when the threshold itself matters and the player should stop on it as a page.

This is the right pattern when a separate traversal Path would add noise rather than value.

## Node Pattern

1. origin Area
2. visible Gate
3. destination Area

## Minimal Stripped Example

```md
Area exit targetId: front_door_gate

Gate front_door_gate
presentation.forward: billboard
presentation.backward: billboard
endpoints.forward.from: yard_area
endpoints.forward.to: foyer_area
endpoints.backward.from: foyer_area
endpoints.backward.to: yard_area

Gate prose:
## billboard:forward
The door is shut, but the house is clearly occupied.

## enter:forward
The latch gives.
```

## Authoring Notes

- Use directional prose if the outer and inner faces differ.
- Let the Gate expose POIs or choices if the threshold itself has interaction value.
- Keep this pattern simple if the threshold only needs one moment of attention.

## Related Presets

- `objects/gates/billboard_business_door.md`