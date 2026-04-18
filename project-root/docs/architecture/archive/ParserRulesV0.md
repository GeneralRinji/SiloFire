# Parser Rules v0

Status note:
Use ParserRulesV1.md as the current baseline for parser behavior.
This v0 file is kept as earlier design context.

This document defines how handwritten source content normalizes into runtime-facing structures.

It is the contract between author-friendly files and the internal model described in the content contract.

## Parser Responsibility

The parser must:

- accept simple handwritten markdown-like files
- preserve author intent
- normalize loose source conventions into stable internal objects
- avoid forcing authors to handwrite normalized structures directly

## Input Expectations

The parser reads:

1. front matter for metadata/config
2. markdown-like body sections for prose and flows

The parser should treat the body as content structure, not as arbitrary markdown to flatten into plain text too early.

## General Rules

### Preserve Source Order

When repeated sections appear, preserve their original order.

Do not sort or deduplicate them.

### Preserve Explicitness

If the author explicitly wrote a marker such as `[none]`, the parser must preserve that intent in normalized form.

Do not drop it as empty content.

### Keep Structure Separate From Rendering

The parser should normalize content structure.

It should not decide final UI behavior.

That belongs later in interpretation and projection.

## Front Matter Normalization

The parser should read front matter into typed object configuration.

For v0:

- treat front matter as the authoritative source for machine-facing config
- keep body prose out of front matter
- preserve fields even if some are not yet used by the runtime, as long as they fit the schema family

## Section Normalization

### Simple Sections

A simple section such as `enter` or `repeat_visit` normalizes into a prose slot candidate.

If a section appears once, it may normalize into a single-variant slot.

If the same section appears multiple times, the parser must preserve all occurrences.

### Keyed Sections

A keyed section such as `poi:wildraspberrybush` or `choice:walk` normalizes into:

- a trigger name
- a key value
- one or more variants

Examples:

- `poi:wildraspberrybush` -> trigger `poi_inspect`, key `wildraspberrybush`
- `choice:walk` -> trigger `choice_result`, key `walk`
- `exit_glue:run` -> trigger `exit_glue`, key `run`

The exact normalized trigger names may be mapped internally, but the parser must preserve the trigger/key distinction.

### Repeated Sections

Repeated sections are valid.

For v0, repeated sections should usually normalize into multiple variants under the same slot family rather than overwriting each other.

The parser should not silently decide that later sections replace earlier ones.

### Draft Explicit Variant Controls

The parser should eventually support explicit variant controls in the section heading.

This is not fully implemented yet, but the intended direction is:

- preserve attempt suffixes such as `poi:wildraspberrybush:2`
- preserve explicit mode tokens such as `@random`, `@cycle`, or `@weighted`
- preserve lightweight option tokens such as `@weight=3`

Planned examples:

- `poi:wildraspberrybush:2 @random`
- `repeat_visit @cycle`
- `choice:walk:3 @constant`
- `repeat_visit @weighted @weight=3`

Planned normalization rules:

- `trigger`, `key`, and optional `attempt` should remain distinct fields
- explicit heading mode should override mode inferred from repetition
- repeated identical headings should still preserve source order
- repeated headings with `@weighted` should preserve per-variant weights
- `[none]` should remain a normal variant outcome and not a parse error
- repeated headings with explicit weights but no explicit mode should normalize to `weighted`

Current runtime behavior:

- repeated headings without an explicit mode normalize to `random`
- weighted headings normalize to `weighted` and preserve `weight` per variant
- cycle headings normalize to `cycle` and advance in source order before looping

Preferred area lifecycle direction:

- author revisit variation inside `repeat_visit`
- treat `visit_random` as legacy compatibility input rather than the preferred authoring bucket
- reserve `last_visit` for explicit state-driven final-arrival selection rather than inferred visit count

## Flow Normalization

Path flow sections normalize separately from prose slots.

Examples:

- `flow:first_visit:forward`
- `flow:repeat:backward`
- `flow:block:forward`

The parser must extract:

- flow trigger
- direction
- ordered beats

### Beat Blocks

Within a flow section, each `beat` block becomes one beat entry.

Beat order must be preserved exactly.

Do not flatten multiple beats into one prose blob.

## `[none]` Normalization

`[none]` means intentional no-output.

It does not mean:

- missing content
- parse failure
- accidental blank text

The parser should normalize `[none]` into an explicit none variant.

This distinction is required so the runtime can tell the difference between:

- no authored slot
- always-silent slot
- randomly maybe-silent slot

## Delay And Fade Marker Handling

Timing and presentation markers such as `[delay:medium]` or `[fade:slow]` are valid source markers.

For v0, the parser should preserve them intentionally rather than stripping them.

The exact normalized representation can stay simple for now, for example:

- inline token preserved in parsed content
- a lightweight annotation object
- a beat-level marker attached during parse

The main rule is that delay or fade intent should survive parsing.

## Inline Formatting Expectations

Inline markdown-style emphasis should be preserved as prose content and left for later rendering.

Current practical expectation:

- `*italic*`
- `_italic_`
- `**bold**`

The parser should not strip or rewrite those forms during normalization.

They are part of authored prose, not control syntax.

## Markdown In Prose

Simple markdown emphasis inside prose is allowed.

For v0, the parser should preserve prose content faithfully.

Do not attempt to introduce a large custom prose syntax system.

## Ambiguity Rules

When a source form is ambiguous, the parser should prefer preserving structure over prematurely collapsing it.

Examples:

- preserve repeated headings as repeated source sections
- preserve unknown-but-readable content rather than dropping it silently
- prefer explicit normalized objects over lossy plain-text flattening

## What The Parser Should Not Decide Yet

The parser should not be responsible for:

- weighted selection behavior
- cycle progression state
- anti-repeat behavior across sessions
- whether a slot should be shown on a particular visit
- whether no prose should auto-advance in the UI

Those belong in later runtime layers.

## Minimum Success Criteria

The parser is good enough for v0 if it can reliably do the following:

1. parse Area, Path, and Gate files with front matter and body sections
2. preserve repeated sections
3. normalize keyed sections
4. normalize `[none]` explicitly
5. preserve path beat order
6. hand off enough structure for interpreter and projection work to begin