---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: riverbank
displayName: Riverbank
tagline: The quiet north edge of town, where the map feels complete enough to stop.

region: lantern_quarter

pois:
  - id: mooring_posts
    displayName: Mooring Posts

exits:
  - id: river_to_bridge
    targetId: north_bridge
    displayName: South
    key: S
  - id: river_leave_town
    targetId: game_over_good
    displayName: Leave Town
    key: L
---

# Riverbank

## enter
The riverbank gives the quarter a proper edge. Past this, the town would need to become something larger.

## poi:mooring_posts
The posts look ready for boats that have not visited in some time.