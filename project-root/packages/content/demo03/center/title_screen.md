---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Lantern Quarter
tagline: A compact MUD-style town block built around cardinal movement and readable room structure.

region: system

titleScreen:
  saveMode: single

navigationLabels:
  exits: [none]

exits:
  - id: start_walk
    targetId: town_square
    displayName: Start Walking
    key: C
---

# Lantern Quarter

## enter
Cobblestones, lamp glow, and a town small enough to cross on foot but busy enough to hide a few moods.

## first_visit
North leads to the river. East gathers trade. West keeps quieter company. South drifts toward the older quarter.