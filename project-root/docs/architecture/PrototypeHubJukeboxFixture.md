# PrototypeHub Jukebox Fixture

This file documents the PrototypeHub jukebox fixture as it exists today.

It is not a stable architecture contract.

It is a current-state implementation note for future refactor work.

For the target architecture that separates shared fixture state, private interaction context, and audience-aware text projection, see `AudienceAndFixtureContextsV1.md`.

If this file disagrees with verified code behavior, trust the code first and then update this note.

## Why This Exists

The PrototypeHub jukebox is currently one of the most behavior-heavy built-in fixtures in the repo.

It works, but the behavior is split across multiple layers:

- authored content and seeded object state
- shared runtime fixture interaction code
- server-side session refresh and persistence glue
- session-stream wakeup scheduling in the Vite dev server

That split is good enough for the prototype, but it is already carrying enough special behavior that it should be treated as a likely refactor target.

## Where The Current Behavior Lives

Current implementation is spread across these files:

- `packages/content/PrototypeHub/lobby/lobby_area.md`
- `packages/content/PrototypeHub/state/world.yaml`
- `packages/runtime/src/jukeboxCatalogs.ts`
- `packages/runtime/src/index.ts`
- `packages/runtime-server/src/runtimeSessionService.ts`
- `packages/runtime-server/src/index.ts`
- `apps/web/vite.config.ts`
- `apps/web/src/runtimeApiService.test.ts`

## Authored Shape Today

PrototypeHub authors the jukebox as an area fixture on `lobby_area`:

- `id: prototypehub_lobby_jukebox`
- `kind: jukebox`
- `displayName: Jukebox`
- `stateId: prototypehub_lobby_jukebox`
- `catalogId: prototypehub_classic_yt`
- `maxQueueLength: 20`

The song catalog is currently hardcoded in `packages/runtime/src/jukeboxCatalogs.ts`.

Each song currently carries both playback-facing metadata and room-atmosphere text:

- title and artist
- youtubeUrl
- approximate duration
- vibe
- marqueeTexts
- flavorTexts
- tags

## Session Object State Today

The PrototypeHub world seed gives the jukebox these fields:

- `focused`
- `browseIndex`
- `fakeCredits`
- `currentTrack`
- `currentTrackLabel`
- `currentTrackMode`
- `currentTrackStartedAtMs`
- `currentTrackEndsAtMs`
- `lobbyAtmosphereTrackId`
- `lobbyAtmosphereTick`
- `queueTrackIds`

This is doing at least four jobs in one object:

- same-node interaction focus state
- browsing and selection state
- playback and queue state
- PrototypeHub-specific atmosphere tracking

That is workable for the prototype, but it is already broader than a clean fixture state model.

## Runtime Interaction Model Today

The base fixture interaction logic lives in `packages/runtime/src/index.ts`.

The current model is same-node focused interaction:

1. The fixture appears on the lobby page as a POI action.
2. Selecting the POI sets `focused = true`.
3. If nothing is already playing, the fixture may start a fallback autoplay song.
4. While focused, the fixture exposes offered actions instead of changing rooms.

Current focused actions are:

- `swipe_left`
- `swipe_right`
- `queue_song`
- `view_queue`
- `add_fake_money`
- `step_away`

Current behavior notes:

- Swipe updates `browseIndex` and replaces the node recent log with a preview panel.
- `view_queue` replaces the node recent log with a queue-status panel.
- `add_fake_money` increments a fake-credit counter.
- `queue_song` either starts paid playback immediately or appends to `queueTrackIds`.
- `step_away` clears `focused` but leaves playback running.
- Queue-full enforcement is authored per fixture via `maxQueueLength`.
- The current queue-full rule only applies once a paid track is already active; autoplay by itself does not count as a full queue anchor.

## Projection And Display Shape Today

The base runtime does not create a dedicated jukebox page type.

Instead, the jukebox reuses the lobby page and injects more actions plus recent-log output while focused.

Today the fixture uses recent log for multiple different display surfaces:

- preview card
- queue panel
- credit status
- playback updates
- step-away narration
- automatic queue advance text
- periodic lobby atmosphere text

This is one of the main signs that the prototype is straining the current page/recent-log boundary.

The queue view is especially coupled to recent-log block structure. It is not a separate projected panel model; it is a special grouped log entry that later code mutates in place.

## Server-Side Extensions Today

The jukebox is no longer just a shared runtime fixture.

PrototypeHub-specific behavior is now layered on in the server runtime package.

### Persistence Normalization

`packages/runtime-server/src/runtimeSessionService.ts` strips `focused` from persisted object state.

That means:

