---
presetId: object_catalog
presetType: object
category: catalog
summary: Index of stripped single-node presets grouped by content object family.
tags:
  - objects
  - catalog
  - presets
searchTerms:
  - object presets index
  - single node presets
  - areas gates paths
useCases:
  - ai retrieval
  - preset selection
complexity: low
---

# Object Presets

Use these when you need one legal node shape rather than a multi-node graph pattern.

## Families

### areas/

Use for authored places that can hold POIs and exits.

Examples:

- `one_room_shack.md`
- `dead_end_nook.md`
- `street_corner.md`

### gates/

Use for thresholds whose presentation, blocking, or directional traversal matters.

Examples:

- `billboard_business_door.md`
- `service_entrance.md`
- `locked_civic_door.md`

### paths/

Use for traversal connectors that carry movement forward or backward between nodes.

Examples:

- `minimal_passthrough_connector.md`
- `one_way_connector.md`
- `paged_street_segment.md`

## Selection Rule

If the question is “what should one node of this kind look like,” start here before reaching for a layout.