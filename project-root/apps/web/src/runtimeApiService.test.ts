import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import {
  createRuntimeApiService,
  matchRuntimeApiRequest,
  type PersistedRuntimeSessionSnapshot,
  type SiteAnnouncementRecord,
} from '../../../packages/runtime-server/src';

const projectRoot = resolve(__dirname, '..', '..', '..');

class MemoryRuntimeStore {
  constructor(private readonly files: Record<string, string>) {}

  writeText(path: string, content: string): void {
    this.files[path] = content;
  }

  async readText(path: string): Promise<string | undefined> {
    return this.files[path];
  }

  async readDirectory(path: string): Promise<Array<{ name: string; isFile: boolean }>> {
    const prefix = `${path}/`;
    const children = new Map<string, boolean>();

    Object.keys(this.files).forEach((filePath) => {
      if (!filePath.startsWith(prefix)) {
        return;
      }

      const remainder = filePath.slice(prefix.length);
      const separatorIndex = remainder.indexOf('/');

      if (separatorIndex === -1) {
        children.set(remainder, true);
        return;
      }

      children.set(remainder.slice(0, separatorIndex), false);
    });

    return Array.from(children.entries()).map(([name, isFile]) => ({ name, isFile }));
  }
}

class MemorySnapshotStore {
  constructor(private readonly values: Record<string, PersistedRuntimeSessionSnapshot> = {}) {}

  async has(key: string): Promise<boolean> {
    return Object.prototype.hasOwnProperty.call(this.values, key);
  }

  async get(key: string): Promise<PersistedRuntimeSessionSnapshot | undefined> {
    return this.values[key];
  }

  async set(key: string, value: PersistedRuntimeSessionSnapshot): Promise<void> {
    this.values[key] = value;
  }

  async delete(key: string): Promise<void> {
    delete this.values[key];
  }

  async *list(prefix?: string): AsyncIterable<{ key: string; value: PersistedRuntimeSessionSnapshot }> {
    for (const [key, value] of Object.entries(this.values)) {
      if (!prefix || key === prefix || key.startsWith(`${prefix}/`)) {
        yield { key, value };
      }
    }
  }
}

class MemoryValueStore<TValue> {
  constructor(private readonly values: Record<string, TValue> = {}) {}

  async has(key: string): Promise<boolean> {
    return Object.prototype.hasOwnProperty.call(this.values, key);
  }

  async get(key: string): Promise<TValue | undefined> {
    return this.values[key];
  }

  async set(key: string, value: TValue): Promise<void> {
    this.values[key] = value;
  }

  async delete(key: string): Promise<void> {
    delete this.values[key];
  }

  async *list(prefix?: string): AsyncIterable<{ key: string; value: TValue }> {
    for (const [key, value] of Object.entries(this.values)) {
      if (!prefix || key === prefix || key.startsWith(`${prefix}/`)) {
        yield { key, value };
      }
    }
  }
}

function loadProjectFiles(projectId: string): Record<string, string> {
  const base = resolve(projectRoot, 'packages', 'content', projectId);
  const files: Record<string, string> = {};
  const stack = [base];

  while (stack.length > 0) {
    const directory = stack.pop();

    if (!directory) {
      continue;
    }

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      files[relative(projectRoot, fullPath).replace(/\\/g, '/')] = readFileSync(fullPath, 'utf8');
    }
  }

  return files;
}

test('runtime api request matcher resolves session routes', () => {
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-projects'), {
    kind: 'project_list',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/site-announcements/stream'), {
    kind: 'site_announcement_stream',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/site-announcements'), {
    kind: 'site_announcement_snapshot',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-admin/site-announcements'), {
    kind: 'admin_site_announcement_snapshot',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-admin/site-announcements/example'), {
    kind: 'admin_site_announcement_item',
    announcementId: 'example',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-heart/demo04/title_screen'), {
    kind: 'heart_update',
    projectId: 'demo04',
    nodeId: 'title_screen',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-admin/hearts'), {
    kind: 'admin_heart_overview',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-admin/hearts/demo04'), {
    kind: 'admin_heart_project',
    projectId: 'demo04',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-admin/hearts/demo04/reset'), {
    kind: 'admin_heart_reset',
    projectId: 'demo04',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-session/demo04/start'), {
    kind: 'session_create',
    projectId: 'demo04',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-session/session_1'), {
    kind: 'session_snapshot',
    sessionId: 'session_1',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-session/session_1/action'), {
    kind: 'session_action',
    sessionId: 'session_1',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-session/session_1/control'), {
    kind: 'session_control',
    sessionId: 'session_1',
  });
  assert.deepEqual(matchRuntimeApiRequest('/api/runtime-session/session_1/reset'), {
    kind: 'session_reset',
    sessionId: 'session_1',
  });
});

test('runtime api evaluates a site-owned active announcement stack in server order', async () => {
  const siteAnnouncementStore = new MemoryValueStore<SiteAnnouncementRecord>({
    'site/maintenance-banner': {
      id: 'maintenance-banner',
      scope: 'site',
      title: 'Scheduled Maintenance',
      body: 'Server work starts shortly.',
      mode: 'persistent',
      priority: 10,
      startsAtMs: 500,
      endsAtMs: 2_000,
      colorTone: 'critical',
      enabled: true,
      createdAtMs: 100,
      updatedAtMs: 100,
    },
    'site/active-note': {
      id: 'active-note',
      scope: 'site',
      title: 'Patch Note',
      body: 'The block has a small update.',
      mode: 'dismissible',
      priority: 10,
      startsAtMs: 600,
      endsAtMs: 1_900,
      linkHref: '/admin',
      linkLabel: 'Read More',
      colorTone: 'info',
      enabled: true,
      createdAtMs: 100,
      updatedAtMs: 100,
    },
    'site/upcoming-note': {
      id: 'upcoming-note',
      scope: 'site',
      title: 'Soon',
      body: 'This starts later.',
      mode: 'blocking',
      priority: 4,
      startsAtMs: 1_500,
      endsAtMs: 2_500,
      enabled: true,
      createdAtMs: 100,
      updatedAtMs: 100,
    },
    'site/expired-note': {
      id: 'expired-note',
      scope: 'site',
      title: 'Earlier',
      body: 'This has already ended.',
      mode: 'dismissible',
      priority: 8,
      startsAtMs: 100,
      endsAtMs: 750,
      enabled: true,
      createdAtMs: 100,
      updatedAtMs: 100,
    },
  });
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 1_000,
    siteAnnouncementStore,
  });

  const snapshot = await runtimeApi.getSiteAnnouncementSnapshot();

  assert.equal(snapshot.calendarScope, 'site');
  assert.equal(snapshot.currentTimeMs, 1_000);
  assert.equal(snapshot.nextChangeAtMs, 1_500);
  assert.deepEqual(snapshot.activeAnnouncements.map((announcement) => announcement.id), [
    'maintenance-banner',
    'active-note',
  ]);
  assert.deepEqual(snapshot.upcomingAnnouncements.map((announcement) => announcement.id), ['upcoming-note']);
  assert.deepEqual(snapshot.expiredAnnouncements.map((announcement) => announcement.id), ['expired-note']);
});

