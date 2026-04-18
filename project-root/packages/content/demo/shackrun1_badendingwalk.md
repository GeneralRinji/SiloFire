---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: shackrun1_badendingwalk
displayName: Bad Ending Threshold
tagline: A single wrong step with no gentler wording for it.

directionality: forward_only

presentation:
  forward: billboard

region: old_harbor

navigationLabels:
  exits: Exits

exits:
  - id: bad_ending_walk
    targetId: bad_ending_walk
    displayName: [delay: 6000] *Get Away*
    key: A

endpoints:
  forward:
    from: shack_run1
    to: bad_ending_walk
---

# Bad Ending Threshold

## enter
[delay: long]
He stands blocking the front before you can decide whether to run.
The knife never left his hand.

---

## first_visit
You enter the *Tackle Shack.*