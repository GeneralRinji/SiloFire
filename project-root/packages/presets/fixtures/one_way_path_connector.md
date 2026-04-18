---
presetId: one_way_path_connector
presetType: fixture
category: one-way
summary: Canonical graph pattern for a traversal route that only admits entry from one side.
tags:
  - fixture
  - path
  - one-way
searchTerms:
  - one way path fixture
  - forward only route
  - no return traversal
useCases:
  - drop
  - chute
  - one-way alley
  - forced route
relatedFixtures:
  - blocked_path_connector
complexity: low
---

# One-Way Path Connector

## When To Use

Use this when the movement sequence should only work from one side, but it still needs to be a real Path.

## Node Pattern

1. source threshold or Area
2. one-way Path
3. destination threshold or Area

## Minimal Stripped Example

```md
Path narrow_drop_path
directionality: forward_only
endpoints.forward.from: upper_gate
endpoints.forward.to: lower_gate

## flow:first_visit:forward
### beat
There is only one way through.
```

## Authoring Notes

- Do not author unsupported opposite-direction flows unless the route is actually bidirectional.
- Use this instead of faking a one-way threshold when the traversal itself is part of the fiction.

## Related Presets

- `objects/paths/one_way_connector.md`