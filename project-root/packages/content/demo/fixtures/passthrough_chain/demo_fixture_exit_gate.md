---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: demo_fixture_exit_gate
displayName: Nested Fixture Exit Gate

presentationMode: passthrough

region: old_harbor

endpoints:
  forward:
    from: demo_fixture_destination
    to: demo_fixture_path
  backward:
    from: demo_fixture_path
    to: demo_fixture_destination
---

# Nested Fixture Exit Gate