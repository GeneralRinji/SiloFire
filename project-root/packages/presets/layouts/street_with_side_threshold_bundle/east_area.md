---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: east_area
displayName: East Area
region: starter_region

exits:
  - id: east_to_street
    targetId: street_path
    displayName: Back West
    key: W
  - id: east_to_side_gate
    targetId: side_gate
    displayName: Side Threshold
    key: S
---

# East Area

## enter
The main route reaches its far side here.