test('runtime api can create, validate, update, and delete site announcements for admin flows', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 2_000,
  });

  const invalidCreate = await runtimeApi.createSiteAnnouncement({
    title: '',
    body: 'Invalid sample',
    mode: 'dismissible',
    priority: 5,
    enabled: true,
    linkHref: 'javascript:alert(1)',
  });

  assert.equal(invalidCreate.kind, 'validation_error');

  const created = await runtimeApi.createSiteAnnouncement({
    title: 'Admin Created',
    body: 'Created from the admin route.',
    mode: 'blocking',
    priority: 25,
    startsAtMs: 1_000,
    endsAtMs: 5_000,
    colorTone: 'warning',
    enabled: true,
  });

  assert.equal(created.kind, 'ok');

  const adminSnapshot = await runtimeApi.getAdminSiteAnnouncementSnapshot();
  assert.equal(adminSnapshot.activeAnnouncements[0]?.title, 'Admin Created');
  assert.equal(adminSnapshot.disabledAnnouncements.length, 0);
  assert.equal(adminSnapshot.nextChangeAtMs, 5_000);

  const updated = await runtimeApi.updateSiteAnnouncement(created.value.id, {
    title: 'Admin Updated',
    body: 'Updated from the admin route.',
    mode: 'persistent',
    priority: 40,
    colorTone: 'critical',
    enabled: true,
  });

  assert.equal(updated.kind, 'ok');
  assert.equal(updated.value.title, 'Admin Updated');
  assert.equal(updated.value.createdAtMs, created.value.createdAtMs);
  assert.equal(updated.value.updatedAtMs, 2_000);

  const disabled = await runtimeApi.updateSiteAnnouncement(created.value.id, {
    title: 'Admin Disabled',
    body: 'Disabled from the admin route.',
    mode: 'persistent',
    priority: 40,
    colorTone: 'critical',
    enabled: false,
  });

  assert.equal(disabled.kind, 'ok');

  const disabledSnapshot = await runtimeApi.getAdminSiteAnnouncementSnapshot();
  assert.equal(disabledSnapshot.disabledAnnouncements[0]?.title, 'Admin Disabled');
  assert.equal(disabledSnapshot.allAnnouncements[0]?.title, 'Admin Disabled');
  assert.equal(disabledSnapshot.nextChangeAtMs, undefined);

  const deleted = await runtimeApi.deleteSiteAnnouncement(created.value.id);
  assert.equal(deleted, true);

  const missingUpdate = await runtimeApi.updateSiteAnnouncement('missing', {
    title: 'Missing',
    body: 'Missing',
    mode: 'dismissible',
    priority: 1,
    enabled: true,
  });
  assert.equal(missingUpdate.kind, 'not_found');
});

test('runtime api heart analytics add, remove, rank, project detail, and reset work server-side', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    adminPassword: 'open-sesame',
  });

  assert.equal(runtimeApi.isAdminPasswordValid('wrong'), false);
  assert.equal(runtimeApi.isAdminPasswordValid('open-sesame'), true);

  const firstNorthHeart = await runtimeApi.setHeart('demo04', 'sidewalk_north', true);
  const secondNorthHeart = await runtimeApi.setHeart('demo04', 'sidewalk_north', true);
  const buildingHeart = await runtimeApi.setHeart('demo04', 'building04_groundfloor', true);
  const removedNorthHeart = await runtimeApi.setHeart('demo04', 'sidewalk_north', false);
  const removedMissingHeart = await runtimeApi.setHeart('demo04', 'title_screen', false);

  assert.deepEqual(firstNorthHeart, {
    projectId: 'demo04',
    nodeId: 'sidewalk_north',
    count: 1,
  });
  assert.deepEqual(secondNorthHeart, {
    projectId: 'demo04',
    nodeId: 'sidewalk_north',
    count: 2,
  });
  assert.deepEqual(buildingHeart, {
    projectId: 'demo04',
    nodeId: 'building04_groundfloor',
    count: 1,
  });
  assert.deepEqual(removedNorthHeart, {
    projectId: 'demo04',
    nodeId: 'sidewalk_north',
    count: 1,
  });
  assert.deepEqual(removedMissingHeart, {
    projectId: 'demo04',
    nodeId: 'title_screen',
    count: 0,
  });
  assert.equal(await runtimeApi.setHeart('demo04', 'missing_node', true), undefined);

  const overview = await runtimeApi.listHeartAdminOverview();
  assert.equal(overview[0]?.projectId, 'demo04');
  assert.equal(overview[0]?.totalHearts, 2);

  const details = await runtimeApi.getHeartAdminProject('demo04');

  if (!details) {
    throw new Error('Expected admin heart detail for demo04.');
  }

  assert.equal(details.totalHearts, 2);
  assert.deepEqual(
    details.nodes
      .filter((node) => node.heartCount > 0)
      .map((node) => ({ nodeId: node.nodeId, heartCount: node.heartCount }))
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
    [
      { nodeId: 'building04_groundfloor', heartCount: 1 },
      { nodeId: 'sidewalk_north', heartCount: 1 },
    ],
  );
  assert.ok(details.nodes.some((node) => node.nodeId === 'title_screen'));
  assert.ok(details.sessionObjectStateById?.building03_door);
  assert.ok(details.sessionNpcStateById?.resident_01);

  const resetResult = await runtimeApi.resetProjectHearts('demo04');
  assert.equal(resetResult, true);

  const resetDetails = await runtimeApi.getHeartAdminProject('demo04');

  if (!resetDetails) {
    throw new Error('Expected reset admin heart detail for demo04.');
  }

  assert.equal(resetDetails.totalHearts, 0);
  assert.equal(resetDetails.nodes[0]?.heartCount, 0);
});

test('runtime api admin project detail prefers persisted shared session state over authored defaults', async () => {
  const snapshotStore = new MemorySnapshotStore({
    'projects/demo04/snapshot': {
      projectId: 'demo04',
      route: {
        nodeId: 'building04_groundfloor',
        pathDirection: undefined,
        pathBeatIndex: undefined,
        runNonce: 0,
      },
      areaVisitCounts: {},
      pathVisitCounts: {},
      recentLogByNodeId: {},
      actionAttemptsByNodeId: {},
      sessionState: {
        npcs: {
          resident_01: {
            location: 'sidewalk_north',
            behavior: 'move',
          },
        },
        objects: {
          building03_door: {
            open: false,
            locked: true,
          },
        },
      },
      savedAt: Date.now(),
    },
  });

  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    adminPassword: 'open-sesame',
    snapshotStore,
  });

  const details = await runtimeApi.getHeartAdminProject('demo04');

  if (!details) {
    throw new Error('Expected admin heart detail for demo04.');
  }

  assert.deepEqual(details.sessionNpcStateById?.resident_01, {
    location: 'sidewalk_north',
    behavior: 'move',
  });
  assert.deepEqual(details.sessionObjectStateById?.building03_door, {
    open: false,
    locked: true,
  });
  assert.deepEqual(details.objectFieldDetailsById?.building03_door?.open?.defaultValue, true);
  assert.deepEqual(details.objectFieldDetailsById?.building03_door?.open?.possibleValues, [true, false]);
});

