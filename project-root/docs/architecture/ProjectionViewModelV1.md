# Projection View Model v1

This document is the working reference for the renderer-facing shape used by the current app.

Use it when changing the interpreter, projection layer, renderer, or app shell contracts.

## Purpose

Projection should give the renderer something simple to draw.

The renderer should not need to know about raw markdown files, parser internals, alias resolution, or passthrough routing rules.

It should receive a page-like payload that can be rendered directly.

## Responsibility Split

Responsibility split:

- parser reads handwritten source and normalizes content objects
- interpreter selects relevant prose, actions, and controls
- projection turns interpreted data into a renderer-facing page model
- web runtime handles project discovery, cross-node navigation, recent log augmentation, and keyboard shortcut dispatch
- renderer draws the projected page

Projection is intentionally smaller than the full browser runtime.

## Current Result Shapes

The renderer-facing result is one of two kinds:

```ts
type ProjectionResult = ProjectedPage | ProjectedAutoAdvance;
```

### ProjectedPage

```ts
type ProjectedPage = {
  kind: 'page';
  nodeId: string;
  nodeKind: 'area' | 'path' | 'gate';
  title?: string;
  tagline?: string;
  areaNavigationLabels?: ProjectedAreaNavigationLabels;
  gateNavigationLabels?: ProjectedAreaNavigationLabels;
  proseBlocks: ProjectedProseBlock[];
  recentLog?: ProjectedLogEntry[];
  actions: ProjectedAction[];
  controls: ProjectedControl[];
};
```

### ProjectedAutoAdvance

```ts
type ProjectedAutoAdvance = {
  kind: 'auto_advance';
  nodeId: string;
  nodeKind: 'area' | 'path' | 'gate';
};
```

## Auto-Advance Meaning

`auto_advance` means the node should not produce a normal visible page at that moment.

In practice this mainly happens for empty passthrough-like nodes.

Projection should decide this at the page-model level so the renderer can stay simple.

The browser runtime may still request different projected pages for the same Path node depending on route-local traversal state such as active direction and current beat index.

## Prose Blocks

Current block shape:

```ts
type ProjectedProseBlock = {
  groupId?: string;
  kind: 'paragraph' | 'beat';
  text: string;
  markers?: ProjectedMarker[];
};
```

Interpret these blocks as follows:

- Areas usually project paragraph-style prose
- Paths usually project beat-style prose
- Gates may do either

Simple inline emphasis may survive into the renderer if the renderer supports it.

`groupId` is a lightweight grouping hint used by the renderer for authored prose grouping behavior such as preserving short breaks between prose families.

## Markers

Current marker shape:

```ts
type ProjectedMarker = {
  kind: 'delay' | 'fade';
  value: string;
};
```

These are lightweight presentation hints, not a full animation system.

## Recent Log

Current log shape:

```ts
type ProjectedLogEntry = {
  id: string;
  text: string;
  markers?: ProjectedMarker[];
  blocks?: ProjectedProseBlock[];
};
```

Important behavior:

- projection can expose `recentLog`
- the browser runtime may also append additional recent log entries after projection
- runtime-appended recent log entries may carry lightweight presentation markers such as `fade`
- runtime-appended recent log entries may also preserve authored block splits so delay markers can stage later lines instead of delaying the whole entry

Weather-specific note:

- repeated current-weather text should not be baked into every projected page
- weather announcements belong to app-session/runtime policy above projection

That means recent log is part of the page model, but not necessarily produced only by pure projection.

Live-update note:

- changing live runtime state may refresh controls, offered actions, or recent log on the current node
- those updates must not replay visible node prose as if the player re-entered the node
- renderer/app integration should avoid remounting the whole projected page merely because a revision key changed for controls or recent-log augmentation

## Actions And Controls

Current action and control shapes remain:

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

Practical note:

- projected controls keep a simple shape even when the browser runtime is using route-local Path traversal state to decide whether `continue` advances within the current Path or exits it
- projection does not need a separate control type for one-way Paths; the runtime simply projects a smaller control set when `back` should not be available

## Shortcut Keys

Keys are part of the active interaction contract.

Projected keys now serve two purposes:

- they render visible labels such as `[R]` or `[1]`
- they drive keyboard shortcut matching in the web app

While `keyLabel` is presentation-facing, `key` itself is part of the interactive contract between projection and the app shell.

Keep this simple:

- letter keys are matched case-insensitively
- numeric keys are valid
- the renderer does not need to know about keyboard events
- the app shell can dispatch based on projected `key` values

## Renderer Expectations

The renderer should be able to treat the page model as plain display data.

It may render:

- title
- optional tagline
- prose blocks
- recent log
- action sections
- control sections

If a section is empty, the renderer may omit it.

That remains the correct level of responsibility.

## Non-Goals

Projection should not be responsible for:

- Vite content discovery
- project folder grouping
- alias resolution
- path-direction inference across nodes
- project history behavior

Those belong in the browser/runtime layer above projection.