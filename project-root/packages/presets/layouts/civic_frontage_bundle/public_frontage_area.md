---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: public_frontage_area
displayName: Public Frontage
region: starter_region

pois:
  - id: posted_notice
    displayName: Posted Notice

exits:
  - id: to_locked_civic_door
    targetId: locked_civic_door_gate
    displayName: Try The Main Door
    key: M
  - id: to_side_lane
    targetId: side_lane_area
    displayName: Follow The Side Lane
    key: S
---

# Public Frontage

## enter
The building faces the street with official distance.

## poi:posted_notice
The notice board suggests the public path may not be the only path.