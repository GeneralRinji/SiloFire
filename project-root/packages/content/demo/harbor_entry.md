---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: harbor_entry
name: harbor_entry
displayName: Harbor Entry
tagline: The town starts pressing in around the water here.

region: old_harbor

passthrough: false

signals:
  traffic: medium
  mood: watchful

tags:
  - harbor
  - town
  - entry

exits:
  - id: harboredgeroad_harborentry
    targetId: harboredgeroad_harborentry
    displayName: Back to Harbor Edge Road
    key: R
---

# Harbor Entry

## enter
Rope, gulls, and voices carry farther here than they do out by the shacks.

---

## first_visit
This is where the harbor stops feeling abandoned and starts feeling like it remembers people.