---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Diorama Block
tagline: A tiny block for wandering, peeking in windows, and eventually calling it a night.

region: system

titleScreen:
  saveMode: single

navigationLabels:
  exits: [none]

exits:
  - id: start_demo04
    targetId: building01_groundfloor
    displayName: Start In Building 01
    key: C
---

# Diorama Block

## enter
A whole block reduced to the parts that matter: sidewalks, stairways, windows, and a place to end the day.

## first_visit
Start upstairs if you want privacy, start outside if you want geometry, but either way the block is small enough to learn by walking.