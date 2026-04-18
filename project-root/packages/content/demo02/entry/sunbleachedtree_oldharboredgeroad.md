---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: sunbleachedtree_oldharboredgeroad
displayName: ShackRun Threshold
tagline: A narrow cut between weathered boards and salt-stained stone.

presentation:
  forward: passthrough
  backward: passthrough

region: old_harbor

endpoints:
  forward:
    from: sunbleached_tree
    to: old_harbor_edge_road
  backward:
    from: old_harbor_edge_road
    to: sunbleached_tree
---

# ShackRun Threshold