# Content Contract v0

Superseded note:
Use ContentContractV1.md as the current baseline for implementation-facing runtime behavior.
This v0 file is kept as earlier design context.

This document defines the first stable internal model for content.

It does not lock the authoring syntax yet.

It also does not mean authors should write content in JSON.

The goal is to stabilize runtime concepts while leaving the markdown-like source format free to evolve during prototyping.

The shapes shown in this document are normalized parser output and runtime-facing structures, not the required handwritten source format.

## Purpose

The system is prose-first.

It should optimize for player feel, pacing, and route memory rather than a cold node-and-action structure.

Because of that, the runtime contract should model:

- what kind of node this is
- when prose can appear
- how prose is selected
- when no prose is intentional
- when traversal is sequential instead of ambient
- when a node should not visibly interrupt movement

## Authoring Format

The intended workflow is:

1. write human-friendly markdown-like content
2. let the parser read that source format
3. normalize it into the internal structures described in this document

That means the examples in this note are implementation targets for the parser and runtime, not a requirement that you author content as JSON or TypeScript-shaped objects.

For this project, the source format should stay easy to scan and edit by hand.

Likely source ingredients:

- front matter or similar lightweight metadata
- headings and subheadings
- prose blocks
- repeated sections where useful
- explicit markers only where behavior is not otherwise clear

The parser is responsible for turning that source into normalized node data, prose slots, and path flows.

## Node Kinds

### Area

An Area is a place the player can inhabit.

Areas are mainly ambient and slot-based.

Typical behaviors:

- enter prose
- first-visit prose
- repeat-visit prose
- variant revisit prose
- POIs
- choices
- exits

### Path

A Path is traversal, not inhabitation.

Paths are mainly flow-based and directional.

Typical behaviors:

- first-visit traversal beats
- repeat traversal beats
- directional differences
- internal blockage
- continue, skip, and back controls

### Gate

A Gate is a threshold.

Gates decide whether movement is allowed, denied, delayed, or lightly mediated.

Typical behaviors:

- denial or allowance prose
- directional handling
- threshold choices
- short transition glue

## Two Presentation Systems

There are two separate content delivery systems.

### 1. Prose Slots

Used for ambient or event prose.

Examples:

- enter
- first visit
- repeat visit
- last visit
- choice reaction
- exit glue
- POI reaction

### 2. Flows

Used for ordered traversal or dialogue-like delivery where sequence matters.

Examples:

- path traversal
- blocked path traversal
- short sequential threshold interactions
- later dialogue systems if useful

## Prose Slot Model

Each prose slot normalizes to the following shape.

```ts
type ProseTrigger =
  | 'enter'
  | 'first_visit'
  | 'repeat_visit'
  | 'last_visit'
  | 'choice_result'
  | 'exit_glue'
  | 'poi_inspect';

type ProseSelectionMode =
  | 'constant'
  | 'random'
  | 'weighted'
  | 'cycle'
  | 'silent';

type ProseVariant =
  | { kind: 'text'; text: string; weight?: number }
  | { kind: 'none'; weight?: number };

type ProseSlot = {
  id: string;
  trigger: ProseTrigger;
  key?: string;
  mode: ProseSelectionMode;
  variants: ProseVariant[];
};
```

### Notes

- `key` is an optional qualifier such as a choice id, exit id, or POI id.
- `mode: silent` means the slot always resolves to no text.
- `kind: none` means silence is one possible outcome among multiple variants.

## Silence Rules

Silence must be explicit in the model.

These are different states:

1. Missing slot: no authored slot exists.
2. Silent slot: the author explicitly wants no output every time.
3. None variant: the author explicitly wants silence to be one possible outcome.

That distinction matters because these are not equivalent:

- intentional nothing
- intentional not-nothing
- no authored content

## Path Flow Model

Paths use flow data instead of relying only on prose slots.

