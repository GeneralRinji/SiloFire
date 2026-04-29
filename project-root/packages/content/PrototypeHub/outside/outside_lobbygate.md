---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: outside_lobbygate
displayName: Prototype Hub Door
tagline: A glass threshold framed by tired neon and a room that sounds busier than the posted hours suggest.

presentation:
  forward: billboard
  backward: billboard

region: prototypehub

navigationLabels:
  pois: Door Details
  choices: What You Do

controlLabels:
  back: Step Away From The Door

pois:
  - id: business_hours
    displayName: Business Hours
    key: H

endpoints:
  forward:
    from: lobby_area
    to: outside_area
---

# Prototype Hub Door

## enter:backward
Up close, the door is ordinary in all the wrong ways: aluminum frame, hand-smudged glass, and just enough give in the handle to make you try it.

## billboard:backward
The neon reflection breaks across the glass in pink and sour blue bands while conversation mutters from the far side of the door.

## enter:forward
From inside, the door feels less dramatic, more like a hinge between the test room and the street.

## billboard:forward
The lobby gathers close behind you while the window glow turns the glass into a dim electric mirror.