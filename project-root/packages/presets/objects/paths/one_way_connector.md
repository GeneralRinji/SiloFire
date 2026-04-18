---
presetId: one_way_connector
presetType: object
nodeKind: path
category: one-way
summary: One-way Path preset for chutes, drops, forced movement, or routes that should only resolve from one side.
tags:
  - path
  - one-way
  - directional
searchTerms:
  - forward only path
  - one way route
  - no return path
  - forced traversal
useCases:
  - drop
  - slide
  - guarded one way hall
  - collapse route
relatedFixtures:
  - one_way_path_connector
complexity: low
---

# One-Way Connector

## When To Use

Use this when the route itself should only admit travel from one side.

## Required Structure

- `directionality: forward_only` or `directionality: backward_only`
- only author supported flow directions
- endpoints that line up with the supported approach direction

## Minimal Stripped Example

```md
---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: one_way_connector
displayName: One-Way Connector
region: old_harbor

directionality: forward_only

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open

endpoints:
  forward:
    from: upper_gate
    to: lower_gate
---

# One-Way Connector

## flow:first_visit:forward

### beat
The route only makes sense from this side.

---

## flow:repeat:forward

### beat
You keep moving the only way this path allows.
```

## Variation Ideas

- steep descent
- guarded turnstile
- collapsing ledge
- crowd-controlled passage