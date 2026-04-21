---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_bad
name: game_over_bad
displayName: Bad Ending
tagline: The harbor does not forgive every choice.

region: old_harbor

passthrough: false

tags:
  - ending
  - bad
  - harbor

navigationLabels:
  pois: For The Curious
  exits: [none]

pois:
  - id: credits
    displayName: Credits
    key: C

exits:
  - id: gameoverbad_title
    targetId: title_screen
    displayName: Return to Title
    key: T
---

# Bad Ending

## enter
The porch knife was always real.
[delay: medium]
So were the consequences.

---

## first_visit
The harbor keeps breathing without you.

---

## poi:credits
Silofire demo

Words, structure, and stubborn harbor atmosphere by Ashley.

Additional implementation support by GitHub Copilot using GPT-5.4.