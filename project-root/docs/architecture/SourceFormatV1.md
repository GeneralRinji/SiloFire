# Source Format v1

This document is the working authoring guide for the current markdown-like source format.

Use it when writing or reviewing content files.

## Purpose

The source format should stay:

- readable in plain text
- easy to hand-author
- structured enough for deterministic normalization
- light on special syntax

The system supports authored prose and traversal, not embedded scripting.

## File Shape

Each content file has two parts:

1. YAML front matter for machine-facing configuration
2. markdown-like body sections for authored prose and flow content

Within a content project, files may live at the project root or in nested subfolders.

The file location is organizational only.

The runtime identity of a node comes from front matter `id`, not from the file path.

The current object families are:

- Area
- Path
- Gate

Each file represents one content object.

## Front Matter

Front matter carries node identity and structural configuration.

Important identity rule:

- keep `id` unique within a whole project, even when files are split across subfolders
- keep `targetId` and `endpoints` references pointed at node ids
- do not treat folder names as part of the authored reference syntax

Common fields include:

- `version`
- `templateSchema`
- `templateSchemaVersion`
- `id`
- optional `name`
- `displayName`
- optional `tagline`
- `region`
- optional `tags`
- optional `signals`

Schema-specific fields may also appear, for example:

- `pois`
- `choices`
- `exits`
- `navigationLabels`
- `controlLabels`
- `directionality`
- `traversal`
- `blocking`
- `endpoints`
- `passthrough`
- `presentationMode`

Keep front matter structural.

Long prose belongs in body sections, not in front matter.

## Body Structure

The body uses markdown-like headings and paragraphs.

Allowed ingredients:

- section headings such as `## enter`
- simple subheadings such as `### beat`
- plain prose paragraphs
- repeated sections for variants
- inline emphasis such as `*italic*` and `**bold**`
- lightweight markers such as `[none]`, `[delay: medium]`, and `[fade: out 5000]`

Out of scope for the current format:

- embedded scripting
- layout-oriented markup systems
- large custom inline grammars

## Area Authoring

Areas are prose-slot oriented.

Common body sections include:

- `enter`
- `blocked`
- `first_visit`
- `repeat_visit`
- `last_visit`
- `poi:<id>`
- `choice:<id>`
- `exit_glue:<id>`
- `exit_glue_random:<id>`

Compatibility input still accepted:

- `visit_random`

Preferred lifecycle authoring for new content:

- use `enter` for stable arrival prose
- use `blocked` when the Area itself should surface an authored obstruction state via `blocking.state: blocked`
- use `first_visit` for first arrival only
- use `repeat_visit` for later arrivals
- use `last_visit` only when some explicit state decides that this is the final meaningful arrival

Optional navigation section labels may also be authored in front matter when the UI heading should read differently from the default buckets.

Example:

```yaml
navigationLabels:
	pois: Things To Check
	exits: Ways Out
	choices: What You Do
```

Any omitted label continues to use the default renderer heading.

Navigation labels may also begin with a delay marker when a whole bucket should reveal after visible prose finishes rendering.

Example:

```yaml
navigationLabels:
	exits: [delay: medium] Ways Out
```

Optional visible control text may also be authored in front matter.

Example:

```yaml
controlLabels:
	back: Step Away From The Door
```

Any omitted control label continues to use the runtime default.

Action, exit, and control labels may also begin with a delay marker in front matter.

Example:

```yaml
exits:
	- id: bad_ending_walk
	  targetId: bad_ending_walk
	  displayName: [delay: short] *Get Away*
	  key: A
```

Supported delay values currently match prose timing markers:

- `short` or `fast`
- `medium`
- `long` or `slow`
- a positive millisecond number such as `1400`

For UI labels, delay markers are renderer-side presentation hints. They are stripped from the rendered text and interpreted relative to the end of visible prose for the current page.

## Path Authoring

Paths are flow oriented.

Common body sections include:

- `flow:first_visit:forward`
- `flow:first_visit:backward`
- `flow:repeat:forward`
- `flow:repeat:backward`
- `flow:block:forward`
- `flow:block:backward`

One-way note:

- a one-way Path does not need opposite-direction flow sections
- author only the directions that the Path is meant to support
- pair that with `directionality: forward_only` or `directionality: backward_only` in front matter

Within a flow section, ordered beats are authored with subheadings such as:

- `beat`

Beat order is significant and preserved.

Current traversal pacing comes from front matter:

```yaml
traversal:
	firstVisitMode: paged
	repeatVisitMode: compressed
```

Author with these traversal rules in mind:

- `paged` paths expose one authored beat at a time
- multi-beat paged bidirectional paths surface `continue`, `skip`, and `back`
- one-beat paged bidirectional paths surface `continue` and `back`
- one-way paged paths surface the same pacing controls without `back`
- `compressed` paths surface the selected flow without beat-by-beat stepping

Blocked-flow note:

- `flow:block:<direction>` is the authored place for obstruction prose such as fallen trees, collapsed roads, or other traversal blockers
- blocked flows use the same beat model as any other Path flow, so markers like `delay` and `fade` still work
- multi-beat blocked flows currently page through one beat at a time before leaving the player on the final blocked description

