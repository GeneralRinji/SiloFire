---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_good
displayName: Good Ending
tagline: The block closes up around a final upstairs light.

region: diorama_block

navigationLabels:
  exits: [none]

pois:
  - id: credits
    displayName: Credits
    key: C

exits:
  - id: demo04_return_to_title
    targetId: gameovergood_titlescreen
    displayName: Return To Title
    key: T
---

# Good Ending

## enter
You let the block stay small. Sleep comes easy, the dreams stay sweet, the windows dim, and upstairs becomes the right final scale.

## first_visit
This is less escape than closure, which fits a diorama better anyway.

## poi:credits
Silofire demo04

Diorama block sample adapted into content by Ashley and GitHub Copilot using GPT-5.4.