# Navigation And Traversal v0

Superseded note:
Use NavigationAndTraversalV1.md as the current baseline for implemented runtime behavior.
This v0 file is kept as earlier design context.

This document defines the current navigation and traversal model for the prototype.

The model is intentionally simple.

It should feel closer to linked pages in an old choose-your-own-adventure or webring than to a heavy spatial simulation.

In practical terms, this should feel closer to very dumb 1995-style HTML pages than to a modern app-heavy game UI.

React is mainly here to render data into components and update the visible page state automatically without asking the player to manually refresh.

## Core Principle

Navigation should be dumb in a good way.

Content objects already carry most of the information needed to move through the world.

The UI should mainly surface that data as a readable page with a lightweight list of actions, exits, or traversal controls.

The UI does not need to feel like a complex game shell.

It can behave more like a plain page that redraws itself when the current content state changes.

## Node Navigation Model

At the prototype level, navigation is content-driven.

Each node can expose one or more of the following:

- exits
- choices
- POIs
- traversal controls

The renderer can present these as a simple list of actions or links.

This should feel closer to plain linked-page navigation than to a command console or a dense HUD.

Shortcut keys such as `R` or `H` are UI shortcuts, not identifiers.

## Area Navigation

Areas usually have the richest navigation surface.

An Area may expose:

- exits to other nodes
- choices that shape tone or posture
- POIs that reveal optional detail

An Area does not need complicated spatial logic.

If there is interesting detail in part of a room or place, the Area can simply expose more POIs or local choices.

## Path Navigation

Paths are simpler.

A Path usually exposes traversal-style controls such as:

- continue
- skip
- back

Paths are directional and beat-based.

While traversing a path, the current interaction may remain associated with the path until the traversal resolves.

The prototype does not need a more complex location model than that.

## Gate Navigation

Gates are threshold-oriented.

If a Gate surfaces at all, it usually only needs a small navigation surface such as:

- continue
- back
- a threshold-specific action like knock

Some gates may never need to surface visibly.

For example, a passthrough doorway may simply route the player onward with no rendered page or controls.

## Presentation Modes

Traversal presentation affects whether a node interrupts the player at all.

Current modes:

- `normal`
- `passthrough`
- `walkpassthrough`
- `runpassthrough`
- `billboard`

### Normal

The node may render a normal page-like surface.

### Passthrough

The node does not meaningfully interrupt movement.

If it resolves this way, no navigation shell needs to be shown.

### Walkpassthrough

The node may route through seamlessly when the current movement posture is walk-compatible.

### Runpassthrough

The node may route through seamlessly when the current movement posture is run-compatible.

### Billboard

The node is visible but shallow.

It can present a short descriptive surface without becoming a full location.

## Navigation Data In Content

Navigation should already be present in content config whenever possible.

Example:

```yaml
exits:
  - id: shack_run
    targetId: shack_run_{guid}
    displayName: Through ShackRun
    key: R

  - id: harbor_edge
    targetId: harbor_edge_{guid}
    displayName: Back to Harbor Edge Road
    key: H
```

This is enough for the runtime to produce a simple navigation list.

## Current Node During Traversal

For v0, keep this simple:

- when in an Area, the current node is the Area
- when traversing a Path, the current node is the Path until traversal completes or is skipped/backed out
- when interacting with a surfaced Gate, the current node is the Gate for the duration of that threshold interaction

This avoids overcomplicating the navigation model.

## Auto-Advance

Some nodes or transitions should not interrupt the player at all.

Auto-advance is acceptable when:

- the node resolves as passthrough
- no meaningful prose is shown
- no meaningful navigation or decision needs to be surfaced

If content is intentionally visible, the runtime may still render a minimal page shell with actions or controls.

## Business Door Example

A business door is a useful prototype gate.

It may be:

- billboard-like
- not enterable yet
- still worth surfacing for flavor

It can still expose useful details such as:

- open or closed messaging
- business hours
- sounds from inside
- a knock action
- a storefront or vitrine-like look-in option

This proves the gate concept without requiring a full interior node system.

## Non-Goals

This navigation model is not trying to provide:

- a robust map simulation
- precise spatial reasoning
- a heavy room graph engine
- a complex action command parser

It only needs to support content-driven traversal with lightweight player-facing controls.

React is a rendering tool here, not the point of the interaction model.

The interaction model should still feel simple enough that it could be imagined as plain HTML pages with links and small action lists.

## Minimum Success Criteria

The navigation model is good enough for v0 if:

1. Areas can present exits, choices, and POIs
2. Paths can present continue, skip, and back behavior
3. Gates can surface lightly or disappear into passthrough when appropriate
4. the renderer can show all of that as simple page-level controls or links, with React mainly handling display updates instead of forcing manual page refreshes
5. the result feels readable and low-friction rather than over-systematized