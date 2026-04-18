---
presetId: blocked_path_connector
presetType: fixture
category: blocked-path
summary: Canonical Path-based obstruction pattern where the route exists structurally but traversal is blocked on an authored direction.
tags:
  - fixture
  - path
  - blocked
searchTerms:
  - blocked path fixture
  - obstructed route
  - traversal blocker
useCases:
  - fallen tree
  - rubble choke point
  - flooded passage
  - collapsed corridor
relatedFixtures:
  - one_way_path_connector
complexity: low
---

# Blocked Path Connector

## When To Use

Use this when the route should still exist as a Path, but one direction is currently obstructed.

## Minimal Stripped Example

```md
Path rubble_choke
directionality: bidirectional
blocking.forward: blocked

## flow:block:forward
### beat
Rubble seals the narrowest part of the route.
```

## Authoring Notes

- Put obstruction prose in `flow:block:<direction>`.
- Keep the route as a Path if the blockage may later clear or if the return side still works.

## Related Presets

- `objects/paths/minimal_passthrough_connector.md`