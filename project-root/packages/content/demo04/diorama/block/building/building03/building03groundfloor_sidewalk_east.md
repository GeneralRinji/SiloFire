---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: building03groundfloor_sidewalk_east
displayName: Building 03 Door
tagline: A narrow glass-front threshold that only really admits one customer at a time.

presentation:
  forward: billboard
  backward: billboard

region: diorama_block

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
    from: building03_groundfloor
    to: sidewalk_east
---

# Building 03 Door

## enter:forward
From inside, the narrow glass door feels more deliberate than welcoming.

## billboard:forward
The east-side door stands right there with the sidewalk beyond it, close enough to leave through without quite being outside yet.

## enter:backward
The narrow doorway pulls the whole frontage inward, as if the shop expects visitors one at a time.

## billboard:backward
From the sidewalk the door looks plain enough until you get close and notice how carefully everything around it has been kept.