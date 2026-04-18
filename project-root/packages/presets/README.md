# Presets Library

This folder contains reusable authoring presets for external content AIs and human authors.

Use presets after reading the schema docs.

Read in this order:

1. `docs/architecture/ContentSchemasV1.md`
2. `docs/architecture/SourceFormatV1.md`
3. `packages/presets/README.md`
4. one or more preset docs from this folder
5. `packages/content/demo` for richer example tone and authored texture

Presets are not runtime inheritance.

They are authoring helpers.

They exist to show:

- common node shapes
- common graph-support patterns
- useful field combinations
- stripped examples without heavy prose styling
- variation ideas and use cases

## Folder Map

- `fixtures/`: graph-topology patterns and invisible support-node patterns
- `objects/areas/`: single-node Area presets
- `objects/gates/`: single-node Gate presets
- `objects/paths/`: single-node Path presets
- `layouts/`: multi-node compositions such as houses, corridors, boulevards, or compounds
- `templates/`: cloneable preset document skeletons

## Preset Metadata

Preset docs should use front matter with search-oriented metadata.

Recommended fields:

- `presetId`
- `presetType`: `fixture`, `object`, or `layout`
- `nodeKind`: `area`, `gate`, `path`, or omitted for mixed layouts
- `category`
- `summary`
- `tags`
- `searchTerms`
- `useCases`
- `relatedFixtures`
- `complexity`: `low`, `medium`, or `high`

These fields are for retrieval and orientation.

They do not change runtime behavior.

## Naming Rules

- Use lowercase snake_case file names.
- Name object presets by concept, not by exact story noun.
- Name fixture presets by graph pattern.
- Name layout presets by composition shape.

Examples:

- `billboard_business_door.md`
- `service_entrance.md`
- `locked_civic_door.md`
- `one_room_shack.md`
- `dead_end_nook.md`
- `street_corner.md`
- `minimal_passthrough_connector.md`
- `invisible_area_gate_path_gate_area.md`
- `two_room_house.md`
- `shopfront.md`

## Authoring Rules

- Keep presets structurally correct against the v1 schema docs.
- Keep examples stripped and readable before making them stylish.
- Include required fields explicitly.
- Keep optional fields only when they teach something useful.
- Include variation ideas in prose sections rather than bloating the example object.
- Link object presets back to fixture patterns when they usually depend on hidden support nodes.

## Recommended AI Workflow

When an external AI is asked to author content:

1. read `ContentSchemasV1.md` to learn legal shapes
2. read `SourceFormatV1.md` to learn source syntax
3. read one relevant preset from this folder
4. read one or two demo examples for tone only
5. draft content without inventing unsupported fields or systems