test('runtime api service exposes session-backed progression over project content', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/visits/visit_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: visit_area
displayName: Visit Area
region: old_harbor

exits:
  - id: onward
    targetId: second_area
    displayName: Move On
---

# Visit Area

## first_visit
First time here.

## repeat_visit
Later visit.

## enter
Arrival line.
`,
    'packages/content/visits/second_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: second_area
displayName: Second Area
region: old_harbor

exits:
  - id: return
    targetId: visit_area
    displayName: Return
---

# Second Area

## enter
The alley bends back toward the square.
`,
  }));

  const firstView = await runtimeApi.createSession('visits', { nodeId: 'visit_area' });

  assert.equal(firstView?.page?.kind, 'page');

  if (!firstView || !firstView.page || firstView.page.kind !== 'page') {
    throw new Error('Expected first session page.');
  }

  assert.deepEqual(firstView.page.proseBlocks.map((block) => block.text), ['First time here.', 'Arrival line.']);

  const onwardAction = firstView.page.actions.find((action) => action.id === 'onward');

  if (!onwardAction) {
    throw new Error('Expected onward action.');
  }

  const secondView = await runtimeApi.applySessionAction(firstView.snapshot.sessionId, onwardAction);

  assert.equal(secondView?.page?.kind, 'page');

  if (!secondView || !secondView.page || secondView.page.kind !== 'page') {
    throw new Error('Expected second session page.');
  }

  const returnAction = secondView.page.actions.find((action) => action.id === 'return');

  if (!returnAction) {
    throw new Error('Expected return action.');
  }

  const repeatView = await runtimeApi.applySessionAction(firstView.snapshot.sessionId, returnAction);

  assert.equal(repeatView?.page?.kind, 'page');

  if (!repeatView || !repeatView.page || repeatView.page.kind !== 'page') {
    throw new Error('Expected repeat session page.');
  }

  assert.deepEqual(repeatView.page.proseBlocks.map((block) => block.text), ['Later visit.', 'Arrival line.']);
  assert.equal(repeatView.snapshot.areaVisitCounts.visit_area, 2);
});

test('runtime api reset reloads edited project content before rebuilding the session', async () => {
  const store = new MemoryRuntimeStore({
    'packages/content/reload/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: system

titleScreen:
  saveMode: single

exits:
  - id: begin
    targetId: building01_groundfloor
    displayName: Begin
---

# Title Screen

## enter
Start here.
`,
    'packages/content/reload/building01_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: diorama_block

pois:
  - id: front_window
    displayName: Front Window
  - id: vase_01
    displayName: Ceramic Vase
    key: V
---

# Building 01 Ground Floor

## enter
Testing room.

## poi:front_window
Window text.

## poi:vase_01
Vase text.
`,
    'packages/content/reload/ending_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: ending_area
displayName: Ending Area
region: diorama_block
---

# Ending Area

## ending
Done.
`,
  });

  const runtimeApi = createRuntimeApiService(store);
  const startedView = await runtimeApi.createSession('reload');

  if (!startedView?.page || startedView.page.kind !== 'page') {
    throw new Error('Expected title page.');
  }

  const beginAction = startedView.page.actions.find((action) => action.id === 'title_screen_new_game');

  if (!beginAction) {
    throw new Error('Expected title screen new game action.');
  }

  const groundFloorView = await runtimeApi.applySessionAction(startedView.snapshot.sessionId, beginAction);

  if (!groundFloorView?.page || groundFloorView.page.kind !== 'page') {
    throw new Error('Expected ground floor page.');
  }

  assert.deepEqual(groundFloorView.page.actions.map((action) => action.keyLabel), [undefined, '[V]']);

  store.writeText('packages/content/reload/building01_groundfloor.md', `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: diorama_block

pois:
  - id: front_window
    displayName: Front Window
    key: F
  - id: vase_01
    displayName: Ceramic Vase
    key: V
---

# Building 01 Ground Floor

## enter
Testing room.

## poi:front_window
Window text.

## poi:vase_01
Vase text.
`);

  const resetView = await runtimeApi.resetSession(groundFloorView.snapshot.sessionId);

  if (!resetView?.page || resetView.page.kind !== 'page') {
    throw new Error('Expected title page after reset.');
  }

  assert.equal(resetView.page.nodeId, 'title_screen');
  assert.deepEqual(resetView.page.actions.map((action) => action.id), ['title_screen_new_game']);
  assert.deepEqual(resetView.page.actions.map((action) => action.keyLabel), ['[N]']);
});

test('runtime api lists playable projects from server metadata', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/demo04/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: system

titleScreen:
  saveMode: single

exits:
  - id: begin
    targetId: street
    displayName: Begin
---

# Title Screen

## enter
Start.
`,
    'packages/content/demo04/street.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: street
displayName: Street
region: old_harbor
---

# Street

## enter
Outside.
`,
  }));

  const projects = await runtimeApi.listProjects();

  assert.equal(projects.some((project) => project.id === 'demo04'), true);
});

test('runtime api synthesizes title-screen continue from server snapshot state', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/continue/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: system

titleScreen:
  saveMode: single

exits:
  - id: begin
    targetId: street
    displayName: Begin
---

# Title Screen

## enter
Start.
`,
    'packages/content/continue/street.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: street
displayName: Street
region: old_harbor

pois:
  - id: bench
    displayName: Bench
---

# Street

## enter
Outside.

## poi:bench
You check the bench.
`,
  }));

  const firstSession = await runtimeApi.createSession('continue');

  if (!firstSession?.page || firstSession.page.kind !== 'page') {
    throw new Error('Expected title screen page.');
  }

  assert.deepEqual(firstSession.page.actions.map((action) => action.id), ['title_screen_new_game']);
  assert.deepEqual(firstSession.page.actions.map((action) => action.label), ['New Game']);
  assert.deepEqual(firstSession.page.actions.map((action) => action.keyLabel), ['[N]']);

  const newGameView = await runtimeApi.applySessionAction(firstSession.snapshot.sessionId, firstSession.page.actions[0]!);

  if (!newGameView?.page || newGameView.page.kind !== 'page') {
    throw new Error('Expected street page after new game.');
  }

  assert.equal(newGameView.page.nodeId, 'street');

  const secondSession = await runtimeApi.createSession('continue');

  if (!secondSession?.page || secondSession.page.kind !== 'page') {
    throw new Error('Expected title screen page on second session.');
  }

  assert.deepEqual(secondSession.page.actions.map((action) => action.id), ['title_screen_new_game', 'title_screen_continue']);
  assert.deepEqual(secondSession.page.actions.map((action) => action.label), ['New Game', 'Continue']);
  assert.deepEqual(secondSession.page.actions.map((action) => action.keyLabel), ['[N]', '[C]']);
  assert.match(secondSession.page.actions[1]?.meta ?? '', /^Last: Street \| /);

  const continueAction = secondSession.page.actions.find((action) => action.id === 'title_screen_continue');

  if (!continueAction) {
    throw new Error('Expected continue action on title screen.');
  }

  const continuedView = await runtimeApi.applySessionAction(secondSession.snapshot.sessionId, continueAction);

  if (!continuedView?.page || continuedView.page.kind !== 'page') {
    throw new Error('Expected restored street page.');
  }

  assert.equal(continuedView.page.nodeId, 'street');
});

test('runtime api sessions use the server clock instead of seeded world time for entry predicates', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/clocked/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: sidewalk_north
    displayName: Start
---

# Title Screen

## enter
Start.
`,
    'packages/content/clocked/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: North Sidewalk
region: sketch_region
---

# North Sidewalk

## enter
The sidewalk is bright.
`,
    'packages/content/clocked/settings/time.yaml': `calendars:
  sketch_region:
    preset: earth_like_4phase
    minutesPerPhase: 1

assignments:
  defaultCalendar: sketch_region
`,
    'packages/content/clocked/block/events.yaml': `events:
  enter_sidewalk_north_in_morning:
    trigger:
      kind: enter
      actor: player
      nodeId: sidewalk_north

    when:
      predicate: is_morning

    actor:
      - Morning light catches the storefront glass before the block fully wakes.
`,
    'packages/content/clocked/predicates/project.yaml': `predicates:
  is_morning:
    equals: [world.time.phase, morning]
`,
    'packages/content/clocked/state/world.yaml': `world:
  time:
    phase: day

player:
  active:
    id: player_01
`,
  }), {
    now: () => 180_000,
  });

  const sessionView = await runtimeApi.createSession('clocked', { nodeId: 'sidewalk_north' });

  if (!sessionView?.page || sessionView.page.kind !== 'page') {
    throw new Error('Expected sidewalk page.');
  }

  assert.equal(
    sessionView.page.recentLog?.some((entry) => entry.text === 'Morning light catches the storefront glass before the block fully wakes.'),
    true,
  );
});

test('runtime api clock snapshots honor folder-scoped calendar assignments on refresh', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/clockfolders/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: system

titleScreen:
  saveMode: single

exits:
  - id: begin
    targetId: building04_groundfloor
    displayName: Begin
---

# Title Screen

## enter
Start.
`,
    'packages/content/clockfolders/building04/building04_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building04_groundfloor
displayName: Building 04 Ground Floor
region: diorama_block

exits:
  - id: finish
    targetId: ending_area
    displayName: Finish
---

# Building 04 Ground Floor

## enter
Interior.
`,
    'packages/content/clockfolders/ending_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: ending_area
displayName: Ending Area
region: diorama_block
tags:
  - ending
---

# Ending Area

## ending
Done.
`,
    'packages/content/clockfolders/settings/time.yaml': `calendars:
  diorama_block:
    preset: earth_like_4phase
    minutesPerPhase: 1

  interior_longform:
    preset: custom
    phases:
      - id: day
        durationMinutes: 2
      - id: dusk
        durationMinutes: 1
      - id: night
        durationMinutes: 2
      - id: dawn
        durationMinutes: 1

assignments:
  defaultCalendar: diorama_block
  folders:
    building04: interior_longform
  regions:
    diorama_block: diorama_block
`,
    'packages/content/clockfolders/state/world.yaml': `world:
  time:
    mode: ambient
    phase: night
    cycle:
      - day
      - dusk
      - night
      - dawn
`,
  }), {
    now: () => 180_000,
  });

  const snapshot = await runtimeApi.getClockSnapshot('clockfolders', 'building04_groundfloor', 'diorama_block');

  assert.equal(snapshot?.calendarId, 'interior_longform');
  assert.equal(snapshot?.source, 'server:state-world');
});

