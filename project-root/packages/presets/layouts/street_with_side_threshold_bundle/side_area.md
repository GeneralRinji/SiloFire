---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: side_area
displayName: Side Area
region: starter_region

pois:
  - id: detail
    displayName: Small Detail

exits:
  - id: side_to_gate
    targetId: side_gate
    displayName: Back To The Route
    key: B
---

# Side Area

## enter
This small stop sits just off the main route.

## poi:detail
Something here justifies the detour.