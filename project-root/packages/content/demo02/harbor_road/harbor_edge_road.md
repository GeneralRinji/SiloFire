---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: harbor_edge_road
name: harbor_edge_road
displayName: Harbor Edge Road
tagline: The regular road into town, or it would be if the storm had left it alone.

region: old_harbor

passthrough: false

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: blocked
  backward: open

endpoints:
  forward:
    from: shackrun2_harboredgeroad
    to: harboredgeroad_harborentry
  backward:
    from: harboredgeroad_harborentry
    to: shackrun2_harboredgeroad
---

# Harbor Edge Road

## flow:block:forward

### beat
A storm-felled pine is sprawled across the road into town.

### beat
Its trunk has crushed the low wall beside it and dragged half the bank loose.
[delay: medium]

### beat
Even if you climbed it, the splintered crown would give way under you.
[fade: out long]

---

## flow:first_visit:forward

### beat
The road broadens here, less secret and more used than the old harbor cut.

### beat
You can already hear the harbor proper in the distance.

---

## flow:repeat:forward

### beat
The road into town lies open ahead.

---

## flow:first_visit:backward

### beat
You follow the harbor road back out toward Shack Run.

---

## flow:repeat:backward

### beat
You head back toward the shacks.