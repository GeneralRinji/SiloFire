---
presetId: fixtures_catalog
presetType: fixture
category: catalog
summary: Canonical graph-support patterns for invisible routing nodes and common traversal structures.
tags:
  - fixtures
  - topology
  - routing
  - support-nodes
searchTerms:
  - passthrough gate chain
  - invisible gate
  - support path
  - threshold pattern
  - one way route
useCases:
  - graph planning
  - invisible support nodes
  - content ai handoff
complexity: low
---

# Fixture Patterns

Use fixture patterns when you need graph structure more than flavor.

These are the patterns the content AI should know before inventing direct exits that skip needed support nodes.

## Core Canonical Patterns

### invisible_area_gate_path_gate_area

Use when movement should remain structurally correct but both thresholds are invisible passthrough support nodes.

This is the default hidden support chain.

### visible_gate_threshold_between_areas

Use when the threshold itself matters but a separate Path is unnecessary.

See `visible_gate_threshold_between_areas.md`.

### one_way_path_connector

Use when travel should only be legal from one side.

See `one_way_path_connector.md`.

### blocked_path_connector

Use when the route exists structurally but traversal is currently obstructed.

See `blocked_path_connector.md`.

### blocked_visible_gate

Use when a threshold should surface a blocked approach page rather than silently rejecting movement.

See `blocked_visible_gate.md`.

### dead_end_area_behind_gate

Use when the player reaches a small stop or pocket that should still resolve back out through a threshold cleanly.

See `dead_end_area_behind_gate.md`.

## Starting Rule

If an Area seems like it needs too many exits or too much traversal behavior, check whether one of these fixture patterns should be inserted instead of flattening the graph.