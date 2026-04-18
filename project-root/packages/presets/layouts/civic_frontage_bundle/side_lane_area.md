---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: side_lane_area
displayName: Side Lane
region: starter_region

exits:
  - id: to_service_entrance
    targetId: service_entrance_gate
    displayName: Approach The Service Entrance
    key: E
  - id: back_to_frontage
    targetId: public_frontage_area
    displayName: Return To The Front
    key: B
---

# Side Lane

## enter
The side of the building is quieter and more practical than the front.