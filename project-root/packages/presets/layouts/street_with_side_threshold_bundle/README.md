---
presetId: street_with_side_threshold_bundle
presetType: layout
category: street-bundle
summary: Concrete file bundle for the street-with-side-threshold layout preset.
tags:
  - layout
  - bundle
  - street
  - corridor
searchTerms:
  - street bundle
  - corridor bundle
  - multi file layout
useCases:
  - ai content generation planning
  - layout output counting
relatedFixtures:
  - invisible_area_gate_path_gate_area
  - visible_gate_threshold_between_areas
complexity: medium
---

# Street With Side Threshold Bundle

This folder shows the exact file set an AI would usually generate for the `street_with_side_threshold` layout.

## File Count

- `5 content files`
- `1 bundle README`

## Graph Shape

```mermaid
flowchart LR
  west_area[west_area]
  street_path[street_path]
  east_area[east_area]
  side_gate[side_gate]
  side_area[side_area]

  west_area --> street_path --> east_area
  east_area --> side_gate --> side_area
```

## Runtime Note

This bundle uses the side threshold off `east_area` rather than directly off `street_path` because current Path pages do not expose side-exit actions.

## Files

- `west_area.md`
- `street_path.md`
- `east_area.md`
- `side_gate.md`
- `side_area.md`

## Intent

Use this bundle when you want a main route plus one optional threshold stop.

Keep the node prose stripped at first.

Add richer style only after the file set and routing are correct.