---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: dilapidated_shop_open
displayName: Empty Shack Door
tagline: The doorway gapes just enough to let the dark breathe out.

presentation:
  forward: billboard
  backward: billboard

region: old_harbor

choices:
  - id: listen
    displayName: Listen at the Threshold
    key: L

endpoints:
  forward:
    from: shack_run2
    to: empty_shack
  backward:
    from: empty_shack
    to: shack_run2
---

# Empty Shack Door

## enter:forward
The door drifts inward with a long wooden scrape.
The room beyond is empty enough to feel staged.

---

## enter:backward
The open doorway still catches a little of the harbor light.

---

## choice:listen
Only the wind and the boards shifting against each other.