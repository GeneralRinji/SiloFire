---
presetId: civic_frontage_bundle
presetType: layout
category: civic-bundle
summary: Concrete file bundle for a civic frontage with blocked public access and a side service route.
tags:
  - layout
  - bundle
  - civic
  - blocked-entry
searchTerms:
  - civic bundle
  - archive frontage bundle
  - blocked door bundle
useCases:
  - ai content generation planning
  - file count planning
relatedFixtures:
  - blocked_visible_gate
complexity: medium
---

# Civic Frontage Bundle

This folder shows the exact file set an AI would usually generate for the `civic_frontage` layout.

## File Count

- `5 content files`
- `1 bundle README`

## Graph Shape

```mermaid
flowchart LR
  public_frontage_area[public_frontage_area]
  locked_civic_door_gate[locked_civic_door_gate]
  side_lane_area[side_lane_area]
  service_entrance_gate[service_entrance_gate]
  records_room_area[records_room_area]

  public_frontage_area --> locked_civic_door_gate
  public_frontage_area --> side_lane_area --> service_entrance_gate --> records_room_area
```

## Files

- `public_frontage_area.md`
- `locked_civic_door_gate.md`
- `side_lane_area.md`
- `service_entrance_gate.md`
- `records_room_area.md`

## Intent

Use this bundle when the public face of the building should deny access, but the location still needs a second, lower-profile way in.