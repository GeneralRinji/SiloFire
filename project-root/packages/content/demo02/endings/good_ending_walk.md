---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: good_ending_walk
name: good_ending_walk
displayName: The Last Walk
tagline: The long route home, or the nearest thing to it.

region: old_harbor

passthrough: false

directionality: forward_only

traversal:
  firstVisitMode: paged
  repeatVisitMode: paged

blocking:
  forward: open

endpoints:
  forward:
    from: shackrun1_goodendingwalk
    to: goodendingwalk_gameovergood
---

# The Last Walk

## flow:first_visit:forward

### beat
You keep walking until the shacks stop pretending to be part of town.

### beat
The boards underfoot sound steadier the farther you get from everything you meant to say.

### beat
By the time the water opens up ahead of you, the harbor has finally run out of ways to hold you in place.

### beat
[delay: medium]
No curtain call. Just the water, the road behind you, and the feeling that somebody finally let the ending land where it should.

---

## flow:repeat:forward

### beat
You know the way now, and that makes it easier to keep moving.

### beat
The water is waiting at the end of it.