- playback state persists
- queue state persists
- selected browse index persists
- transient interaction focus does not persist

On restore or refresh after persistence, the player returns to the lobby surface rather than resuming an in-progress control mode.

### Automatic Queue Advance

`packages/runtime/src/index.ts` reconciles playback timing and advances from the current track into queued tracks.

`packages/runtime-server/src/runtimeSessionService.ts` then adds or rewrites visible recent-log output when that automatic advance happens.

So the playback transition and the user-facing log update do not currently live in one place.

### Periodic Lobby Atmosphere

`packages/runtime-server/src/index.ts` adds PrototypeHub-specific timed atmosphere behavior while a track is playing.

Current rules:

- interval is every 45 seconds
- text is derived from the song's `marqueeTexts` and `flavorTexts`
- selection is deterministic, not random
- entries are interleaved marquee/flavor text when possible and then loop
- tick tracking is stored on the object as `lobbyAtmosphereTrackId` and `lobbyAtmosphereTick`

The same server layer also decorates the lobby page so that active atmosphere text appears in visible prose when the jukebox is not currently focused.

### Admin Reset

`packages/runtime-server/src/index.ts` also owns the admin reset path for jukeboxes.

That reset currently clears:

- fake credits
- current track fields
- queue state
- atmosphere tracking state
- jukebox queue recent-log entries

## Scheduling Today

The current timed refresh wakeup for jukebox atmosphere updates is scheduled in `apps/web/vite.config.ts`.

That means one piece of jukebox timing behavior currently lives in the Vite dev-server integration rather than in a dedicated runtime scheduler abstraction.

This was sufficient for the current prototype, but it is another sign that the behavior surface is broader than a simple fixture helper.

## Why This Probably Needs A Refactor

The current implementation works, but it has several clear pressure points.

### 1. Behavior Is Split Across Too Many Layers

Today you have to read multiple packages to understand one fixture:

- content seed
- shared runtime interaction
- runtime-server refresh logic
- runtime-server persistence normalization
- Vite session-stream timing

That is too much surface area for one gameplay object.

### 2. The State Model Mixes Domain And UI Concerns

The same object currently holds:

- authoritative playback state
- queue state
- interaction focus state
- browse cursor state
- PrototypeHub atmosphere bookkeeping

Those concerns do not all have the same lifetime or ownership.

### 3. Presentation State Is Being Stored As Mutable Recent Log Structure

Preview and queue panels are currently encoded as grouped recent-log entries.

Later code rewrites those entries to keep the displayed queue fresh.

That is clever, but it means gameplay state and UI panel formatting are coupled more tightly than they should be.

### 4. PrototypeHub-Specific Logic Is Hardcoded By Node And Object Identity

Lobby atmosphere decoration and related behavior currently know about:

- the `lobby_area` node
- the `prototypehub_lobby_jukebox` object id
- PrototypeHub-specific atmosphere fields

That is acceptable for the prototype, but it is not a generic fixture boundary.

### 5. Catalog Metadata Is Doing Multiple Jobs

The current song catalog mixes:

- playback metadata
- browse-preview copy
- ambient room prose
- tagging and vibe labeling

That may remain acceptable, but it should become a conscious content contract rather than accidental coupling.

## Likely Refactor Direction

The probable next step is not to remove the jukebox, but to tighten its boundaries.

The most likely healthier shape is:

1. Define an explicit server-owned jukebox domain model instead of an open-ended object bag.
2. Separate transient interaction state from persisted playback and queue state.
3. Stop treating queue UI as a special recent-log mutation format.
4. Move timed playback and timed atmosphere behavior behind one scheduler or domain boundary.
5. Replace PrototypeHub-specific hardcodes with either fixture capabilities or authored configuration for ambient playback text.
6. Keep projection renderer-facing so React remains a consumer rather than the owner of fixture behavior.

## What Should Stay True After Refactor

Even if the implementation changes, these current qualities are worth preserving:

- same-node focused interaction instead of teleporting to a separate jukebox room
- server-owned playback and queue truth
- persistent queue and playback state across refresh and continue
- non-persistent interaction focus state
- authored per-song room flavor
- explicit queue limit behavior
- admin reset as an operational escape hatch

## Tests To Treat As Current Behavioral Proof

The most useful executable reference for the current shape is `apps/web/src/runtimeApiService.test.ts`.

That file currently covers:

- door gating before lobby entry
- focused jukebox interaction
- autoplay fallback
- paid playback
- queue behavior
- queue persistence across refresh and continue
- admin reset
- queue limits
- periodic lobby atmosphere behavior

If the fixture is refactored, that file is the fastest way to see which current behaviors are intentional enough to preserve.