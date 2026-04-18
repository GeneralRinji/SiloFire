---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: demo_fixture_destination
name: demo_fixture_destination
displayName: Nested Fixture Destination
tagline: The far side of the nested passthrough example.

region: old_harbor

exits:
  - id: demo_fixture_exit_gate
    targetId: demo_fixture_exit_gate
    displayName: Head Back Through the Fixture
    key: B
---

# Nested Fixture Destination

## enter
The far side of the nested fixture proves the chain closes on a second area.