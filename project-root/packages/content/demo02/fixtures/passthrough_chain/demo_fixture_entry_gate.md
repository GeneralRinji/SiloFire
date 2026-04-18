---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: demo_fixture_entry_gate
displayName: Nested Fixture Entry Gate

presentationMode: passthrough

region: old_harbor

endpoints:
  forward:
    from: demo_fixture_entry
    to: demo_fixture_path
  backward:
    from: demo_fixture_path
    to: demo_fixture_entry
---

# Nested Fixture Entry Gate