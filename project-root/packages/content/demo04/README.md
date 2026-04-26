# demo04

This project is a diorama-style town block built from a simple Mermaid-like neighborhood sketch.

## Folder Intent

- `title/`: title screen and project entry
- `block/`: the four sidewalks that define the outer movement loop
- `building01/` through `building04/`: each building's ground floor and upstairs room
- `endings/`: the connected ending and return-to-title threshold
- `predicates/`: future project-level condition aliases for state-aware content
- `npcs/`: future NPC dossiers, routines, and local predicates
- `state/`: future shared world and node-local default state
- `idle/`: future idle behavior sketches and reusable ambient behavior fragments

## State Sketch Status

This project is the main reference example for the current sidecar-driven stateful content direction.

Alongside Area, Gate, and Path markdown, demo04 includes sidecars for:

- seeded world state
- project predicates
- ambient NPC behavior
- project time configuration and schedules
- project weather configuration
- node-local event behavior

These files should be treated as working reference material for the current runtime/session architecture.

The important boundary is:

- node markdown still owns structural navigation content and prose
- sidecars own mutable state, predicates, schedules, NPC behavior, and other stateful rules

Folder and file organization remain authoring conveniences only. Node identity and authored references still resolve by node id, not by path.

## Graph Shape

```text
[sidewalk_north] <=> [building01_groundfloor] <=> [building01_upstairs]
[sidewalk_north] <=> [building02_groundfloor] <=> [building02_upstairs]
[sidewalk_north] <=> [sidewalk_east]
[sidewalk_north] <=> [sidewalk_west]

[sidewalk_east] <=> [building03groundfloor_sidewalk_east] => [building03_groundfloor] <=> [building03_upstairs]
[sidewalk_east] <=> [sidewalk_south]

[sidewalk_west] <=> [sidewalk_south]

[sidewalk_south] <=> [building04_groundfloor] <=> [building04_upstairs]
[building04_upstairs] => [game_over_good]
```

## Important Rule

Folder names are organizational only.

Node identity still comes from front matter `id`, and authored references still point to node ids, not paths.