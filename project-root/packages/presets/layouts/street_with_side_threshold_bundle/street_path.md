---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: street_path
displayName: Street Path
region: starter_region

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open
  backward: open

endpoints:
  forward:
    from: west_area
    to: east_area
  backward:
    from: east_area
    to: west_area
---

# Street Path

## flow:first_visit:forward

### beat
The route opens ahead.

### beat
A side threshold sits off the main way.

---

## flow:first_visit:backward

### beat
You follow the route back west.

---

## flow:repeat:forward

### beat
You keep east along the route.

---

## flow:repeat:backward

### beat
You head back west.