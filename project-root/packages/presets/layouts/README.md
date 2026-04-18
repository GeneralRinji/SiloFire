---
presetId: layout_catalog
presetType: layout
category: catalog
summary: Index of reusable multi-node layout presets and their concrete bundle folders.
tags:
  - layouts
  - catalog
  - presets
searchTerms:
  - layout presets
  - bundle presets
  - graph presets
useCases:
  - ai retrieval
  - graph planning
complexity: low
---

# Layout Presets

Use layout presets when the question is about a small graph shape, not a single node.

## Available Layouts

### shopfront

Exterior Area -> business Gate -> compact interior Area.

Bundle: `shopfront_bundle/`

### street_with_side_threshold

Street progression with a side threshold branching from an Area, not a Path.

Bundle: `street_with_side_threshold_bundle/`

### two_room_house

Yard and threshold leading into a front room and a rear room.

Bundle: `two_room_house_bundle/`

### civic_frontage

Blocked public civic entrance with a side service route into the building.

Bundle: `civic_frontage_bundle/`

## Selection Rule

If the AI needs to know how many files to create and how they connect, start here and then open the matching bundle folder.