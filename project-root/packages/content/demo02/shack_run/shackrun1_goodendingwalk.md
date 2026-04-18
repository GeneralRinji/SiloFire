---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: shackrun1_goodendingwalk
displayName: Last Walk Threshold
tagline: A narrow opening between staying put and finishing the route.

presentation:
  forward: passthrough
  backward: passthrough

region: old_harbor

endpoints:
  forward:
    from: shack_run1
    to: good_ending_walk
  backward:
    from: good_ending_walk
    to: shack_run1
---