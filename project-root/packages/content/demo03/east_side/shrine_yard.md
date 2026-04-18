---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: shrine_yard
displayName: Shrine Yard
tagline: A little open space where the market noise gives way to quieter habits.

region: lantern_quarter

pois:
  - id: votive_rack
    displayName: Votive Rack

exits:
  - id: shrine_to_market
    targetId: market_lane
    displayName: North
    key: N
  - id: shrine_to_south
    targetId: south_street
    displayName: West
    key: W
---

# Shrine Yard

## enter
The yard is not silent, but the noise that reaches it seems to know it should lower its voice.

## poi:votive_rack
Most of the offerings are practical: twine, wax, salt, and folded scraps of handwriting.