---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_good
displayName: Good Ending
tagline: You found the edge of the quarter and took the right kind of leave from it.

region: lantern_quarter

navigationLabels:
  exits: [none]

pois:
  - id: credits
    displayName: Credits
    key: C

exits:
  - id: return_to_title_good
    targetId: gameovergood_titlescreen
    displayName: Return to Title
    key: T
---

# Good Ending

## enter
At the riverbank, the town finally reduces itself to something you can keep in memory without staying inside it.

## first_visit
This feels like the right way to leave: not chased out, not trapped in place, just done.

## poi:credits
Silofire demo03

Cardinal layout, town-block structure, and content wiring by Ashley and GitHub Copilot using GPT-5.4.