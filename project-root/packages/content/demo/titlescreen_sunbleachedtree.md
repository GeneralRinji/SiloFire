---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: titlescreen_sunbleachedtree
displayName: Title Screen Threshold
tagline: A quiet handoff into the harbor path.

presentation:
  forward: passthrough
  backward: passthrough

region: system

endpoints:
  forward:
    from: title_screen
    to: sunbleached_tree
  backward:
    from: sunbleached_tree
    to: title_screen
---

# Title Screen Threshold