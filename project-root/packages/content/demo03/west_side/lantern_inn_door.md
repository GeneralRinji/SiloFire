---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: lantern_inn_door
displayName: Brass Lantern Inn Door
tagline: A bright threshold with just enough warmth to compete with the street.

presentation:
  forward: billboard
  backward: billboard

region: lantern_quarter

endpoints:
  forward:
    from: town_square
    to: lantern_inn
  backward:
    from: lantern_inn
    to: town_square
---

# Brass Lantern Inn Door

## enter:forward
The inn door yields with the practiced give of a place that stays in business by welcoming hesitation.

## enter:backward
The square opens back out around you.

## billboard:forward
Warm windowlight makes the inn feel slightly better than the rest of the quarter, whether that is true or not.

## billboard:backward
The street waits just outside, cooler and less forgiving.