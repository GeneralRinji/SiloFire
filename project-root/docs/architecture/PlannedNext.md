# Planned Next

This document is a holding area for likely future features, experiments, and refactor targets.

It is intentionally not a hard contract.

These notes exist to show the probable shape of the project so future design and refactor work can move in a coherent direction.

If this file conflicts with current architecture docs or verified code behavior, treat this file as forward-looking intent rather than current truth.

## Working Assumptions

- Each game or demo should stay independent unless there is a clear shared-system reason not to.
- Server authority remains the default for stateful and multiplayer-relevant behavior.
- Client UI may expose tools, menus, panes, and debug controls, but should not quietly become the source of gameplay truth.
- Some items here are phase 2 ideas, some are phase 3 or phase 4 ideas, and some may be dropped entirely.

## Platform And Shell

- test time configuration per game or demo, with room to expand features independently
- system menu
- production and development environment setup clarified and made reliable
- evaluate Deno Deploy as a hosting target for silofire.net
- toggle troubleshooting pane on and off
- mount and unmount mini-game state systems that may run under different rules

## Social And Character Systems

- banter system
- idle text when the player does nothing
- idle text when another character does nothing
- party system
- finite state machine support for more complex AI buddies; likely phase 3 or phase 4

## Story And Progression

- story event system expansion
- quest and unquest system
- achievement and unachievement system
- notes panels tied to the unquest system

## Economy And World Interaction

- sample store content
- simple store flow
- richer store systems with membership, hours, crowds, and similar constraints
- simple inventory system
- dropping items at a node and picking them back up later
- despawn cadence for dropped location items, similar to existing spawn cadence patterns

## World Simulation

- optional season system

## Multiplayer And Messaging

- test the shared and private text system with actual players
- login support needed for proper multi-player testing

## Design Notes

- Deno Deploy looks like a plausible hosting target, but the current app is not deploy-ready there as a pure static site because live runtime endpoints currently exist only inside the Vite dev server plugin
- stores should likely exist along a spectrum from very simple to simulation-heavy rather than as one monolithic commerce system
- unquest and unachievement support may need to preserve reversal, failure, or anti-progression states rather than assuming one-way completion
- inventory and dropped-item systems should respect server authority if they affect persistence, trade, griefing risk, or multiplayer consistency
- mini-game state systems should be isolated enough that they can have different rules without contaminating the main runtime model
- per-project time configuration should avoid coupling one demo's rules to another demo's rules

## Refactor Reminder

When implementing anything in this file:

1. Decide whether it is display-only or authoritative gameplay state.
2. Put authoritative state on the server by default.
3. Keep runtime rules testable outside React.
4. Avoid solving new systems with ad hoc client caches, browser-history fallbacks, or hardcoded component state.