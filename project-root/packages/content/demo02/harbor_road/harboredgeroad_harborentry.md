---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: harboredgeroad_harborentry
displayName: Harbor Entry Threshold
tagline: The road tightens again as the harbor proper starts to gather around it.

presentation:
  forward: passthrough
  backward: passthrough

region: old_harbor

endpoints:
  forward:
    from: harbor_edge_road
    to: harbor_entry
  backward:
    from: harbor_entry
    to: harbor_edge_road
---