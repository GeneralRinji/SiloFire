---
presetId: invisible_area_gate_path_gate_area
presetType: fixture
category: passthrough-chain
summary: Canonical hidden support pattern for moving cleanly from one Area to another through invisible threshold and traversal nodes.
tags:
  - fixture
  - passthrough
  - gate
  - path
  - routing
searchTerms:
  - invisible gate and path
  - area gate path gate area
  - hidden support nodes
  - passthrough chain
useCases:
  - doorway support chain
  - alley transition
  - building threshold
  - traversal glue
relatedFixtures:
  - visible_gate_threshold_between_areas
complexity: medium
---

# Invisible Area -> Gate -> Path -> Gate -> Area

## When To Use

Use this pattern when two Areas should feel directly connected in the story, but the runtime still needs clean threshold and traversal structure.

Common uses:

- building exterior to interior
- alley to courtyard
- room to corridor to room
- street to business interior

## Why It Exists

This pattern prevents overloaded Areas and keeps traversal behavior available for later expansion.

It also gives you stable places to add blocked thresholds, visible threshold pages, or richer path prose later without rewriting the whole route.

## Node Pattern

1. origin Area
2. passthrough entry Gate
3. Path
4. passthrough exit Gate
5. destination Area

## Minimal Stripped Example

```md
Area exit targetId: business_entry_gate

Gate business_entry_gate
presentationMode: passthrough
endpoints.forward.from: street_area
endpoints.forward.to: shop_interior_path
endpoints.backward.from: shop_interior_path
endpoints.backward.to: street_area

Path shop_interior_path
directionality: bidirectional
endpoints.forward.from: business_entry_gate
endpoints.forward.to: business_exit_gate
endpoints.backward.from: business_exit_gate
endpoints.backward.to: business_entry_gate

Gate business_exit_gate
presentationMode: passthrough
endpoints.forward.from: shop_counter_area
endpoints.forward.to: shop_interior_path
endpoints.backward.from: shop_interior_path
endpoints.backward.to: shop_counter_area
```

## Authoring Notes

- The two Gates can start as passthrough even if they become visible later.
- The Path can stay extremely short at first or even invisible.
- Keep ids readable as adjacent-node joins.
- Keep the Path if you expect pacing, blockage, or one-way behavior later.

## Related Presets

- `objects/gates/billboard_business_door.md`
- `objects/paths/minimal_passthrough_connector.md`
- `layouts/two_room_house.md`