---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: side_gate
displayName: Side Gate
region: starter_region

presentation:
  forward: billboard
  backward: billboard

endpoints:
  forward:
    from: east_area
    to: side_area
  backward:
    from: side_area
    to: east_area
---

# Side Gate

## billboard:forward
An optional threshold branches off the main route.

## enter:forward
You step off the main way.

## enter:backward
The main route waits just beyond.