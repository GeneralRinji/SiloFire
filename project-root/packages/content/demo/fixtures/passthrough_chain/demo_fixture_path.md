---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: demo_fixture_path
name: demo_fixture_path
displayName: Nested Fixture Path
tagline: A simple traversal node loaded from a nested subfolder.

region: old_harbor

passthrough: false

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open
  backward: open

endpoints:
  forward:
    from: demo_fixture_entry_gate
    to: demo_fixture_exit_gate
  backward:
    from: demo_fixture_exit_gate
    to: demo_fixture_entry_gate
---

# Nested Fixture Path

## flow:first_visit:forward

### beat
The nested walkway proves the runtime can discover content below the project root.

### beat
Past the planks, the fixture chain still resolves like any other authored route.

---

## flow:first_visit:backward

### beat
Going back through the same nested fixture flips the path direction cleanly.

### beat
The entry waits where the subfolder left it.

---

## flow:repeat:forward

### beat
You head deeper into the nested fixture.

---

## flow:repeat:backward

### beat
You retrace the nested fixture path.