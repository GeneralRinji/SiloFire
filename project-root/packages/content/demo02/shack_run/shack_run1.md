---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: shack_run1
name: shack_run1
displayName: Shack Run
tagline: That's what the locals still call it any way

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

navigationLabels:
  pois: Points Of Interest
  choices: Choices
  exits: Exits

exits:
  - id: fish_shop_front
    targetId: fish_shop_front
    displayName: Fishmonger Shop
    key: F
  - id: shackrun1_oldharboredgeroad
    targetId: shackrun1_oldharboredgeroad
    displayName: Back to Old Harbor Edge Road
    key: H
  - id: shackrun1_shackrun2
    targetId: shack_run2
    displayName: Continue Along Shack Run
    key: T
  - id: shackrun1_badendingwalk
    targetId: shackrun1_badendingwalk
    displayName: Enter Tackle Shack (Bad Ending Route)
    key: B
  - id: shackrun1_goodendingwalk
    targetId: shackrun1_goodendingwalk
    displayName: Good Ending Route
    key: G

---

# Shack Run

## first_visit
A small cluster of boat shacks that no longer trawl this end of the bay still remain. The road widens for nothing near the only one that is still upkept amid the trash.

---

## enter
The old man is sitting on his porch at whittling something with a knife.