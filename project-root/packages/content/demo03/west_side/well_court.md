---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: well_court
displayName: Well Court
tagline: A little west-side court where the stone remembers buckets, gossip, and bad weather.

region: lantern_quarter

pois:
  - id: old_well
    displayName: Old Well

exits:
  - id: well_to_south
    targetId: south_street
    displayName: East
    key: E
  - id: well_to_alley
    targetId: watch_alley
    displayName: North
    key: N
---

# Well Court

## enter
The court holds sound differently from the streets around it, as if every conversation meant to stay a little longer.

## poi:old_well
The rope marks are deeper than the current bucket would ever need.