```ts
type PathDirection = 'forward' | 'backward';

type PathFlowTrigger = 'first_visit' | 'repeat' | 'block';

type FlowBeat = {
  kind: 'beat';
  text: string;
};

type PathFlow = {
  id: string;
  trigger: PathFlowTrigger;
  direction: PathDirection;
  beats: FlowBeat[];
};
```

### Notes

- A flow is ordered.
- Beat order must be preserved.
- Block flows are separate from open traversal flows.
- Path flow selection depends on direction and visit context.

## Traversal Presentation Modes

Traversal presentation is separate from prose selection.

```ts
type TraversalPresentationMode =
  | 'normal'
  | 'passthrough'
  | 'walkpassthrough'
  | 'runpassthrough'
  | 'billboard';
```

### Meaning

- `normal`: the node may surface normally.
- `passthrough`: route through without surfacing the node.
- `walkpassthrough`: route through seamlessly when movement posture is walk-compatible.
- `runpassthrough`: route through seamlessly when movement posture is run-compatible.
- `billboard`: the node is visible and can present a small surface, but is not treated as a full location.

`passthrough` is not the same thing as silence.

A node can be silent without being passthrough, and a passthrough node may effectively never present content at all.

## Placeholder and Billboard

These do not need to become separate schema families yet.

### Placeholder

A placeholder exists in graph topology but does not visibly interrupt movement.

This can be represented with normal node data plus an appropriate traversal presentation mode.

### Billboard

A billboard is visible but shallow.

It can show short reaction text or a minimal surface without requiring full interior content.

## Parser Guidance

The parser should normalize permissive source content into stable runtime objects.

The parser is the boundary between author-friendly source text and strict runtime data.

For v0, that means:

- preserve repeated authored sections in order
- normalize repeated prose sections into slot variants
- preserve explicit none semantics
- preserve ordered path beats
- keep traversal presentation separate from prose logic

The parser should not assume that duplicate headings are the final long-term authoring syntax.

They are only one acceptable source form during prototyping.

The parser should also not require authors to handwrite the normalized structures shown in this document.

## Normalized Examples

These are normalized internal examples.

They are not the intended handwritten authoring format.

### Example: author writes this, parser produces a slot

Author-facing source might look more like this:

```md
## repeat_visit
More limbs and dead bark litter the path since last time.

## repeat_visit
Any day now, this tree will be done.

## repeat_visit
[none]
```

The parser can normalize that into a structured runtime slot.

### Example: random repeat prose with an intentional none option

```ts
const repeatVisitSlot: ProseSlot = {
  id: 'sunbleached_tree.repeat_visit',
  trigger: 'repeat_visit',
  mode: 'random',
  variants: [
    { kind: 'none' },
    { kind: 'text', text: 'More limbs and dead bark litter the path since last time.' },
    { kind: 'text', text: 'Any day now, this tree will be done.' },
  ],
};
```

### Example: always-silent enter slot

```ts
const enterSlot: ProseSlot = {
  id: 'placeholder_node.enter',
  trigger: 'enter',
  mode: 'silent',
  variants: [],
};
```

### Example: first-visit forward path flow

```ts
const firstVisitForwardFlow: PathFlow = {
  id: 'old_harbor_edge_road.first_visit.forward',
  trigger: 'first_visit',
  direction: 'forward',
  beats: [
    { kind: 'beat', text: 'The maintained road gives way without announcement.' },
    { kind: 'beat', text: 'The stone narrows under weeds and broken edging.' },
    { kind: 'beat', text: 'The sea sits closer here.' },
  ],
};
```

## Out of Scope for v0

These should not block initial implementation:

- deep state logic
- inventory systems
- NPC systems beyond light attachment to nodes
- formal quest systems
- dialogue trees beyond simple beat-based experiments
- strict authoring syntax finalization

## Implementation Target

The first implementation target should stabilize only these pieces:

1. normalized node kind handling for area, path, and gate
2. normalized prose slot objects
3. normalized path flow objects
4. traversal presentation modes including passthrough variants
5. explicit support for intentional none output

That is enough to prototype feel, routing, and content pacing without locking the project into a brittle authoring format.