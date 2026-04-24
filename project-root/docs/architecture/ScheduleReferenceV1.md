# Schedule Reference v1

This document is the compact working reference for authored time schedules in `settings/time.yaml`.

Use it when writing or reviewing recurring state changes, time-window availability, refill loops, and authored schedule-driven recent-log lines.

This is a practical reference for what is safe to author now.

## Current Schedule Shape

Schedules currently live under:

```yaml
schedules:
  schedule_id:
    ...
```

Current common fields are:

- `description`
- `trigger`
- optional `when`
- optional `activeWindow`
- optional `target`
- optional `actor`
- optional `lane`
- optional `effects`

The parser also accepts `repeat`, but repeating schedule semantics are not part of the current practical authoring baseline yet.

Current safe rule:

- do not rely on `repeat` as a primary authoring feature until the docs explicitly promote it from parsed shape to supported behavior guidance

## Trigger Kinds

### Phase Trigger

Use this when a schedule should react to a time phase or phase group.

```yaml
trigger:
  kind: phase
  phaseId: dawn
  edge: enter
```

Current supported phase trigger fields are:

- `phaseId`
- `phaseGroup`
- optional `edge: enter | exit`

Current practical use:

- streetlamps switching at dusk or dawn
- newspapers appearing in the morning window
- refill schedules keyed to the next matching phase

### Condition Trigger

Use this when a schedule should run while a predicate resolves true.

```yaml
trigger:
  kind: condition
  predicate:
    predicate: is_dawn
```

Current practical use:

- conditional activation tied to predicates instead of a fixed phase id

### Elapsed Trigger

Use this when a schedule should fire after another schedule has been armed and enough minutes have passed.

```yaml
trigger:
  kind: elapsed
  scheduleId: mint_refill_timer
  minutes: 10
```

Current practical use:

- delayed follow-up after an authored `arm_schedule` effect

Important rule:

- elapsed schedules only work when something has previously written `runtime.schedules.<scheduleId>.armedAtMs`, usually through `arm_schedule`

### Clock Trigger

Use this when a schedule should become active after absolute elapsed minutes in the current cycle.

```yaml
trigger:
  kind: clock
  minutes: 180
```

Current practical use:

- coarse absolute-in-cycle checks

Current practical caution:

- phase triggers are the safer default for authored content because they are easier to read, less brittle, and better aligned with current demo patterns

## When Gate

Use `when` when a schedule should only apply if a predicate also passes.

```yaml
when:
  predicate: counter_mint_taken_in_day
```

Current practical use:

- phase-specific refill schedules
- optional restrictions on when a phase trigger should matter

## Active Windows

Use `activeWindow` when a schedule should only run between a start and stop condition.

```yaml
activeWindow:
  stop:
    kind: phase
    phaseId: day
    edge: enter
```

Current practical rule:

- an active window controls whether the schedule is considered active
- it does not automatically undo earlier state changes

If something should turn off later, author a second schedule for that reversal.

That is why the demo04 morning paper uses one schedule to set availability `true` and another schedule to set it back to `false`.

## Targets

Use `target` when a schedule should only evaluate against specific authored scope.

Current supported target fields are:

- `nodes`
- `folders`
- `regions`
- `tags`

Example:

```yaml
target:
  folders:
    - diorama/block/building/building04
```

Current practical rule:

- use the smallest clear targeting scope that matches the authored behavior
- prefer a node or folder target over broad project-wide targeting when the effect is local

## Actor And Lane

Use `actor.text` and `lane` when the schedule should emit authored prose.

```yaml
actor:
  text:
    - One by one, the streetlamps along the curb flick on.
lane: recent
```

Current practical rule:

- schedule-driven status updates usually belong in `recent`
- use schedule prose for non-dramatic world changes, not for primary page prose

## Effects

Use `effects` when the schedule should mutate state.

Current common effect patterns are:

```yaml
effects:
  - set: [objects.streetlamps.on, true]
  - set: [objects.building04_morning_paper.available, false]
```

Current practical use:

- toggle object availability
- toggle environmental booleans
- restore refillable objects

Not every stateful gate needs schedules immediately.

Current practical rule:

- if something like a door mainly needs explicit authoritative state first, model it in `state/world.yaml` plus predicates and events before introducing schedule transitions
- use schedules when the world should change that state on its own at authored times, not as a prerequisite for making the stateful object real

## Current Examples

Streetlamp phase change:

```yaml
sidewalk_north_streetlamps_on:
  trigger:
    kind: phase
    phaseId: dusk
    edge: enter
  target:
    nodes:
      - sidewalk_north
    tags:
      - streetlight
  actor:
    text:
      - One by one, the streetlamps along the curb flick on.
  lane: recent
  effects:
    - set: [objects.streetlamps.on, true]
```

Morning-paper availability window:

```yaml
building04_morning_paper_window:
  trigger:
    kind: phase
    phaseId: dawn
    edge: enter
  activeWindow:
    stop:
      kind: phase
      phaseId: day
      edge: enter
  target:
    folders:
      - diorama/block/building/building04
  effects:
    - set: [objects.building04_morning_paper.available, true]

building04_morning_paper_clear_day:
  trigger:
    kind: phase
    phaseId: day
    edge: enter
  target:
    folders:
      - diorama/block/building/building04
  effects:
    - set: [objects.building04_morning_paper.available, false]
```

Wrapped-mint refill gate:

```yaml
building02_counter_mint_refill_day:
  trigger:
    kind: phase
    phaseId: day
    edge: enter
  when:
    predicate: counter_mint_taken_in_day
  target:
    nodes:
      - building02_groundfloor
  effects:
    - set: [objects.building02_counter_mint.available, true]
```

## Practical Authoring Rules

- prefer phase triggers for most authored content
- use a second schedule to reverse a state change instead of expecting `activeWindow` to undo it for you
- keep schedule state mutations explicit with `effects`
- pair scheduled state changes with predicates and event-side gating when player-facing content should follow the state
- use recent-text schedule prose sparingly and only for state changes the player should notice as ambient status

## Current Non-Goals

Do not assume these are part of the safe baseline unless the docs explicitly expand:

- cron-like expressions
- freeform timer scripting
- implicit schedule reversal on window end
- production-ready repeat/cadence authoring guidance beyond the currently documented patterns