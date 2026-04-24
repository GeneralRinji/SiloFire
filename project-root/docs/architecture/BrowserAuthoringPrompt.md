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

- sidecar event authoring in files such as `events.yaml`
- project predicates and seeded state sidecars
- project time and weather settings sidecars
- prose slots and flow beats
- exits, choices, and POIs
- directional Gate presentation
- directional Gate blocking
- Path blocking flows
- delay and fade markers
- delayed navigation labels and item labels
- visible text and recent text as separate presentation lanes

Not currently implemented:

- local flags
- built-in door state system
- scripting

Current authoring boundary:

- use normal `.md` files for Area, Gate, and Path structure plus prose
- use sidecars for stateful behavior such as `when`, `effects`, `set`, `arm_schedule`, predicate definitions, and time schedules
- do not invent a separate scripting format when existing sidecars already cover the behavior

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
- use `docs/architecture/PredicateReferenceV1.md` when authoring or repairing predicate logic instead of inventing new operators
- use `docs/architecture/ScheduleReferenceV1.md` when authoring or repairing `settings/time.yaml` schedules instead of inventing timer syntax
- use `packages/presets` for reusable patterns, stripped examples, and fixture references before copying tone from the demo content
- use the demo project as examples, not as the primary schema definition
- keep authored node entry prose and authored action results in the visible text lane by default
- treat weather and non-dramatic ambient status updates as recent-text behavior owned by the runtime, not as ad hoc authored clutter
- author roaming NPC walkers in NPC sidecar YAML and use `arrivalText`, `presenceText`, `transitText`, and `departureText` there instead of inventing walker prose in node markdown
- if an NPC sidecar defines local helper predicates, use `self.<field>` for that NPC's own fields and `self.<predicate_name>` for that same sidecar's local predicate references
- keep NPC-local predicates small and local to NPC-authored behavior; move shared gameplay rules into project predicate sidecars instead of copying them into each NPC file
- when something appears or disappears on a time window, use the sidecar pattern `state/world.yaml` -> `settings/time.yaml` schedule `effects` -> predicate sidecar -> gated `events.yaml` content
- for scheduled objects such as the demo04 morning paper, seed `objects.<id>.available` in state, turn it on and off with time schedules, then gate enter text, POIs, and choices from predicates instead of repeating raw time checks everywhere
- when an interaction temporarily consumes something and it later comes back, use the sidecar pattern `events.yaml` action effect -> stored refill state -> `settings/time.yaml` refill schedule -> predicate-gated POI and choice content
- for refill loops such as the demo04 wrapped mint, record the minimal state needed for refill timing, then let schedules restore availability instead of inventing ad hoc cooldown mechanics
- do not invent a `lane:` field inside normal Area, Gate, or Path markdown
- authored `lane` is valid in sidecars where the current docs and examples already use it

Suggested working order:

1. read `docs/architecture/ContentSchemasV1.md`
2. read `docs/architecture/SourceFormatV1.md`
3. read one relevant preset from `packages/presets`
4. read one or two demo files for tone only
5. if the request needs stateful behavior, inspect a matching sidecar example before drafting
6. for schedule-driven availability, inspect the demo04 morning paper example before drafting a new pattern
7. for predicate-heavy logic, read `docs/architecture/PredicateReferenceV1.md` before drafting
8. for time schedules, read `docs/architecture/ScheduleReferenceV1.md` before drafting
9. draft content without inventing unsupported fields, mechanics, or state systems

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
- `docs/architecture/PredicateReferenceV1.md`
- `docs/architecture/ScheduleReferenceV1.md`
- `docs/architecture/SessionBehaviorRulesV1.md`

When I ask for content, respond with either:

- a complete `.md` file draft
- a patch-ready content block
- or a small set of alternatives with a recommendation

Do not drift into generic game-design advice unless I explicitly ask for it.

---