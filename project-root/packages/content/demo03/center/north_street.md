---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: north_street
displayName: North Street
tagline: The paving rises toward the river and the air clears a little.

region: lantern_quarter

exits:
  - id: north_to_square
    targetId: town_square
    displayName: South
    key: S
  - id: north_to_bridge
    targetId: north_bridge
    displayName: North
    key: N
  - id: north_to_archive
    targetId: archive_steps
    displayName: East
    key: E
  - id: north_to_alley
    targetId: watch_alley
    displayName: West
    key: W
---

# North Street

## enter
The quarter feels more orderly here, as if even the walls are trying to stand up straighter.