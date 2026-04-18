# Source Format v0

Status note:
Use SourceFormatV1.md as the current baseline for authored source behavior.
This v0 file is kept as earlier design context.

This document describes the current handwritten source format for content files.

It is intentionally simple.

It is a prototype authoring format, not a final spec.

## Goals

- keep content readable by humans
- keep editing friction low
- let the parser normalize loose source conventions into stable runtime structures
- avoid requiring authors to write JSON-shaped content

## General Shape

A content file has two parts:

1. metadata/config front matter
2. markdown-like body content

The author writes one file per content object.

For v0, the expected object families are:

- Area
- Path
- Gate

## Front Matter

Front matter carries machine-facing metadata and configuration.

Typical fields include:

- `version`
- `templateSchema`
- `templateSchemaVersion`
- `id`
- `name` when a shorter human-readable identifier is useful
- `displayName`
- `tagline`
- `region`
- tags, signals, exits, choices, endpoints, or other schema-specific config

Front matter is expected to stay simple and explicit.

For v0, use front matter for structural configuration, not for long prose.

## Body Format

The body uses markdown-like sections.

The body should remain easy to scan in plain text.

Allowed author-facing ingredients for v0:

- markdown headings
- short subheadings where needed
- plain prose paragraphs
- repeated sections when variants are desired
- simple inline markdown emphasis inside prose
- simple inline markers such as `[none]`, `[delay:medium]`, or `[fade: out medium]`

Out of scope for v0:

- complex embedded scripting
- custom rich layout systems
- advanced inline syntax beyond a few explicit markers

## Area Shape

Areas are ambient and section-based.

Expected front matter usually includes:

- node identity fields
- region
- tags and signals
- POIs
- choices
- exits
- traversal presentation settings when needed

Expected body sections may include:

- `enter`
- `first_visit`
- `repeat_visit`
- `last_visit` when an explicit terminal-arrival condition exists
- `poi:<id>`
- `choice:<id>`
- `exit_glue:<id>`
- `exit_glue_random:<id>`

Preferred area lifecycle authoring:

- `enter` is stable arrival prose that may always appear
- `first_visit` is first-arrival-only prose
- `repeat_visit` is the revisit bucket
- repeated or weighted `repeat_visit` sections should carry revisit variation
- `visit_random` is legacy shorthand and should be folded into `repeat_visit` variants in new content
- `last_visit` is optional and should only be used when some explicit narrative condition makes this the final meaningful arrival

Repeated section names are allowed in source.

When repeated sections are used, they should be grouped together for readability.

## Path Shape

Paths are traversal-oriented and sequence-based.

Expected front matter usually includes:

- node identity fields
- region
- directionality
- traversal settings
- blocking settings
- endpoints
- traversal presentation settings when needed

Expected body sections may include:

- `flow:first_visit:forward`
- `flow:first_visit:backward`
- `flow:repeat:forward`
- `flow:repeat:backward`
- `flow:block:forward`
- `flow:block:backward`

Within a flow section, ordered beats are written with subheadings such as:

- `beat`

## Gate Shape

Gates are threshold-oriented.

Expected front matter usually includes:

- node identity fields
- region
- presentation settings
- tags
- optional threshold-related config

Expected body sections may include short threshold prose such as:

- `enter`
- `billboard`
- direction-aware gate sections if needed later
- choice or threshold result sections if needed later

Gate source should stay lighter than Area source unless the gate is intentionally being used as a richer threshold encounter.

## Repeated Sections

Repeated sections are valid source input.

For v0, repetition is the main low-friction way to author multiple prose variants.

Examples:

- multiple `choice:walk` sections
- multiple `repeat_visit` sections

The parser is responsible for preserving repetition and normalizing it.

## Draft Variant Syntax

Status note:
This section is a draft authoring direction so future parser work has a stable target.

Most of this is implemented today.

Currently implemented:

- plain repeated sections imply multiple variants for the same slot
- numbered attempt suffixes such as `poi:wildraspberrybush:2`
- `[none]` as an explicit no-output variant
- explicit mode tokens such as `@constant`, `@random`, `@cycle`, and `@weighted`
- explicit weight tokens such as `@weight=3`

Draft heading grammar:

```md
## <trigger>
## <trigger>:<attempt>
## <trigger>:<key>
## <trigger>:<key>:<attempt>
## <trigger> @<mode>
## <trigger>:<attempt> @<mode>
## <trigger>:<key> @<mode>
## <trigger>:<key>:<attempt> @<mode>
```

Draft mode tokens:

- `@constant`
- `@random`
- `@cycle`
- `@weighted`

Draft examples:

```md
## repeat_visit @random
Wind rattles through the old sign.

## repeat_visit @random
Something shifts under the pier and then goes still.

## poi:wildraspberrybush:2 @random
Yup, still empty.

## poi:wildraspberrybush:2 @random
This thing is actually pretty bare. Probably done for the season.

## poi:wildraspberrybush:3
[none]
```

Draft interpretation:

- repeated identical headings stay valid and group into one slot family
- attempt suffixes select per-interaction prose such as first inspect, second inspect, third inspect
- explicit mode tokens should override any default inferred mode from repetition
- if no explicit mode token is present, repetition continues to imply `random` as a low-friction default
- if explicit weights are present without an explicit mode token, the slot is treated as `weighted`

