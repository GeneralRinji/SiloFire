---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: dilapidated_shop
displayName: Empty Shack Door
tagline: The frame leans, but the door still hangs on one hinge.

presentation:
  forward: billboard
  backward: billboard

region: old_harbor

navigationLabels:
  choices: What You Do
  exits: [delay: medium] Exits

choices:
  - id: test_latch
    displayName: Try the Latch
    key: T

exits:
  - id: open_door
    targetId: dilapidated_shop_open
    displayName: [delay: medium] Open the Door
    key: A

endpoints:
  forward:
    from: shack_run2
    to: empty_shack
  backward:
    from: empty_shack
    to: shack_run2

---

# Empty Shack Door

## first_visit
The shack looks too small to matter and too stubborn to finish collapsing.

---

## enter:forward
The door is shut, swollen with damp, but not locked.

---

## enter:backward
From inside, the door looks thin enough to kick through if panic got hold of you.

---

## choice:test_latch
The latch gives with a tired metal click.
Nothing inside answers it.

