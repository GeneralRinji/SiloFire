---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: shackrun1_oldharboredgeroad
displayName: ShackRun Threshold
tagline: A narrow cut between weathered boards and salt-stained stone.

presentation:
  forward: passthrough
  backward: passthrough

region: old_harbor

endpoints:
  forward:
    from: old_harbor_edge_road
    to: shack_run1
  backward:
    from: shack_run1
    to: old_harbor_edge_road
---

# ShackRun Threshold