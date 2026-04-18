---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: fish_row
displayName: Fish Row
tagline: A short eastward run of stalls and counters that keeps the sea present even inland.

region: lantern_quarter

exits:
  - id: fish_to_market
    targetId: market_lane
    displayName: West
    key: W
  - id: fish_give_up
    targetId: game_over_bad
    displayName: Give Up On The Quarter
    key: G
---

# Fish Row

## enter
The smell arrives before the details do, which is probably the point.