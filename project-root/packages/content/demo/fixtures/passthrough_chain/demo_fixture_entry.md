---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: demo_fixture_entry
name: demo_fixture_entry
displayName: Nested Fixture Entry
tagline: A tucked-away authored node used to prove nested discovery.

region: old_harbor

exits:
  - id: demo_fixture_entry_gate
    targetId: demo_fixture_entry_gate
    displayName: Follow the Nested Fixture
    key: N
  - id: shackrun1_shackrun2
    targetId: shack_run2
    displayName: Continue Along Shack Run
    key: T
---

# Nested Fixture Entry

## enter
This area is authored from a demo subfolder to prove nested content discovery works.