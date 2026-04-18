---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: old_harbor_edge_road
displayName: Old Harbor Edge Road
tagline: The maintained road gives way without announcement.

region: old_harbor

passthrough: false

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: paged

blocking:
  forward: open
  backward: blocked

endpoints:
  forward:
    from: sunbleachedtree_oldharboredgeroad
    to: shackrun1_oldharboredgeroad
  backward:
    from: shackrun1_oldharboredgeroad
    to: sunbleachedtree_oldharboredgeroad
---

# Old Harbor Edge Road

## flow:first_visit:forward

### beat
[delay: medium]
*Hahahaha!*

---

## flow:first_visit:backward

### beat
backward first visit beat 1

---

## flow:repeat:backward

### beat
backward repeat visit beat 1

---

## flow:repeat:forward

### beat
forward repeat visit beat 1

---

