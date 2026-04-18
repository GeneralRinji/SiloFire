# Runtime Composition v1

This document is the working reference for how the browser app assembles the current runtime.

It does not replace the parser, projection, or navigation docs.

Use it when changing project discovery, runtime assembly, or app-shell responsibilities above pure projection.

## Why This Exists

The browser app needs Vite-specific content discovery.

The test environment does not.

Earlier attempts to hide `import.meta.glob` behind helper indirection caused discovery regressions in the browser bundle.

The current architecture uses a split runtime:

- a browser wrapper that performs direct Vite glob discovery
- a Node-safe core module that contains the actual runtime logic

That split is intentional.

## Current Files

### Browser Wrapper

`apps/web/src/contentRuntime.ts`

Responsibilities:

- call direct `import.meta.glob(...)` patterns that discover markdown files at the project root and in nested subfolders
- build runtime data from discovered markdown files
- export app-facing helpers such as:
  - `PROJECT_RUNTIME`
  - `resolveProjectAction`
  - `resolveProjectControl`
  - `getProjectedPage`
  - `appendRecentLog`

This file should stay small.

It exists mainly so Vite can see and transform the glob directly.

### Runtime Core

`apps/web/src/contentRuntimeCore.ts`

Responsibilities:

- group discovered files by project folder
- parse markdown files into normalized content objects
- skip invalid files without poisoning the rest of the project runtime
- build sidebar node lists and start-node selection
- provide internal node records and alias maps
- resolve actions and controls into movement outcomes
- resolve passthrough gates and path direction
- expose projected pages by node id

This file is the testable runtime implementation.

## Discovery Model

The current browser discovery rule covers project-root markdown files and nested subfolders:

`packages/content/<project>/*.md`

`packages/content/<project>/**/*.md`

Each folder becomes one project.

Each markdown file is parsed as one content object.

Non-matching files are ignored.

Invalid matching files are skipped with warnings.

## Layer Stack

Runtime stack:

1. handwritten markdown-like content
2. parser normalization
3. interpreter selection
4. projection into page models
5. runtime core for project assembly and navigation resolution
6. browser wrapper for discovery
7. React app shell for route state, history, and shortcut dispatch
8. renderer components for display

This is slightly richer than the earlier simpler diagram, but it matches the current implementation.

## App-Level Responsibilities

The app shell adds behavior on top of pure runtime data:

- route state
- per-project history
- per-project area visit counts
- per-node action attempt counts
- recent log accumulation
- same-node projected page stabilization so in-node interactions do not reselect visible prose
- keyboard shortcut dispatch
- home screen vs project screen composition

This should stay explicit so future refactors do not confuse pure projection with full browser behavior.

Important note:

The app shell owns lightweight run/session state that directly affects prose selection semantics.

That includes:

- whether an area is on first visit or repeat visit
- which attempt count a POI or choice is currently on
- whether a same-node rerender should preserve the already-selected visible prose

That behavior is still app-level rather than part of pure projection.

The current code now uses a dedicated app-session helper module for route normalization and project-scoped state replacement.

See `AppSessionStateV1.md` for the browser-only run/session layer above runtime.

## Stability Rules

The following rules are worth preserving unless a later architecture revision intentionally replaces them:

- keep direct `import.meta.glob` in the browser wrapper
- keep browser-agnostic runtime logic in the core module
- keep test coverage centered on the core runtime
- treat project discovery and navigation resolution as runtime concerns above projection

## Current Simplifications

The current runtime is deliberately simple in several ways:

- if an authored `title_screen` Area exists, it is preferred as the start node; otherwise the runtime falls back to the first discovered Area
- history-based back behavior is app-level and lightweight
- alias resolution is permissive for authoring convenience during the current phase
- invalid files are skipped rather than halting the whole project

These should be understood as explicit choices, not accidents.