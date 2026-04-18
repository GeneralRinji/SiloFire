# Architecture Docs

This folder contains both older v0 design notes and the maintained v1 reference set.

If you are trying to understand or extend the current project, start with the v1 files.

## Read This First

Recommended reading order for the current implementation and authoring model:

1. `ContentSchemasV1.md`
2. `SourceFormatV1.md`
3. `ContentContractV1.md`
4. `NavigationAndTraversalV1.md`
5. `ProjectionViewModelV1.md`
6. `RuntimeCompositionV1.md`
7. `AppSessionStateV1.md`
8. `ContentAuthoringGuideV1.md`
9. `ParserRulesV1.md`
10. `BrowserAuthoringPrompt.md`

For forward-looking ideas that are intentionally not hard contract yet, see `PlannedNext.md`.

For hosting-specific planning around `silofire.net`, see `DenoDeployPlan.md`.

The v1 files should be treated as the firm working reference for the current system.

They are not final forever, but they are intended to describe the behavior authors and implementers should rely on today.

For external content-authoring AI handoff, start with `ContentSchemasV1.md` first, then move to `SourceFormatV1.md` and `ContentAuthoringGuideV1.md`.

After that, use `packages/presets` for reusable patterns and stripped examples, then use `packages/content/demo` for richer authored examples.

## What Each V1 File Covers

### `ContentContractV1.md`

Current normalized content model.

Use this when you want to understand:

- core node families
- prose triggers
- flow structure
- shortcut key behavior
- alias tolerance

### `NavigationAndTraversalV1.md`

Current movement and traversal rules.

Use this when you want to understand:

- route state
- start-node rules
- path direction and one-way paths
- one-way gates and threshold resolution
- passthrough gate resolution
- history and keyboard navigation behavior

### `ProjectionViewModelV1.md`

Current renderer-facing page model.

Use this when you want to understand:

- projected page shape
- auto-advance behavior
- actions and controls, including route-dependent Path control sets
- recent log behavior
- how shortcut keys surface in projection

### `RuntimeCompositionV1.md`

Current browser/runtime assembly.

Use this when you want to understand:

- Vite content discovery
- the browser wrapper vs runtime core split
- where navigation resolution lives
- app-shell responsibilities above pure projection

### `AppSessionStateV1.md`

Browser-only run/session layer.

Use this when you want to understand:

- what state is allowed to live above runtime projection
- save and continue restoration boundaries
- project-scoped recent log and attempt bookkeeping
- where route replacement helpers should live

### `SourceFormatV1.md`

Current markdown authoring format.

Use this when you want to understand:

- front matter expectations
- area/path/gate body section shapes
- how one-way Paths are authored
- how one-way Gates are authored
- repeated headings and explicit variant controls
- supported marker syntax such as `delay` and `fade`

### `ContentAuthoringGuideV1.md`

Practical authoring rules and project conventions.

Use this when you want to understand:

- when to use Area, Gate, or Path
- naming and graph-shape conventions
- title screen and ending node conventions
- recommended navigation density and ordering
- what to reuse from existing demo content
- what external AI helpers should and should not assume

### `ParserRulesV1.md`

Current parser normalization contract.

Use this when you want to understand:

- how repeated sections normalize
- keyed and attempted slot handling
- explicit mode and weight normalization
- marker preservation rules

### `ContentSchemasV1.md`

Current human-readable schema reference.

Use this when you want to understand:

- shared node fields
- Area, Path, and Gate shapes
- prose slots versus path flows
- schema-level responsibilities before rendering

This should be the first handoff doc for an external content AI that needs to understand what shapes are currently legal.

### `BrowserAuthoringPrompt.md`

Copy-paste prompt for browser ChatGPT collaboration.

Use this when you want:

- a ready-to-paste external AI prompt
- a short summary of current supported features
- guardrails against unsupported content suggestions

### `PlannedNext.md`

Forward-looking feature and system notes.

Use this when you want:

- a rough view of likely future systems
- tentative refactor direction
- a place to park ideas that are not yet stable enough to be treated as architecture contract

### `DenoDeployPlan.md`

Hosting and deployment planning for Deno Deploy.

Use this when you want:

- the current feasibility answer for hosting on Deno Deploy
- the migration shape from Vite dev middleware to a real server boundary
- a reminder of what blocks production deployment today

## About The V0 Files

The v0 files are still kept in this folder as earlier design context.

They are useful for understanding how the project thinking evolved.

They should not be treated as the primary reference for current behavior where a v1 file exists.

## Current Coverage

The folder now has v1 baseline docs for:

- content contract
- navigation and traversal
- projection view model
- runtime composition
- source format
- parser rules
- content schemas

The v0 files remain as earlier design context.

They are useful for historical reasoning, but they should not be treated as the primary source for current behavior.