Weighted form:

Put weight on the repeated section itself.

Form:

```md
## repeat_visit @weighted @weight=3
The same gull is still watching from the piling.

## repeat_visit @weighted @weight=1
Only broken shells and weed remain.
```

That shape is implemented for prose slots.

Cycle form:

Use repeated headings with `@cycle` when authored variants should advance in source order and then loop.

```md
## enter @cycle
prose1

## enter @cycle
prose2

## enter @cycle
prose3
```

That cycles as `prose1`, then `prose2`, then `prose3`, then back to `prose1`.

Example for a common line and a rare bonus line:

```md
## poi:adjacenttothetree:1 @weighted @weight=6
There's probably better places to stand though you know you're faster than any heavy branch.

## poi:adjacenttothetree:1 @weighted @weight=1
The thought lands mean and bright: if the branch comes down, you're still faster. Maybe demon fast.
```

## Inline Markers

The source format may use a few explicit inline markers.

Current expected markers:

- `[none]` for an intentional no-output variant
- `[delay:medium]` or similar simple delay markers
- `[fade: out medium]` or similar simple fade markers

These markers are part of the source format only because they are easy to read and write.

The parser decides how they normalize internally.

## Inline Formatting And Marker Cheatsheet

This is the practical author-facing shorthand currently worth remembering.

### Simple emphasis

Current prose rendering supports lightweight inline markdown-style emphasis:

- `*italic*`
- `_italic_`
- `**bold**`

Examples:

```md
You already know this is a bad idea.

*Sigh*...

The sign reads **KEEP OUT**.
```

These forms work in visible prose blocks and in recent-log prose that is rendered through the same rich-text path.

### Explicit no-output

Use `[none]` when a section should intentionally resolve to no visible text.

Example:

```md
## poi:wildraspberrybush:3
[none]
```

### Delay and fade markers

Use standalone marker lines either ahead of the prose block they apply to, or immediately after that same prose block.

Examples:

```md
## enter
You hear children's voices in the distance fading.
[delay: medium]
Now you don't.

## enter
[fade: slow]
The lantern comes awake a moment later.

## poi:wildraspberrybush:3
*Sigh*...
[fade: out medium]
```

Current supported marker families:

- `[delay: fast]`
- `[delay: medium]`
- `[delay: slow]`
- `[fade: in]`
- `[fade: out]`
- `[fade: short]` or `[fade: fast]`
- `[fade: medium]`
- `[fade: slow]`
- `[fade: long]`
- `[fade: in 7000]`
- `[fade: out 7000]`
- `[fade: in slow]`
- `[fade: out medium]`

Fade markers default to fade-in when no explicit direction is present.

Current fade speed buckets:

- `short` or `fast`: 900ms
- `medium`: 1800ms
- `slow`: 3200ms
- `long`: 5200ms

If you omit a speed token entirely, the renderer falls back to its base timing for the chosen direction.

Numeric fade values are also accepted and are treated as milliseconds.

Examples:

```md
[fade: slow]
The lantern comes awake a moment later.

*Sigh*...
[fade: out medium]

The streetlight takes its time to disappear.
[fade: out long]
```

Numeric delay values are also accepted by the current renderer.

Example:

```md
[delay: 1200]
The thought arrives late.
```

### Section heading patterns

Current implemented heading forms:

```md
## <trigger>
## <trigger>:<attempt>
## <trigger>:<key>
## <trigger>:<key>:<attempt>
```

Examples:

```md
## enter

## first_visit:2

## poi:wildraspberrybush

## poi:wildraspberrybush:2
```

Meaning:

- `trigger` chooses the prose family such as `enter`, `first_visit`, `poi`, or `choice`
- `key` identifies the specific POI, choice, or exit glue target when the trigger is keyed
- `attempt` identifies first/second/third interaction prose for that slot family

### Repetition behavior

Current implemented low-friction behavior:

- repeat the same heading to author multiple variants for the same slot
- repeated identical headings currently imply multiple variants under that same slot
- where the runtime supports it, repeated variants may be selected randomly

Example:

```md
## poi:wildraspberrybush:2
You check again anyway. Just leaves, thorns, and your own bad optimism.

## poi:wildraspberrybush:2
Stripped down to stems. Whoever got here first was thorough.
```

### Important current limits

What is worth relying on right now:

- italic and bold emphasis
- `[none]`
- delay and fade markers
- keyed headings like `poi:<id>` or `choice:<id>`
- numbered attempt headings like `poi:wildraspberrybush:2`

What should still be treated as draft rather than stable syntax:

- explicit mode tags such as `@random`, `@cycle`, or `@weighted`
- explicit weight tokens such as `@weight=3`
- any richer inline markdown than simple emphasis

## IDs And Human Readability

IDs should be machine-unique but still readable during authoring.

For v0, the working compromise is a readable name plus GUID pattern, for example:

- `sunbleached_tree_{guid}`
- `old_harbor_edge_road_{guid}`

This keeps the content workable by hand until better tooling exists.

## Non-Goals

This format is not trying to solve:

- a future CMS workflow
- advanced author tooling
- strict final syntax
- long-term persistence concerns

It only needs to be good enough to support rapid authoring and parser development.