## Gate Authoring

Gates are threshold oriented.

Common body sections include:

- `enter`
- `enter:<direction>`
- `billboard`
- `billboard:<direction>`
- `blocked:<direction>`
- `poi:<id>`
- `choice:<id>`
- optional keyed threshold prose such as `exit_glue:<id>` if needed later

Many gates remain light, especially when front matter already describes passthrough behavior.

Preferred gate front matter for new content uses directional presentation:

```yaml
presentation:
	forward: passthrough
	backward: billboard
```

Current supported gate presentation values are:

- `passthrough`
- `walkpassthrough`
- `runpassthrough`
- `billboard`

One-way note:

- a Gate may author `directionality: forward_only` or `directionality: backward_only`
- use this when the threshold itself should only admit travel from one side, regardless of whether it is a door, portal, magical barrier, or some other authored fiction
- if a one-way Gate relies on side-sensitive entry, author `endpoints` so the runtime can infer approach direction coherently

Blocked-gate note:

- a Gate may also author `blocking.forward` and `blocking.backward` using the same `open` and `blocked` states used by Paths
- Gate blocking is for physical or authored obstruction, not for one-way routing
- `directionality` answers whether travel is allowed from a side at all; `blocking` answers whether an otherwise valid side is currently obstructed
- `blocked:<direction>` is the authored prose family for a blocked approach to a Gate
- when a passthrough Gate is blocked on the approached side, the runtime stops on the Gate page instead of auto-advancing through it

Directional-visibility note:

- a Gate may be passthrough on one face and visible on the other
- use `enter:<direction>` and `billboard:<direction>` when the front and back descriptions differ
- when a visible Gate face has an endpoint but no authored exits, the runtime synthesizes `continue` so the player can step through that face without additional boilerplate

Naming note:

- gate ids should follow the adjacent-node join style already used in the demo content
- prefer `<areaNodeName>_<pathName>` for an Area-to-Path threshold such as `shackrun1_goodendingwalk`
- prefer `<pathName>_<areaNodeName>` for a Path-to-Area threshold such as `goodendingwalk_gameovergood`
- treat this like a many-to-many join-table naming rule in an ERD: the gate id should tell you which two nodes it joins
- if an area cluster is likely to expand, prefer numeric suffixes from the start, such as `shack_run1` and `shack_run2`, so related threshold ids do not need wholesale renames later

Visible gates may also author front matter such as:

- `navigationLabels`
- `controlLabels`
- `pois`
- `choices`
- `exits`

## Repeated Sections And Variants

Repeated headings are valid source input.

Repeated-heading behavior:

- repeated identical headings preserve source order
- repeated headings in the same slot family become variants
- repeated headings without an explicit mode default to `random`

Explicit heading controls:

- `@constant`
- `@random`
- `@cycle`
- `@weighted`
- `@weight=<n>`

Heading forms:

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

Examples:

```md
## repeat_visit @random
The sign rattles in the wind.

## repeat_visit @random
Something shifts under the pier and then goes still.

## enter @cycle
arrival one

## enter @cycle
arrival two

## poi:wildraspberrybush:2 @weighted @weight=3
Bare stems and bad luck.

## poi:wildraspberrybush:2 @weighted @weight=1
Somebody got here first and took everything worth taking.
```

## Explicit Silence

`[none]` is an intentional authored no-output variant.

It is valid inside prose slots and should not be treated as missing content.

## Inline Markers

Current marker families are:

- `delay`
- `fade`

Examples:

- `[delay: short]`
- `[delay: medium]`
- `[delay: long]`
- `[delay: 1200]`
- `[fade: in]`
- `[fade: out]`
- `[fade: short]`
- `[fade: medium]`
- `[fade: slow]`
- `[fade: long]`
- `[fade: in 3000]`
- `[fade: out 5000]`

Current fade timing buckets:

- `short` or `fast`: 900ms
- `medium`: 1800ms
- `slow`: 3200ms
- `long`: 5200ms

Numeric fade values are interpreted as milliseconds.

Combined authoring is valid.

For example, a prose block may carry both a leading fade-in and a trailing fade-out marker.

```md
## enter @cycle
[fade: in 3000]
No voices this time, but you slow anyway.
[fade: out 5000]
```

The current renderer supports:

- fade-in only
- fade-out only
- fade-in followed by fade-out on the same block

## Marker Placement

Markers may appear:

- before a prose line or paragraph
- after a prose line or paragraph
- in staged runs between prose lines

Current parser behavior preserves consecutive marker runs so authored staging survives into projection.

## Authoring Guidance

Practical guidance:

- keep area arrival prose concise
- use repeated sections instead of inventing new syntax for simple variation
- use weighted variants for rare lines
- use cycle when authored order matters
- prefer explicit numeric fade durations when pacing needs to be exact

## Non-Goals

The source format still does not try to be:

- a scripting language
- a general markdown publishing format
- a layout system
- a simulation rule engine