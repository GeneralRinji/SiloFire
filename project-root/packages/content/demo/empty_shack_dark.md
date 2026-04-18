---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: empty_shack_dark
displayName: Empty Shack
tagline: With the door shut, the room loses its corners.

region: old_harbor

navigationLabels:
  choices: [delay: medium] What You Do
  exits: [delay: long] Exits

choices:
  - id: fumble_around
    displayName: [delay: medium] Fumble Around
    key: F

exits:
  - id: emptyshack_reopen_door
    targetId: empty_shack
    displayName: [delay: long] Reopen the Door
    key: A
---

# Empty Shack

## enter
The door thumps shut.

[delay: long]
The shack goes black enough that the walls seem farther away than they are.

---

## choice:fumble_around
Your hands find damp boards, a knocked-over tin cup, and the broken cot frame before they find anything useful.