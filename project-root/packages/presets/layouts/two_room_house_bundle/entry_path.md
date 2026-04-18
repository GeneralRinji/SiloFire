---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: entry_path
displayName: Entry Passage
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
    from: front_door_gate
    to: front_room_area
  backward:
    from: front_room_area
    to: front_door_gate
---

# Entry Passage

## flow:first_visit:forward

### beat
The narrow entry passage leads into the front room.

---

## flow:first_visit:backward

### beat
You retrace the short passage toward the yard.

---

## flow:repeat:forward

### beat
You move through the short entry passage.

---

## flow:repeat:backward

### beat
You move back through the short entry passage.