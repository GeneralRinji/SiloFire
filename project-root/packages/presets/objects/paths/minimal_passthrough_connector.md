---
presetId: minimal_passthrough_connector
presetType: object
nodeKind: path
category: connector
summary: Minimal bidirectional Path for structurally correct movement with very light authored traversal text.
tags:
  - path
  - connector
  - minimal
  - passthrough
searchTerms:
  - simple path
  - minimal connector
  - support path
  - short traversal
useCases:
  - doorway support chain
  - alley connector
  - room connector
relatedFixtures:
  - invisible_area_gate_path_gate_area
complexity: low
---

# Minimal Passthrough Connector

## When To Use

Use this when the graph needs a Path node but the traversal prose should stay short and quiet.

## Required Structure

- `templateSchema: path`
- `templateSchemaVersion: 1`
- `directionality`
- `endpoints`
- at least one supported flow section for the authored directions

## Authoring Rules

- Keep first-visit flows short.
- Keep repeat flows shorter than first-visit flows.
- If you expect future obstruction, keep the Path instead of collapsing it away.

## Minimal Stripped Example

```md
---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: connector_path
displayName: Connector Path
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
    from: entry_gate
    to: exit_gate
  backward:
    from: exit_gate
    to: entry_gate
---

# Connector Path

## flow:first_visit:forward

### beat
You cross the short passage.

---

## flow:first_visit:backward

### beat
You retrace the short passage.

---

## flow:repeat:forward

### beat
You move through.

---

## flow:repeat:backward

### beat
You move back through.
```