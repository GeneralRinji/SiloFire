---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: north_bridge
displayName: North Bridge
tagline: A short stone bridge that turns the river crossing into an actual transition.

region: lantern_quarter

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open
  backward: open

endpoints:
  forward:
    from: north_street
    to: riverbank
  backward:
    from: riverbank
    to: north_street
---

# North Bridge

## flow:first_visit:forward

### beat
The bridge lifts you just enough above the river to make the whole quarter feel briefly arranged.

### beat
Lantern light and market canvas pull apart behind you as the bank opens ahead.

## flow:first_visit:backward

### beat
From the bridge, the town compresses into a handful of streets and one believable center.

### beat
North Street waits where the paving firms up again.

## flow:repeat:forward

### beat
You cross the bridge toward the bank.

## flow:repeat:backward

### beat
You cross back toward town.