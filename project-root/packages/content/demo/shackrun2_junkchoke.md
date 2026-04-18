---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: shackrun2_junkchoke
displayName: Junk-Choked Threshold
tagline: The lane narrows into a mess of scrap and abandoned carts.

presentation:
  forward: passthrough
  backward: billboard

region: old_harbor

endpoints:
  forward:
    from: shack_run2
    to: junk_choke
  backward:
    from: junk_choke
    to: shack_run2
---

# Junk-Choked Threshold

## billboard:backward
The threshold back toward Shack Run is all tilted carts, burst crates, and bent scrap catching at your ankles.

---

## enter:backward
You have to step high over the broken spill and pick your footing carefully before the lane opens back out.