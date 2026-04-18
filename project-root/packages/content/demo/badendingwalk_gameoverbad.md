---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: badendingwalk_gameoverbad
displayName: Bad Ending Threshold
tagline: The yard gives way to consequence without ceremony.

presentation:
  forward: passthrough
  backward: passthrough

region: old_harbor

endpoints:
  forward:
    from: bad_ending_walk
    to: game_over_bad
  backward:
    from: game_over_bad
    to: bad_ending_walk
---