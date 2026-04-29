---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: outside_area
displayName: Outside Prototype Hub
tagline: A narrow frontage where the neon wants your attention more than the door does.

region: prototypehub

pois:
  - id: window_glow
    displayName: Neon Window
    key: W

exits:
  - id: approach_lobby_door
    targetId: outside_lobbygate
    displayName: Approach The Door
    key: D
---

# Outside Prototype Hub

## enter
The frontage looks half storefront and half dare. A thin neon sign in the window blinks, buzzes, and briefly steadies before deciding to shiver again.

## first_visit
The voices on the other side of the glass are too smeared to make out, but not so faint that you can pretend the place is empty.

## repeat_visit
The neon keeps stuttering against the window while the chatter inside rises and falls in blurred little waves.