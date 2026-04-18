---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: town_square
displayName: Town Square
tagline: The center of the quarter, where every direction feels like a deliberate choice.

region: lantern_quarter

pois:
  - id: fountain
    displayName: Fountain

exits:
  - id: square_north
    targetId: north_street
    displayName: North
    key: N
  - id: square_south
    targetId: south_street
    displayName: South
    key: S
  - id: square_east
    targetId: market_lane
    displayName: East
    key: E
  - id: square_west
    targetId: lantern_inn_door
    displayName: West
    key: W
---

# Town Square

## enter
The square is just large enough to feel civic and just small enough to remember every doorway around it.

## poi:fountain
The basin has been patched enough times that the stonework looks like a timeline.