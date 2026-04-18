---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: business_door_gate
displayName: Business Door
region: starter_region

presentation:
  forward: billboard
  backward: billboard

endpoints:
  forward:
    from: exterior_area
    to: interior_area
  backward:
    from: interior_area
    to: exterior_area
---

# Business Door

## billboard:forward
The door and its signage do the work of introduction.

## enter:forward
You step inside.

## enter:backward
The street remains just beyond the threshold.