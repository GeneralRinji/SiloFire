---
presetId: shopfront_bundle
presetType: layout
category: business-bundle
summary: Concrete file bundle for the shopfront layout preset.
tags:
  - layout
  - bundle
  - shop
  - storefront
searchTerms:
  - shop bundle
  - storefront bundle
  - business layout bundle
useCases:
  - ai content generation planning
  - layout output counting
relatedFixtures:
  - visible_gate_threshold_between_areas
complexity: low
---

# Shopfront Bundle

This folder shows the exact file set an AI would usually generate for the `shopfront` layout.

## File Count

- `3 content files`
- `1 bundle README`

## Graph Shape

```mermaid
flowchart LR
  exterior_area[exterior_area]
  business_door_gate[business_door_gate]
  interior_area[interior_area]

  exterior_area --> business_door_gate --> interior_area
```

## Files

- `exterior_area.md`
- `business_door_gate.md`
- `interior_area.md`

## Intent

Use this bundle for small businesses, clinics, offices, or service counters where the threshold matters more than interior traversal.