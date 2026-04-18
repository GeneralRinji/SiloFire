---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_bad
displayName: Bad Ending
tagline: The quarter did not defeat you, but it did outlast your patience.

region: lantern_quarter

navigationLabels:
  exits: [none]

pois:
  - id: reflection
    displayName: Sit With That
    key: R

exits:
  - id: return_to_title_bad
    targetId: gameoverbad_titlescreen
    displayName: Return to Title
    key: T
---

# Bad Ending

## enter
You turn away from the quarter with less resolution than you meant to have.

## first_visit
Nothing catastrophic happens. It is worse than that. The place simply wins by remaining itself until you stop asking more from it.

## poi:reflection
Some maps do not need to kill you to count as a loss.