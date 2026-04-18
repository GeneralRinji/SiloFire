# Projection View Model v0

Superseded note:
Use ProjectionViewModelV1.md as the current baseline for renderer-facing behavior.
This v0 file is kept as earlier design context.

This document defines the player-facing view model that the renderer should receive.

It exists to keep interpretation separate from rendering.

The renderer should not need to understand raw content files, parser structure, or most game logic.

It should mainly receive a simple page-like payload and display it.

## Purpose

For this project, projection is the step that turns normalized content plus current runtime context into something that can be rendered as a simple page.

That page should feel closer to a plain linked HTML document than to a complex game UI.

React is mostly being used to draw that page and refresh it automatically when the current projected state changes.

## Responsibility Split

### Parser

The parser reads handwritten source files and produces normalized content structures.

### Interpreter

The interpreter decides what content is currently relevant.

Examples:

- which prose slot applies
- which path flow applies
- whether a gate is surfaced or effectively passthrough
- whether an action should be available

### Projection

Projection takes the interpreter's result and builds a renderer-facing page model.

Projection answers questions such as:

- what prose is visible now
- what actions are visible now
- whether the page should render at all
- whether the current interaction should auto-advance
- what label and shortcut key each visible action should use

### Renderer

The renderer displays the projected page model.

It should not need to reconstruct content logic on its own.

## Core Principle

The renderer should receive something that is already easy to draw as:

- a page title
- an optional short subtitle or tagline
- one body of visible prose
- an optional sequence of visible beats
- an optional recent-text log if that presentation is used
- a simple list of actions or links

If the renderer needs to know too much about content schema details, the projection step is not doing enough.

## Page Model

At a high level, the renderer should receive one projected page at a time.

For v0, a projected page can be thought of like this:

```ts
type ProjectedPage = {
  kind: 'page' | 'auto_advance';
  nodeId: string;
  nodeKind: 'area' | 'path' | 'gate';
  title?: string;
  tagline?: string;
  proseBlocks: ProjectedProseBlock[];
  recentLog?: ProjectedLogEntry[];
  actions: ProjectedAction[];
  controls: ProjectedControl[];
};
```

This shape is illustrative.

The exact implementation can vary, but the renderer-facing payload should stay at about this level of complexity.

If a section of the page has no data, the renderer does not need to render an empty component for it.

## Prose Blocks

For v0, the simplest useful model is a list of visible prose blocks.

```ts
type ProjectedProseBlock = {
  kind: 'paragraph' | 'beat';
  text: string;
  markers?: ProjectedMarker[];
};
```

Notes:

- an Area may mostly project paragraph-style prose
- a Path may mostly project beat-style prose
- a Gate may project either, depending on how light or involved the threshold is
- simple markdown emphasis may survive through to rendering if the renderer supports it

## Markers

Projection may preserve lightweight presentation markers that survived parsing.

```ts
type ProjectedMarker = {
  kind: 'delay' | 'fade';
  value: string;
};
```

For v0, this does not need to become a complex animation system.

It is enough for the renderer to know that these markers exist so later display behavior can respect them.

## Recent Log

If useful, projection may also provide a simple recent-text log.

```ts
type ProjectedLogEntry = {
  id: string;
  text: string;
};
```

For v0, this can stay extremely simple.

The main use is a middle-page or page-adjacent stack of recently shown text if that presentation style feels right.

This is optional.

Projection does not need to provide it for every page.

## Actions And Controls

The renderer should receive visible choices in a very plain format.

```ts
type ProjectedAction = {
  id: string;
  kind: 'exit' | 'choice' | 'poi' | 'gate_action';
  label: string;
  key?: string;
  keyLabel?: string;
  targetId?: string;
};

type ProjectedControl = {
  id: string;
  kind: 'continue' | 'skip' | 'back';
  label: string;
  key?: string;
  keyLabel?: string;
};
```

Guidance:

- actions are content-facing things like exits, POIs, or authored choices
- controls are traversal-facing things like continue, skip, and back
- both should be simple enough to render as links or a basic action list
- visible key labels such as `[A]` or `[B]` are part of the presentation style, not identifiers
- if there are no POIs, choices, or similar items, the renderer does not need to render that section at all

Basic example:

```text
[A] Go West
[B] Go North to the Caves
```

## Title And Tagline

The projected page may include:

- `title`
- `tagline`

For v0:

- `title` is usually the node display name
- `tagline` is optional supporting flavor copied from content metadata if present

This keeps the page presentation lightweight while still allowing a little authored flavor at the top.

## Auto-Advance

Projection should be able to say that no visible page is necessary.

For v0, that can be modeled with `kind: 'auto_advance'` or an equivalent flag.

Auto-advance is appropriate when:

- the node resolves as passthrough
- there is no meaningful prose to show
- there are no meaningful actions or controls to present

This keeps the experience low-friction and avoids cluttering the screen with empty or fake pages.

## Area Projection

Area projection will usually produce:

- title and optional tagline
- one or more prose paragraphs
- visible POIs
- visible choices
- visible exits

Areas are the most likely node type to feel like a full page.

## Path Projection

Path projection will usually produce:

- title and optional tagline
- one or more ordered beats
- traversal controls such as continue, skip, and back

The path remains the current node until traversal resolves.

For v0, that is enough. No more complicated location math is required.

## Gate Projection

Gate projection will usually produce one of two results:

1. a minimal visible threshold page
2. no visible page because the gate effectively resolves as passthrough

If visible, a Gate will usually surface:

- a short prose block
- maybe a billboard-like descriptive block
- a small number of threshold actions such as continue, back, or knock

## No-Prose Cases

No visible prose does not automatically mean no page.

Projection should still be allowed to produce a page if:

- actions need to be shown
- traversal controls need to be shown
- a visible node shell still matters for feel

However, if there is no prose and no meaningful interaction, projection should prefer auto-advance.

## Renderer Expectations

The renderer should be able to assume:

- the current page is already decided
- the visible prose is already selected
- the visible action list is already filtered
- page-level controls are already decided
- shortcut keys are already attached where relevant
- empty sections do not need placeholder UI

The renderer should not need to know:

- how prose variants were selected
- why one flow was chosen over another
- whether a section came from repeated headings or a single authored block
- raw parser structure

## HTML-Like Rendering Style

The projected model should be easy to render as a simple page with:

- a heading
- an optional short supporting line
- body text
- an optional recent-text stack or log box
- a small list of links or controls

The most basic navigation presentation can be explicit hyperlink-style choices with visible shortcut labels, for example:

```text
[A] Go West
[B] Go North to the Caves
```

That is the intended interaction model.

This should feel like simple page redraw, not an app-heavy game shell.

An admin-oriented view may choose to show more of the underlying available data, but the normal player-facing view should stay minimal.

## Minimum Success Criteria

Projection is good enough for v0 if:

1. the renderer can display one current page without knowing raw content structure
2. Areas can project prose plus exits, choices, and POIs
3. Paths can project beats plus continue, skip, and back controls
4. Gates can either project a minimal threshold page or auto-advance away
5. no-prose states can still either render a useful page or intentionally auto-advance
6. React is only being used as a convenient redraw mechanism, not as the source of content logic