test('runtime api seeds time prose once on an allowed node and does not duplicate it on refresh', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/timeannounce/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region
---

# Title Screen

## enter
Start.
`,
    'packages/content/timeannounce/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: North Sidewalk
region: sketch_region
---

# North Sidewalk

## enter
Outside.
`,
    'packages/content/timeannounce/settings/time.yaml': `calendars:
  sketch_region:
    phases:
      - id: dusk
        durationMinutes: 1
        statusText:
          - The light starts going bronze across the block.

assignments:
  defaultCalendar: sketch_region

visibility:
  defaultRecentLog: false
  nodes:
    sidewalk_north: true
`,
  }), {
    now: () => 0,
  });

  const sessionView = await runtimeApi.createSession('timeannounce', { nodeId: 'sidewalk_north' });

  if (!sessionView?.page || sessionView.page.kind !== 'page') {
    throw new Error('Expected sidewalk page.');
  }

  assert.equal(sessionView.page.recentLog?.some((entry) => entry.text === 'The light starts going bronze across the block.'), true);

  const refreshedView = await runtimeApi.getSession(sessionView.snapshot.sessionId);

  if (!refreshedView?.page || refreshedView.page.kind !== 'page') {
    throw new Error('Expected refreshed sidewalk page.');
  }

  assert.equal(
    refreshedView.page.recentLog?.filter((entry) => entry.text === 'The light starts going bronze across the block.').length,
    1,
  );
});

test('runtime api seeds interior time prose on new game when the start node is allowed', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/interiortime/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region
---

# Title Screen

## enter
Start.
`,
    'packages/content/interiortime/building01/building01_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: sketch_region
---

# Building 01 Ground Floor

## enter
Inside.
`,
    'packages/content/interiortime/settings/time.yaml': `calendars:
  block:
    phases:
      - id: day
        durationMinutes: 1
        statusText:
          - Daylight stays outside.

  interior_longform:
    phases:
      - id: day
        durationMinutes: 1
        statusText:
          - Daylight settles softly through the front room and across the stair.

assignments:
  defaultCalendar: block
  folders:
    building01: interior_longform

visibility:
  defaultRecentLog: false
  nodes:
    building01_groundfloor: true
`,
  }), {
    now: () => 0,
  });

  const sessionView = await runtimeApi.createSession('interiortime', { nodeId: 'building01_groundfloor' });

  if (!sessionView?.page || sessionView.page.kind !== 'page') {
    throw new Error('Expected interior page.');
  }

  assert.equal(
    sessionView.page.recentLog?.some((entry) => entry.text === 'Daylight settles softly through the front room and across the stair.'),
    true,
  );
});

