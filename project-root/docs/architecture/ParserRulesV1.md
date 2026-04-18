# Parser Rules v1

This document replaces the older v0 parser note as the best description of the current parser contract.

It describes how handwritten source files normalize into the internal content model used by the interpreter and runtime.

## Purpose

The parser should preserve authored intent while turning loose markdown-like input into stable structured objects.

The parser is responsible for structure.

It is not responsible for runtime state, visit tracking, or renderer behavior.

## Input Model

The parser reads:

1. YAML front matter
2. markdown-like body sections

The parser must treat body structure as meaningful input, not as arbitrary markdown to flatten too early.

## Core Rules

### Preserve Source Order

When the author repeats sections or beat blocks, preserve authored order.

Do not sort, collapse, or deduplicate repeated input.

### Preserve Explicit Silence

If the author writes `[none]`, normalize it as an explicit no-output variant.

Do not drop it as blank content.

### Keep Runtime Decisions Out Of Parse

The parser should not decide:

- which variant is selected
- how visit state advances
- how cycle progression is counted
- how fade timing renders
- whether a node should visibly rerender

Those belong to later layers.

## Front Matter Normalization

Front matter is the authoritative source for machine-facing configuration.

The parser should:

- read typed fields into the relevant object family
- preserve recognized structural fields
- reject malformed required fields for that object family
- keep body prose out of front matter concerns

Invalid files may be skipped by the runtime layer, but parser normalization itself should remain strict about required structural fields.

## Section Normalization

### Simple Sections

Sections such as `enter`, `repeat_visit`, or `billboard` normalize into prose slot candidates.

### Keyed Sections

Keyed headings such as `poi:wildraspberrybush` or `choice:walk` normalize into:

- a trigger
- an optional key
- an optional attempt
- one or more variants

Current trigger mapping includes:

- `poi:<id>` -> `poi_inspect`
- `choice:<id>` -> `choice_result`
- `exit_glue:<id>` -> `exit_glue`
- `exit_glue_random:<id>` -> `exit_glue_random`

### Flow Sections

Path flow sections normalize independently from prose slots.

Examples:

- `flow:first_visit:forward`
- `flow:repeat:backward`
- `flow:block:forward`

Each flow must preserve:

- trigger
- direction
- ordered beats

## Repeated Headings And Modes

Repeated headings remain valid input and preserve source order.

Current heading controls that the parser preserves:

- optional key
- optional attempt suffix
- explicit mode tokens
- explicit weight tokens

Current explicit modes:

- `constant`
- `random`
- `cycle`
- `weighted`

Current normalization rules:

- repeated identical headings with no explicit mode default to `random`
- explicit mode overrides any mode inferred from repetition
- explicit `@weight=<n>` values are preserved per variant
- explicit weights without an explicit mode normalize the slot to `weighted`
- repeated `@cycle` headings preserve source order for later cycle selection

## Area Lifecycle Guidance

The parser still accepts legacy compatibility input such as `visit_random`.

Preferred normalized authoring direction is:

- `enter`
- `first_visit`
- `repeat_visit`
- optional `last_visit`

The parser should preserve compatibility input, but newer docs and content should prefer the clearer lifecycle buckets.

## `[none]` Handling

`[none]` normalizes to an explicit none variant.

This is distinct from:

- missing slot content
- parse failure
- accidental empty text

That distinction matters because later layers need to tell the difference between a silent authored outcome and absent authored content.

## Marker Preservation

Current lightweight markers are:

- `delay`
- `fade`

The parser should preserve marker intent in normalized output.

Current expectations:

- markers may lead a prose block
- markers may trail a prose block
- consecutive marker runs between prose lines should be preserved without losing staging intent

This matters for authored sequences such as:

```md
line one
[fade: out long]
[delay: long]
line two
```

The parser should attach markers so later layers can distinguish trailing markers for one block from leading markers for the next block when authored order makes that distinction meaningful.

## Inline Formatting

Simple markdown emphasis is preserved as authored prose content.

Current expected forms include:

- `*italic*`
- `_italic_`
- `**bold**`

The parser should not strip or rewrite those forms during normalization.

## Minimum v1 Success Criteria

The parser is correct for the current runtime if it can:

1. parse Area, Path, and Gate files from front matter plus body sections
2. preserve repeated headings and their source order
3. preserve keyed and attempted slot distinctions
4. normalize explicit modes and weights
5. normalize `[none]` explicitly
6. preserve path beat order
7. preserve delay and fade marker intent
8. preserve staged marker runs between prose lines without collapsing them away