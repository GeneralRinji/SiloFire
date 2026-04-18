---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: market_lane
displayName: Market Lane
tagline: Stalls, awnings, and the kind of street that remembers prices better than faces.

region: lantern_quarter

pois:
  - id: awnings
    displayName: Awnings

exits:
  - id: market_to_square
    targetId: town_square
    displayName: West
    key: W
  - id: market_to_archive
    targetId: archive_steps
    displayName: North
    key: N
  - id: market_to_shrine
    targetId: shrine_yard
    displayName: South
    key: S
  - id: market_to_fishrow
    targetId: fish_row
    displayName: East
    key: E
---

# Market Lane

## enter
Even with half the shutters down, the lane still feels like it expects bargaining to resume at any moment.

## poi:awnings
The fabric has been sun-bleached into a palette no merchant would admit to choosing.