test('runtime api can show interior time prose without outdoor weather clutter on the same node', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/interiorambient/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: block
---

# Title Screen

## enter
Start.
`,
    'packages/content/interiorambient/building01/building01_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: block
---

# Building 01 Ground Floor

## enter
Inside.
`,
    'packages/content/interiorambient/settings/time.yaml': `calendars:
  interior_longform:
    phases:
      - id: dusk
        durationMinutes: 1
        statusText:
          - Dusk gathers in the window glass and along the edges of the room.

assignments:
  defaultCalendar: interior_longform

visibility:
  defaultRecentLog: false
  nodes:
    building01_groundfloor: true
`,
    'packages/content/interiorambient/settings/weather.yaml': `patterns:
  block_weather:
    minutesPerStep: 1
    steps:
      - id: clear_soft
        kind: clear
        intensity: soft
        statusText:
          - The block sits under a clear sky.

assignments:
  defaultPattern: block_weather
  regions:
    block: block_weather

visibility:
  defaultRecentLog: false
  regions:
    block: true
  nodes:
    building01_groundfloor: false
`,
  }), {
    now: () => 0,
  });

  const sessionView = await runtimeApi.createSession('interiorambient', { nodeId: 'building01_groundfloor' });

  if (!sessionView?.page || sessionView.page.kind !== 'page') {
    throw new Error('Expected interior page.');
  }

  assert.equal(
    sessionView.page.recentLog?.some((entry) => entry.text === 'Dusk gathers in the window glass and along the edges of the room.'),
    true,
  );
  assert.equal(
    sessionView.page.recentLog?.some((entry) => entry.text === 'The block sits under a clear sky.'),
    false,
  );
});

test('runtime api seeds weather and time on the first playable node after new game from title screen', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/titleambient/diorama/title/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: system

titleScreen:
  saveMode: single

exits:
  - id: begin
    targetId: sidewalk_north
    displayName: Begin
---

# Title Screen

## enter
Start.
`,
    'packages/content/titleambient/diorama/block/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: North Sidewalk
region: block
---

# North Sidewalk

## enter
Outside.
`,
    'packages/content/titleambient/settings/time.yaml': `calendars:
  block:
    phases:
      - id: dusk
        durationMinutes: 1
        statusText:
          - The light starts going bronze across the block.

assignments:
  defaultCalendar: block

visibility:
  defaultRecentLog: false
  folders:
    diorama: true
`,
    'packages/content/titleambient/settings/weather.yaml': `patterns:
  block_weather:
    minutesPerStep: 1
    steps:
      - id: clear_soft
        kind: clear
        intensity: soft
        statusText:
          - The block sits under a clear sky.

assignments:
  defaultPattern: block_weather
  regions:
    block: block_weather

visibility:
  defaultRecentLog: false
  regions:
    block: true
`,
  }), {
    now: () => 0,
  });

  const titleView = await runtimeApi.createSession('titleambient');

  if (!titleView?.page || titleView.page.kind !== 'page') {
    throw new Error('Expected title screen page.');
  }

  const newGameAction = titleView.page.actions.find((action) => action.id === 'title_screen_new_game');

  if (!newGameAction) {
    throw new Error('Expected new game action.');
  }

  const firstNodeView = await runtimeApi.applySessionAction(titleView.snapshot.sessionId, newGameAction);

  if (!firstNodeView?.page || firstNodeView.page.kind !== 'page') {
    throw new Error('Expected first playable page.');
  }

  assert.equal(
    firstNodeView.page.recentLog?.some((entry) => entry.text === 'The light starts going bronze across the block.'),
    true,
  );
  assert.equal(
    firstNodeView.page.recentLog?.some((entry) => entry.text === 'The block sits under a clear sky.'),
    true,
  );
});

