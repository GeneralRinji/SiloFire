---
presetId: path_object_catalog
presetType: object
nodeKind: path
category: catalog
summary: Index of stripped Path presets.
tags:
  - path
  - catalog
  - presets
searchTerms:
  - path presets
  - connector presets
  - traversal examples
useCases:
  - ai retrieval
  - movement authoring
complexity: low
---

# Path Presets

Use Path presets for traversal connectors that primarily exist to carry movement between other nodes.

## Available Presets

### minimal_passthrough_connector

Shortest legal connector when a Path is required but flavor is minimal.

### one_way_connector

Traversal shape that only resolves in one direction.

### paged_street_segment

Street-like connector with room for paged movement prose.

## Rule Of Thumb

Do not hang side branches directly from a Path. If movement needs to fork, split that choice across Areas or Gates instead.