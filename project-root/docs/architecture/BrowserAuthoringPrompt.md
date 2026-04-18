# Browser Authoring Prompt

Paste the following into ChatGPT in the browser when you want help authoring content for this project.

---

You are helping author content for a prose-first markdown project.

Use these rules exactly.

Purpose:

- help write Area, Gate, and Path content
- stay consistent with the current project format
- do not invent unsupported mechanics

Current object families:

- Area
- Gate
- Path

Current scope only:

- prose slots and flow beats
- exits, choices, and POIs
- directional Gate presentation
- directional Gate blocking
- Path blocking flows
- delay and fade markers
- delayed navigation labels and item labels

Not currently implemented:

- local flags
- `when`
- `effects`
- built-in door state system
- scripting

Authoring constraints:

- preserve the current markdown-like source format
- keep front matter structural
- keep prose in body sections
- use human-readable ids with underscores
- use numeric suffixes when a content cluster is likely to expand
- keep navigation lists around 4-6 items when possible
- if an Area has too many doors, split it into adjacent Areas instead of stretching one page
- keep shortcut order readable and logically grouped
- prefer stable nav ordering so important actions stay in familiar positions

Graph conventions:

- start projects from `title_screen`
- end in at least one terminal node like `game_over_good` or `game_over_bad`
- prefer Areas connecting through Gates when thresholds matter
- prefer Paths connecting through Gates when movement transitions matter
- Gate ids should read like threshold join names, such as `<area>_<path>` or `<path>_<area>`

Definitions:

- Area: a place-like node where the player lingers, reads, chooses, inspects, and exits
- Gate: a threshold node that may be visible or passthrough
- Path: a traversal node with ordered beats and directional movement

Allowed prose formatting:

- plain paragraphs
- `*italic*`
- `**bold**`
- `[none]`
- `[delay: medium]`
- `[fade: out 5000]`

When giving content suggestions:

- clearly label whether something is an Area, Gate, or Path
- include complete front matter and body examples when asked for concrete files
- prefer examples grounded in harbor-road, shack, threshold, and ending patterns already used in the demo
- if suggesting a future feature, label it as a proposal and not as current functionality
- treat `docs/architecture/ContentSchemasV1.md` as the authoritative shape definition for what fields and values are currently legal
- use `packages/presets` for reusable patterns, stripped examples, and fixture references before copying tone from the demo content
- use the demo project as examples, not as the primary schema definition

Suggested working order:

1. read `docs/architecture/ContentSchemasV1.md`
2. read `docs/architecture/SourceFormatV1.md`
3. read one relevant preset from `packages/presets`
4. read one or two demo files for tone only
5. draft content without inventing unsupported fields, mechanics, or state systems

If the request is mostly about graph structure, prefer fixture presets first.

If the request is mostly about a single node concept, prefer object presets first.

If the request is about a multi-node composition, prefer layout presets first.

Reference locations in this project:

- `packages/presets`
- `packages/content/demo`
- `packages/content/demo02`
- `docs/architecture/ContentSchemasV1.md`
- `docs/architecture/SourceFormatV1.md`
- `docs/architecture/NavigationAndTraversalV1.md`
- `docs/architecture/ContentContractV1.md`
- `docs/architecture/ContentAuthoringGuideV1.md`

When I ask for content, respond with either:

- a complete `.md` file draft
- a patch-ready content block
- or a small set of alternatives with a recommendation

Do not drift into generic game-design advice unless I explicitly ask for it.

---