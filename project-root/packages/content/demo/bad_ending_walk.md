---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: bad_ending_walk
name: bad_ending_walk
displayName: The Short Walk
tagline: The shortest route is usually the one you regret fastest.

region: old_harbor

passthrough: false

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open
  backward: open

endpoints:
  forward:
    from: shackrun1_badendingwalk
    to: badendingwalk_gameoverbad
  backward:
    from: badendingwalk_gameoverbad
    to: badendingwalk_gameoverbad
---

# The Short Walk

## flow:first_visit:forward

### beat
You run toward the back before your better judgment can form the words and rattle the knob.

### beat
You tumble outside and he follows.
Backing toward the water, you try to pretend this was not where you meant to go.

### beat
This was a bad idea, but you kept going anyway.

---

## flow:repeat:backward

### beat
You run toward the shack but *he's there.*