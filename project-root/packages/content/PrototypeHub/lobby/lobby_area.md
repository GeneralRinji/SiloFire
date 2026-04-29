---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: lobby_area
displayName: Prototype Hub Lobby
tagline: A compact chrome-trimmed waiting room for interactions that have not fully arrived yet.

region: prototypehub

navigationLabels:
  pois: Things In The Room
  choices: What You Do

pois:
  - id: explain_prototypehub
    displayName: What Is This Prototype For?
    key: P

fixtures:
  - id: prototypehub_lobby_jukebox
    kind: jukebox
    displayName: Jukebox
    key: J
    stateId: prototypehub_lobby_jukebox
    catalogId: prototypehub_classic_yt
    maxQueueLength: 20

exits:
  - id: back_to_door
    targetId: outside_lobbygate
    displayName: Back To The Door
    key: B
---

# Prototype Hub Lobby

## enter
The little bell over the door gives a bright quick jingle behind you. The lobby is smaller than the window promised. Chrome trim catches the room light. The floor looks ready for more traffic than it gets.

## first_visit
The jukebox off to one side has the posture of a machine that knows the room was built around it, even if the interaction model only just caught up.

## repeat_visit
The room holds still in that deliberate way prototypes do, everything present for a reason and not quite enough of anything to hide it.