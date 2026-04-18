---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_good
name: game_over_good
displayName: Good Ending
tagline: At least this time, the road really did lead somewhere.

region: old_harbor

passthrough: false

tags:
  - ending
  - good
  - harbor

navigationLabels:
  pois: [delay: long] For The Curious
  exits: [none]

pois:
  - id: credits
    displayName: [delay: long] Credits
    key: C

exits:
  - id: gameovergood_title
    targetId: gameovergood_titlescreen
    displayName: Return to Title
    key: T
---

# Good Ending

## enter
The harbor finally falls quiet enough to hear yourself think.

---

## first_visit
For once, leaving feels less like surrender and more like choosing a direction.

---

## poi:credits
Silofire demo

Words, structure, and stubborn harbor atmosphere by Ashley.

Additional implementation support by GitHub Copilot using GPT-5.4.