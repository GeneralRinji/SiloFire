---
presetId: blocked_visible_gate
presetType: fixture
category: blocked-threshold
summary: Visible threshold pattern for a Gate that stops movement on a blocked approach and surfaces authored blocked prose.
tags:
  - fixture
  - gate
  - blocked
  - threshold
searchTerms:
  - blocked gate
  - locked threshold
  - barred door
  - obstructed entrance
useCases:
  - locked door
  - barred gate
  - guarded checkpoint
  - collapsed threshold
relatedFixtures:
  - visible_gate_threshold_between_areas
complexity: low
---

# Blocked Visible Gate

## When To Use

Use this when the player should hit a threshold, fail to continue, and receive authored blocked-threshold prose.

## Node Pattern

1. origin Area
2. visible Gate with blocked direction
3. destination Area or Path behind it

## Minimal Stripped Example

```md
Gate archive_door
presentation.forward: billboard
blocking.forward: blocked
endpoints.forward.from: hall_area
endpoints.forward.to: archive_area

## blocked:forward
The door is chained shut.
```

## Authoring Notes

- Use `directionality` for one-way logic and `blocking` for temporary or authored obstruction.
- Keep blocked prose specific about what prevents travel.
- This pattern can later become open without changing the overall graph shape.

## Related Presets

- `objects/gates/billboard_business_door.md`