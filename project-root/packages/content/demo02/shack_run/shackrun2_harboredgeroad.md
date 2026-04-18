---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: shackrun2_harboredgeroad
displayName: Harbor Edge Threshold
tagline: The more traveled road toward town still starts in the same splintered place.

presentation:
  forward: passthrough
  backward: passthrough

region: old_harbor

endpoints:
  forward:
    from: shack_run2
    to: harbor_edge_road
  backward:
    from: harbor_edge_road
    to: shack_run2
---