test('runtime api does not rebroadcast time prose when returning to the same visible node later', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/timereturn/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: block
---

# Title Screen

## enter
Start.
`,
    'packages/content/timereturn/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: North Sidewalk
region: block

exits:
  - id: east
    targetId: sidewalk_east
    displayName: East
---

# North Sidewalk

## enter
North.
`,
    'packages/content/timereturn/sidewalk_east.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_east
displayName: East Sidewalk
region: block

exits:
  - id: north
    targetId: sidewalk_north
    displayName: North
---

# East Sidewalk

## enter
East.
`,
    'packages/content/timereturn/settings/time.yaml': `calendars:
  block:
    phases:
      - id: dusk
        durationMinutes: 1
        statusText:
          - The light starts going bronze across the block.

assignments:
  defaultCalendar: block

visibility:
  defaultRecentLog: false
  nodes:
    sidewalk_north: true
`,
  }), {
    now: () => 0,
  });

  const firstView = await runtimeApi.createSession('timereturn', { nodeId: 'sidewalk_north' });

  if (!firstView?.page || firstView.page.kind !== 'page') {
    throw new Error('Expected north sidewalk page.');
  }

  assert.equal(
    firstView.page.recentLog?.filter((entry) => entry.text === 'The light starts going bronze across the block.').length,
    1,
  );

  const eastAction = firstView.page.actions.find((action) => action.id === 'east');

  if (!eastAction) {
    throw new Error('Expected east exit action.');
  }

  const eastView = await runtimeApi.applySessionAction(firstView.snapshot.sessionId, eastAction);

  if (!eastView?.page || eastView.page.kind !== 'page') {
    throw new Error('Expected east sidewalk page.');
  }

  const northAction = eastView.page.actions.find((action) => action.id === 'north');

  if (!northAction) {
    throw new Error('Expected north exit action.');
  }

  const returnView = await runtimeApi.applySessionAction(firstView.snapshot.sessionId, northAction);

  if (!returnView?.page || returnView.page.kind !== 'page') {
    throw new Error('Expected return to north sidewalk page.');
  }

  assert.equal(
    returnView.page.recentLog?.some((entry) => entry.text === 'The light starts going bronze across the block.') ?? false,
    false,
  );
});

test('runtime api can seed time prose from folder visibility on east sidewalk', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/timefolder/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: block
---

# Title Screen

## enter
Start.
`,
    'packages/content/timefolder/diorama/block/sidewalk_east.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_east
displayName: East Sidewalk
region: block
---

# East Sidewalk

## enter
East.
`,
    'packages/content/timefolder/settings/time.yaml': `calendars:
  block:
    phases:
      - id: day
        durationMinutes: 1
        statusText:
          - Daylight flattens the block into a tidy row of surfaces and reflections.

assignments:
  defaultCalendar: block

visibility:
  defaultRecentLog: false
  folders:
    diorama: true
`,
  }), {
    now: () => 0,
  });

  const sessionView = await runtimeApi.createSession('timefolder', { nodeId: 'sidewalk_east' });

  if (!sessionView?.page || sessionView.page.kind !== 'page') {
    throw new Error('Expected east sidewalk page.');
  }

  assert.equal(
    sessionView.page.recentLog?.some((entry) => entry.text === 'Daylight flattens the block into a tidy row of surfaces and reflections.'),
    true,
  );
});

test('runtime api shows a local schedule recent-log line when the phase changes on the current node', async () => {
  let currentNowMs = 0;
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore({
    'packages/content/streetlamp/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: block
---

# Title Screen

## enter
Start.
`,
    'packages/content/streetlamp/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: North Sidewalk
region: block
---

# North Sidewalk

## enter
Outside.
`,
    'packages/content/streetlamp/settings/time.yaml': `calendars:
  block:
    phases:
      - id: day
        durationMinutes: 2
      - id: dusk
        durationMinutes: 1
      - id: night
        durationMinutes: 2
      - id: dawn
        durationMinutes: 1

assignments:
  defaultCalendar: block

visibility:
  defaultRecentLog: false
  nodes:
    sidewalk_north: true

schedules:
  sidewalk_north_streetlamps_on:
    trigger:
      kind: phase
      phaseId: dusk
      edge: enter
    target:
      nodes:
        - sidewalk_north
    actor:
      - One by one, the streetlamps along the curb flick on.
    lane: recent
    effects:
      - set: [objects.streetlamps.on, true]
`,
  }), {
    now: () => currentNowMs,
  });

  const sessionView = await runtimeApi.createSession('streetlamp', { nodeId: 'sidewalk_north' });

  if (!sessionView?.page || sessionView.page.kind !== 'page') {
    throw new Error('Expected sidewalk page.');
  }

  assert.equal(
    sessionView.page.recentLog?.some((entry) => entry.text === 'One by one, the streetlamps along the curb flick on.') ?? false,
    false,
  );

  currentNowMs = 120_000;

  const refreshedView = await runtimeApi.getSession(sessionView.snapshot.sessionId);

  if (!refreshedView?.page || refreshedView.page.kind !== 'page') {
    throw new Error('Expected refreshed sidewalk page.');
  }

  assert.equal(
    refreshedView.page.recentLog?.some((entry) => entry.text === 'One by one, the streetlamps along the curb flick on.'),
    true,
  );
});

test('runtime api can take the wrapped mint again on the next matching phase', async () => {
  let currentNowMs = 0;
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => currentNowMs,
  });

  const sessionView = await runtimeApi.createSession('demo04', { nodeId: 'building02_groundfloor' });

  if (!sessionView?.page || sessionView.page.kind !== 'page') {
    throw new Error('Expected building02 page.');
  }

  const takeMintAction = sessionView.page.actions.find((action) => action.id === 'take_counter_mint' && action.kind === 'choice');
  const sampleBowlAction = sessionView.page.actions.find((action) => action.id === 'sample_bowl' && action.kind === 'poi');

  if (!takeMintAction || !sampleBowlAction) {
    throw new Error('Expected mint actions.');
  }

  const afterTakeView = await runtimeApi.applySessionAction(sessionView.snapshot.sessionId, takeMintAction);

  if (!afterTakeView?.page || afterTakeView.page.kind !== 'page') {
    throw new Error('Expected page after taking mint.');
  }

  const emptyInspectView = await runtimeApi.applySessionAction(sessionView.snapshot.sessionId, sampleBowlAction);

  if (!emptyInspectView?.page || emptyInspectView.page.kind !== 'page') {
    throw new Error('Expected page after empty bowl inspect.');
  }

  assert.equal(emptyInspectView.page.recentLog?.at(-1)?.text, 'The bowl is empty now, though it looks like someone still means to keep the gesture going.');

  currentNowMs = 360_000;

  const refreshedView = await runtimeApi.getSession(sessionView.snapshot.sessionId);

  if (!refreshedView?.page || refreshedView.page.kind !== 'page') {
    throw new Error('Expected refreshed page.');
  }

  const nextSampleBowlAction = refreshedView.page.actions.find((action) => action.id === 'sample_bowl' && action.kind === 'poi');

  if (!nextSampleBowlAction) {
    throw new Error('Expected sample bowl action after refresh.');
  }

  const refilledInspectView = await runtimeApi.applySessionAction(sessionView.snapshot.sessionId, nextSampleBowlAction);

  if (!refilledInspectView?.page || refilledInspectView.page.kind !== 'page') {
    throw new Error('Expected page after refilled bowl inspect.');
  }

  assert.equal(refilledInspectView.page.recentLog?.at(-1)?.text, 'One wrapped mint waits in the bowl like the room is still practicing for customers.');
});

test('runtime api building03 door allows entry during open hours and blocks it at night', async () => {
  const dayRuntimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 0,
  });
  const nightRuntimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 180_000,
  });

  const dayDoorView = await dayRuntimeApi.createSession('demo04', { nodeId: 'building03groundfloor_sidewalk_east' });
  const nightDoorView = await nightRuntimeApi.createSession('demo04', { nodeId: 'building03groundfloor_sidewalk_east' });

  if (!dayDoorView?.page || dayDoorView.page.kind !== 'page') {
    throw new Error('Expected Building 03 door page during day.');
  }

  if (!nightDoorView?.page || nightDoorView.page.kind !== 'page') {
    throw new Error('Expected Building 03 door page at night.');
  }

  assert.equal(
    ((dayDoorView.snapshot.sessionState.objects as Record<string, Record<string, unknown>> | undefined)?.building03_door?.open),
    true,
  );
  assert.equal(
    dayDoorView.offeredActions.some((action) => action.id === 'enter_building03'),
    true,
  );
  assert.equal(
    nightDoorView.offeredActions.some((action) => action.id === 'enter_building03'),
    false,
  );
});

test('runtime api building03 door respects explicit closed state during open hours', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 0,
  });

  const openDoorView = await runtimeApi.createSession('demo04', { nodeId: 'building03groundfloor_sidewalk_east' });

  if (!openDoorView?.page || openDoorView.page.kind !== 'page') {
    throw new Error('Expected Building 03 door page during day.');
  }

  const restoredClosedDoorView = await runtimeApi.restoreSession('demo04', {
    projectId: openDoorView.snapshot.projectId,
    route: openDoorView.snapshot.route,
    areaVisitCounts: openDoorView.snapshot.areaVisitCounts,
    pathVisitCounts: openDoorView.snapshot.pathVisitCounts,
    recentLogByNodeId: openDoorView.snapshot.recentLogByNodeId,
    actionAttemptsByNodeId: openDoorView.snapshot.actionAttemptsByNodeId,
    sessionState: {
      ...openDoorView.snapshot.sessionState,
      objects: {
        ...((openDoorView.snapshot.sessionState.objects as Record<string, unknown> | undefined) ?? {}),
        building03_door: {
          ...(((openDoorView.snapshot.sessionState.objects as Record<string, Record<string, unknown>> | undefined)?.building03_door) ?? {}),
          open: false,
        },
      },
    },
  });

  if (!restoredClosedDoorView?.page || restoredClosedDoorView.page.kind !== 'page') {
    throw new Error('Expected restored Building 03 door page.');
  }

  assert.equal(
    ((restoredClosedDoorView.snapshot.sessionState.objects as Record<string, Record<string, unknown>> | undefined)?.building03_door?.open),
    false,
  );
  assert.equal(
    restoredClosedDoorView.offeredActions.some((action) => action.id === 'enter_building03'),
    false,
  );

  const businessHoursAction = restoredClosedDoorView.page.actions.find(
    (action) => action.id === 'business_hours' && action.kind === 'poi',
  );

  if (!businessHoursAction) {
    throw new Error('Expected Building 03 business hours action.');
  }

  const closedHoursView = await runtimeApi.applySessionAction(restoredClosedDoorView.snapshot.sessionId, businessHoursAction);

  if (!closedHoursView?.page || closedHoursView.page.kind !== 'page') {
    throw new Error('Expected page after Building 03 business hours inspect.');
  }

  assert.equal(closedHoursView.page.recentLog?.at(-1)?.text, 'Open all day. Closed at night. Right now the place is closed.');
});

test('runtime api building03 upstairs ejects to the door when night falls without manual movement', async () => {
  let nowMs = 0;
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => nowMs,
  });

  const upstairsView = await runtimeApi.createSession('demo04', { nodeId: 'building03_upstairs' });

  if (!upstairsView?.page || upstairsView.page.kind !== 'page') {
    throw new Error('Expected Building 03 upstairs page during day.');
  }

  assert.equal(upstairsView.page.nodeId, 'building03_upstairs');

  nowMs = 180_000;

  const refreshedView = await runtimeApi.getSession(upstairsView.snapshot.sessionId);

  if (!refreshedView?.page || refreshedView.page.kind !== 'page') {
    throw new Error('Expected refreshed page after nightfall.');
  }

  assert.equal(refreshedView.page.nodeId, 'building03groundfloor_sidewalk_east');
  assert.equal(
    refreshedView.page.recentLog?.some((entry) => entry.text === 'Upstairs feels unavailable while the door is closed. A moment later you are back out at the door.') ?? false,
    true,
  );
});

test('runtime api returns ambient npc snapshots for demo04 walker content under diorama/npcs', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 0,
  });

  const snapshot = await runtimeApi.getAmbientSnapshot('demo04');
  const walker = snapshot.npcs.find((npc) => npc.id === 'walker_01');

  assert.ok(walker);
  assert.equal(walker?.nodeId, 'sidewalk_north');
  assert.equal(walker?.behavior, 'linger');
});

test('runtime api announces walker presence when entering a node where the walker is already waiting', async () => {
  let nowMs = 0;
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => nowMs,
  });

  const northView = await runtimeApi.createSession('demo04', { nodeId: 'sidewalk_north' });

  if (!northView?.page || northView.page.kind !== 'page') {
    throw new Error('Expected north sidewalk page.');
  }

  nowMs = 25_000;

  const refreshedNorthView = await runtimeApi.getSession(northView.snapshot.sessionId);

  if (!refreshedNorthView?.page || refreshedNorthView.page.kind !== 'page') {
    throw new Error('Expected refreshed north sidewalk page.');
  }

  const eastAction = refreshedNorthView.page.actions.find((action) => action.id === 'north_to_east');

  if (!eastAction) {
    throw new Error('Expected east exit action.');
  }

  const eastView = await runtimeApi.applySessionAction(northView.snapshot.sessionId, eastAction);

  if (!eastView?.page || eastView.page.kind !== 'page') {
    throw new Error('Expected east sidewalk page.');
  }

  assert.equal(
    eastView.page.recentLog?.some((entry) => entry.text === 'A walker is already here, keeping to the sidewalk.') ?? false,
    true,
  );
});

test('runtime api announces walker movement when entering a node the walker is passing through', async () => {
  let nowMs = 0;
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => nowMs,
  });

  const northView = await runtimeApi.createSession('demo04', { nodeId: 'sidewalk_north' });

  if (!northView?.page || northView.page.kind !== 'page') {
    throw new Error('Expected north sidewalk page.');
  }

  nowMs = 11_000;

  const refreshedNorthView = await runtimeApi.getSession(northView.snapshot.sessionId);

  if (!refreshedNorthView?.page || refreshedNorthView.page.kind !== 'page') {
    throw new Error('Expected refreshed north sidewalk page.');
  }

  const eastAction = refreshedNorthView.page.actions.find((action) => action.id === 'north_to_east');

  if (!eastAction) {
    throw new Error('Expected east exit action.');
  }

  const eastView = await runtimeApi.applySessionAction(northView.snapshot.sessionId, eastAction);

  if (!eastView?.page || eastView.page.kind !== 'page') {
    throw new Error('Expected east sidewalk page.');
  }

  assert.equal(
    eastView.page.recentLog?.some((entry) => entry.text === 'You spot a walker moving between corners along the block.') ?? false,
    true,
  );
});

test('runtime api keeps walker location shared across sessions and stable across service recreation', async () => {
  const nowMs = 25_000;
  const files = loadProjectFiles('demo04');
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(files), {
    now: () => nowMs,
  });

  const firstSession = await runtimeApi.createSession('demo04', { nodeId: 'sidewalk_north' });
  const secondSession = await runtimeApi.createSession('demo04', { nodeId: 'sidewalk_south' });

  if (!firstSession?.page || firstSession.page.kind !== 'page') {
    throw new Error('Expected first session page.');
  }

  if (!secondSession?.page || secondSession.page.kind !== 'page') {
    throw new Error('Expected second session page.');
  }

  const firstSnapshot = await runtimeApi.getAmbientSnapshot('demo04');
  const secondSnapshot = await runtimeApi.getAmbientSnapshot('demo04');
  const recreatedRuntimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => nowMs,
  });
  const recreatedSnapshot = await recreatedRuntimeApi.getAmbientSnapshot('demo04');
  const firstWalker = firstSnapshot.npcs.find((npc) => npc.id === 'walker_01');
  const secondWalker = secondSnapshot.npcs.find((npc) => npc.id === 'walker_01');
  const recreatedWalker = recreatedSnapshot.npcs.find((npc) => npc.id === 'walker_01');

  assert.ok(firstWalker);
  assert.deepEqual(secondWalker, firstWalker);
  assert.deepEqual(recreatedWalker, firstWalker);
  assert.equal(firstWalker?.nodeId, 'sidewalk_east');
  assert.equal(firstWalker?.behavior, 'linger');
});

test('runtime api resets resident conversation when the player leaves building04 groundfloor', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 0,
  });

  const groundFloorView = await runtimeApi.createSession('demo04', { nodeId: 'building04_groundfloor' });

  if (!groundFloorView?.page || groundFloorView.page.kind !== 'page') {
    throw new Error('Expected building04 ground floor page.');
  }

  const talkAction = groundFloorView.offeredActions.find((action) => action.id === 'talk_to_resident');

  if (!talkAction) {
    throw new Error('Expected talk to resident action.');
  }

  const afterTalkView = await runtimeApi.applySessionAction(groundFloorView.snapshot.sessionId, talkAction);

  if (!afterTalkView?.page || afterTalkView.page.kind !== 'page') {
    throw new Error('Expected page after starting resident conversation.');
  }

  assert.equal(
    ((afterTalkView.snapshot.sessionState.story as Record<string, Record<string, unknown>> | undefined)?.resident_01?.dialog_topic),
    'greeting',
  );

  const leaveAction = afterTalkView.page.actions.find((action) => action.id === 'building04_to_south');

  if (!leaveAction) {
    throw new Error('Expected south exit action from building04 ground floor.');
  }

  const sidewalkView = await runtimeApi.applySessionAction(groundFloorView.snapshot.sessionId, leaveAction);

  if (!sidewalkView?.page || sidewalkView.page.kind !== 'page') {
    throw new Error('Expected south sidewalk page.');
  }

  assert.equal(sidewalkView.page.nodeId, 'sidewalk_south');
  assert.equal(
    ((sidewalkView.snapshot.sessionState.story as Record<string, Record<string, unknown>> | undefined)?.resident_01?.dialog_topic),
    'idle',
  );

  const returnAction = sidewalkView.page.actions.find((action) => action.id === 'south_to_building04');

  if (!returnAction) {
    throw new Error('Expected return to building04 action.');
  }

  const returnedView = await runtimeApi.applySessionAction(groundFloorView.snapshot.sessionId, returnAction);

  if (!returnedView?.page || returnedView.page.kind !== 'page') {
    throw new Error('Expected building04 ground floor page after returning.');
  }

  assert.equal(
    returnedView.offeredActions.some((action) => action.id === 'talk_to_resident'),
    true,
  );
});

test('runtime api only offers the building04 morning paper during the dawn window', async () => {
  const dawnRuntimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 300_000,
  });
  const dayRuntimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 0,
  });

  const dawnView = await dawnRuntimeApi.createSession('demo04', { nodeId: 'building04_groundfloor' });
  const dayView = await dayRuntimeApi.createSession('demo04', { nodeId: 'building04_groundfloor' });

  if (!dawnView?.page || dawnView.page.kind !== 'page') {
    throw new Error('Expected building04 ground floor page at dawn.');
  }

  if (!dayView?.page || dayView.page.kind !== 'page') {
    throw new Error('Expected building04 ground floor page during day.');
  }

  assert.equal(
    dawnView.offeredActions.some((action) => action.id === 'read_morning_paper'),
    true,
  );
  assert.equal(
    dayView.offeredActions.some((action) => action.id === 'read_morning_paper'),
    false,
  );
});

test('runtime api continue does not preserve an in-progress resident conversation after leaving the node', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 0,
  });

  const groundFloorView = await runtimeApi.createSession('demo04', { nodeId: 'building04_groundfloor' });

  if (!groundFloorView?.page || groundFloorView.page.kind !== 'page') {
    throw new Error('Expected building04 ground floor page.');
  }

  const talkAction = groundFloorView.offeredActions.find((action) => action.id === 'talk_to_resident');

  if (!talkAction) {
    throw new Error('Expected talk to resident action.');
  }

  const afterTalkView = await runtimeApi.applySessionAction(groundFloorView.snapshot.sessionId, talkAction);

  if (!afterTalkView?.page || afterTalkView.page.kind !== 'page') {
    throw new Error('Expected page after starting resident conversation.');
  }

  const leaveAction = afterTalkView.page.actions.find((action) => action.id === 'building04_to_south');

  if (!leaveAction) {
    throw new Error('Expected south exit action from building04 ground floor.');
  }

  const sidewalkView = await runtimeApi.applySessionAction(groundFloorView.snapshot.sessionId, leaveAction);

  if (!sidewalkView?.page || sidewalkView.page.kind !== 'page') {
    throw new Error('Expected south sidewalk page.');
  }

  const titleView = await runtimeApi.createSession('demo04');

  if (!titleView?.page || titleView.page.kind !== 'page') {
    throw new Error('Expected title screen page.');
  }

  const continueAction = titleView.page.actions.find((action) => action.id === 'title_screen_continue');

  if (!continueAction) {
    throw new Error('Expected continue action on demo04 title screen.');
  }

  const continuedView = await runtimeApi.applySessionAction(titleView.snapshot.sessionId, continueAction);

  if (!continuedView?.page || continuedView.page.kind !== 'page') {
    throw new Error('Expected continued page.');
  }

  assert.equal(continuedView.page.nodeId, 'sidewalk_south');
  assert.equal(
    ((continuedView.snapshot.sessionState.story as Record<string, Record<string, unknown>> | undefined)?.resident_01?.dialog_topic),
    'idle',
  );
});

test('runtime api continue does not preserve an in-progress resident conversation after leaving the game on the same node', async () => {
  const runtimeApi = createRuntimeApiService(new MemoryRuntimeStore(loadProjectFiles('demo04')), {
    now: () => 0,
  });

  const groundFloorView = await runtimeApi.createSession('demo04', { nodeId: 'building04_groundfloor' });

  if (!groundFloorView?.page || groundFloorView.page.kind !== 'page') {
    throw new Error('Expected building04 ground floor page.');
  }

  const talkAction = groundFloorView.offeredActions.find((action) => action.id === 'talk_to_resident');

  if (!talkAction) {
    throw new Error('Expected talk to resident action.');
  }

  const afterTalkView = await runtimeApi.applySessionAction(groundFloorView.snapshot.sessionId, talkAction);

  if (!afterTalkView?.page || afterTalkView.page.kind !== 'page') {
    throw new Error('Expected page after starting resident conversation.');
  }

  assert.notEqual(
    ((afterTalkView.snapshot.sessionState.story as Record<string, Record<string, unknown>> | undefined)?.resident_01?.dialog_topic),
    'idle',
  );

  const titleView = await runtimeApi.createSession('demo04');

  if (!titleView?.page || titleView.page.kind !== 'page') {
    throw new Error('Expected title screen page.');
  }

  const continueAction = titleView.page.actions.find((action) => action.id === 'title_screen_continue');

  if (!continueAction) {
    throw new Error('Expected continue action on demo04 title screen.');
  }

  const continuedView = await runtimeApi.applySessionAction(titleView.snapshot.sessionId, continueAction);

  if (!continuedView?.page || continuedView.page.kind !== 'page') {
    throw new Error('Expected continued page.');
  }

  assert.equal(continuedView.page.nodeId, 'building04_groundfloor');
  assert.equal(
    ((continuedView.snapshot.sessionState.story as Record<string, Record<string, unknown>> | undefined)?.resident_01?.dialog_topic),
    'idle',
  );
  assert.equal(
    continuedView.offeredActions.some((action) => action.id === 'talk_to_resident'),
    true,
  );
});