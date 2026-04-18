---
presetId: paged_street_segment
presetType: object
nodeKind: path
category: scenic-traversal
summary: Multi-beat Path preset for a deliberately written traversal segment where the movement prose is part of the experience.
tags:
  - path
  - scenic
  - paged
  - beats
searchTerms:
  - cinematic path
  - narrated traversal
  - scenic road
  - beat-driven path
useCases:
  - boulevard
  - corridor
  - bridge approach
  - harbor road
relatedFixtures:
  - invisible_area_gate_path_gate_area
complexity: medium
---

# Paged Street Segment

## When To Use

Use this when the movement itself should feel authored and paced instead of instantaneous.

## Authoring Rules

- Make each beat do one job.
- Keep the beats cumulative rather than repetitive.
- Reserve this preset for routes where pacing matters.

## Minimal Stripped Example

```md
---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: street_segment
displayName: Street Segment
region: old_harbor

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open
  backward: open

endpoints:
  forward:
    from: west_gate
    to: east_gate
  backward:
    from: east_gate
    to: west_gate
---

# Street Segment

## flow:first_visit:forward

### beat
The street narrows.

### beat
Sound carries farther than it should.

### beat
The next threshold comes into view.

---

## flow:first_visit:backward

### beat
The street opens again by degrees.

### beat
The busier side of the route feels closer with each step.

---

## flow:repeat:forward

### beat
You take the street at a practiced pace.

---

## flow:repeat:backward

### beat
You follow the street back.
```