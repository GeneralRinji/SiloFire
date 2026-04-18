---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: gameoverbad_titlescreen
displayName: Title Return Threshold

presentation:
  forward: passthrough
  backward: passthrough

region: system

endpoints:
  forward:
    from: game_over_bad
    to: title_screen
  backward:
    from: title_screen
    to: game_over_bad
---

# Title Return Threshold