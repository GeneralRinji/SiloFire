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

directionality: forward_only

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open

endpoints:
  forward:
    from: shackrun1_badendingwalk
    to: badendingwalk_gameoverbad
---

# The Short Walk

## flow:first_visit:forward

### beat
You bolt through the tackle shack before your better judgment can form the words.
Shelves catch your shoulders, hooks scrape the wall, and something topples behind you.

### beat
You hit the back door hard enough to burst it open and tumble into the yard beyond.
Cold harbor air slaps you awake for exactly half a second.

### beat
He comes through after you without hurrying.
Backing toward the water, you finally understand this was the whole shape of the mistake.

### beat
This was a bad idea, but you kept going anyway.

---

## flow:repeat:forward

### beat
The back door is already off its hinges in your head. You run for it anyway.