---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Prototype Hub
tagline: A tiny lobby prototype built to hold a future jukebox and whatever habits grow around it.

region: system

titleScreen:
  saveMode: single

navigationLabels:
  exits: [none]

exits:
  - id: start_prototype_hub
    targetId: outside_area
    displayName: Step Outside
    key: S
---

# Prototype Hub

## enter
A little test project built around one threshold, one lobby, and the promise that a jukebox will eventually deserve the room around it.

## first_visit
For now the job is smaller than the ambition: get to the door, get inside, and leave a clean place for same-node interaction to grow later.