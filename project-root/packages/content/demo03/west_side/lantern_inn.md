---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: lantern_inn
displayName: Brass Lantern Inn
tagline: A clean common room that trades on steadiness more than charm.

region: lantern_quarter

pois:
  - id: hearth
    displayName: Hearth

exits:
  - id: inn_to_square
    targetId: lantern_inn_door
    displayName: East
    key: E
---

# Brass Lantern Inn

## enter
The common room is small, warm, and arranged so that every table can pretend to be private.

## poi:hearth
The fire is carefully maintained rather than generous.