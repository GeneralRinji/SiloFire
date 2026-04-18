---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: shack_run2
name: shack_run2
displayName: Shack Run
tagline: The lane bends past the last occupied shacks before the harbor road opens up.

region: old_harbor

passthrough: false

signals:
  decay: medium
  traffic: low
  mood: quiet

tags:
  - harbor
  - seulile_sight
  - brent_route

exits:
  - id: shackrun2_shackrun1
    targetId: shack_run1
    displayName: Back Toward the First Shacks
    key: B
  - id: shackrun2_junkchoke
    targetId: shackrun2_junkchoke
    displayName: Toward the Junk-Choked Cut
    key: J
  - id: shackrun2_harboredgeroad
    targetId: shackrun2_harboredgeroad
    displayName: Toward Harbor Proper
    key: T
  - id: dilapidated_shop
    targetId: dilapidated_shop
    displayName: Empty Shack
    key: D
  - id: shackrun2_nestedfixture
    targetId: demo_fixture_entry
    displayName: Slip Behind the Weathered Sheds
    key: N

---

# Shack Run

## first_visit
The shacks thin out here. The road narrows between leaning walls, then opens just enough to show where the more traveled harbor road ought to be.

---

## enter
Loose siding ticks in the wind. Somewhere ahead, something heavy creaks without deciding whether to fall.