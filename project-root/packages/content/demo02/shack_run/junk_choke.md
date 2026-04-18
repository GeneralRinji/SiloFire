---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: junk_choke
name: junk_choke
displayName: Junk-Choked Cut
tagline: The passage ends in piled refuse and no patience for intruders.

region: old_harbor

passthrough: false

blocking:
  state: blocked

signals:
  traffic: low
  mood: blocked

tags:
  - harbor
  - blocked
  - junk

exits:
  - id: shackrun2_junkchoke
    targetId: shackrun2_junkchoke
    displayName: Back to Shack Run
    key: R
---

# Junk-Choked Cut

## blocked
Broken crates, bent wire, and a slumped handcart have turned the lane into a waist-high barricade.

---

## first_visit
There is room to look at the mess and immediately understand that no one is getting through without spending an hour moving junk in plain sight.

---

## repeat_visit
The blockage has not improved. If anything, it looks more unstable than before.