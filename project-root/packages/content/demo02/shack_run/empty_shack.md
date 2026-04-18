---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: empty_shack
displayName: Empty Shack
tagline: Bare boards, old rope, and a draft through the open door.

region: old_harbor

choices:
  - id: inspect_cot
    displayName: Look Over the Broken Cot
    key: I

exits:
  - id: emptyshack_door
    targetId: dilapidated_shop_open
    displayName: Back to the Door
    key: B
  - id: emptyshack_close_door
    targetId: empty_shack_dark
    displayName: Close the Door
    key: C
---

# Empty Shack

## first_visit
A broken cot leans into one wall beside a crate split by age and damp. There is almost nothing here worth stealing.

---

## enter
With the door open, enough harbor light gets in to prove there is no one waiting here.

---

## choice:inspect_cot
The cot rope is long gone. Only the frame remains, silvered by salt and years.