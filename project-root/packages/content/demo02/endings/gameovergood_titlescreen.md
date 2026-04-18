---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: gameovergood_titlescreen
displayName: Title Return Threshold
tagline: A quiet handoff from ending back to beginning.

presentation:
  forward: passthrough
  backward: passthrough

region: system

endpoints:
  forward:
    from: game_over_good
    to: title_screen
  backward:
    from: title_screen
    to: game_over_good
---