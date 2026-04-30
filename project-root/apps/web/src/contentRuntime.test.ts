import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { createContentRuntime, createRuntimeForContentFiles } from './contentRuntimeCore';
import { findMatchingShortcut } from './keyboardShortcuts';
import { buildProjectedPageRenderKey, createStableProjectedPageResolver } from './pageSelection';
import { appendLogEntry, createRecentLogEntries } from './recentLog';
import { resolveProjectClockSnapshot } from './runtimeClock';

const projectRoot = resolve(__dirname, '..', '..', '..');
const contentFiles = createTestFixtureProjectFiles();
const allProjectFiles = {
  ...loadProjectFiles('demo'),
  ...contentFiles,
};

const runtime = createRuntimeForContentFiles(contentFiles);
const project = runtime.test01;

function createTestFixtureProjectFiles(): Record<string, string> {
  return {
    '../../../packages/content/test01/test01_entry.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: test01_entry
displayName: Test Entry
region: test_region

exits:
  - id: test01_gate
    targetId: test01_gate
    displayName: Take The Road
    key: 1
---

# Test Entry

## enter
The fixture begins here.
`,
    '../../../packages/content/test01/test01_gate.md': `---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: test01_gate
displayName: Test Gate Forward
region: test_region

presentationMode: passthrough

endpoints:
  forward:
    from: test01_entry
    to: test01_path
  backward:
    from: test01_path
    to: test01_entry
---

# Test Gate Forward
`,
    '../../../packages/content/test01/test01_path.md': `---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: test01_path
displayName: Test Path
region: test_region

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open
  backward: open

endpoints:
  forward:
    from: test01_gate
    to: test02_gate
  backward:
    from: test02_gate
    to: test01_gate
---

# Test Path

## flow:first_visit:forward

### beat
This path file was discovered from the test01 folder.

### beat
The maintained road leads the way forward.

## flow:first_visit:backward

### beat
You return along the road.

### beat
The entry waits behind the passthrough gate.

## flow:repeat:forward

### beat
You go forward.

## flow:repeat:backward

### beat
You go back.
`,
    '../../../packages/content/test01/test02_gate.md': `---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: test02_gate
displayName: Test Gate Return
region: test_region

presentationMode: passthrough

endpoints:
  forward:
    from: test02_entry
    to: test01_path
  backward:
    from: test01_path
    to: test02_entry
---

# Test Gate Return
`,
    '../../../packages/content/test01/test02_entry.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: test02_entry
displayName: Test Return
region: test_region

exits:
  - id: test02_gate
    targetId: test02_gate
    displayName: Return To The Road
    key: X
---

# Test Return

## enter
The fixture returns here.
`,
  };
}

function loadProjectFiles(projectId: string): Record<string, string> {
  const projectDir = resolve(projectRoot, 'packages/content', projectId);

  return Object.fromEntries(
    collectProjectFiles(projectDir).map((filePath) => [
      `../../../packages/content/${projectId}/${relative(projectDir, filePath).replace(/\\/g, '/')}`,
      readFileSync(filePath, 'utf8'),
    ]),
  );
}

function collectProjectFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return collectProjectFiles(entryPath);
    }

    return entry.isFile() && /\.(md|ya?ml)$/i.test(entry.name) ? [entryPath] : [];
  });
}

test('test01 round-trip traversal resolves backward path movement toward area01', () => {
  assert.equal(project?.startNodeId, 'test01_entry');
  assert.equal(project?.pagesByNodeId.test01_entry?.kind, 'page');
  assert.equal(project?.pagesByNodeId.test01_path?.kind, 'page');
});

test('runtime discovery builds playable demo and test01 projects from markdown files', () => {
  const discoveredRuntime = createRuntimeForContentFiles(allProjectFiles);

  assert.deepEqual(Object.keys(discoveredRuntime).sort(), ['demo', 'test01']);
  assert.equal(discoveredRuntime.demo?.startNodeId, 'title_screen');
  assert.equal(discoveredRuntime.test01?.startNodeId, 'test01_entry');
  assert.equal(discoveredRuntime.demo?.nodes.length, 33);
  assert.equal(discoveredRuntime.test01?.nodes.length, 5);
  assert.equal(Object.keys(discoveredRuntime.demo?.pagesByNodeId ?? {}).length, 33);
  assert.equal(Object.keys(discoveredRuntime.test01?.pagesByNodeId ?? {}).length, 5);
});

test('runtime discovery can load the authored PrototypeHub project from disk', () => {
  const prototypeRuntime = createRuntimeForContentFiles(loadProjectFiles('PrototypeHub'));

  assert.equal(prototypeRuntime.PrototypeHub?.startNodeId, 'title_screen');
  assert.equal(prototypeRuntime.PrototypeHub?.nodes.length, 4);
  assert.equal(Object.keys(prototypeRuntime.PrototypeHub?.pagesByNodeId ?? {}).length, 4);

  const gatePage = prototypeRuntime.PrototypeHub?.pagesByNodeId.outside_lobbygate;
  const lobbyPage = prototypeRuntime.PrototypeHub?.pagesByNodeId.lobby_area;

  assert.equal(gatePage?.kind, 'page');
  assert.equal(lobbyPage?.kind, 'page');
  assert.equal(
    lobbyPage?.kind === 'page' && lobbyPage.actions.some((action) => action.id === 'prototypehub_lobby_jukebox' && action.kind === 'poi'),
    true,
  );
});

test('runtime node links prefer authored display names', () => {
  const fixtureRuntime = createRuntimeForContentFiles(contentFiles);

  assert.equal(
    fixtureRuntime.test01?.nodes.find((node) => node.id === 'test01_path')?.label,
    'Test Path',
  );
  assert.equal(
    fixtureRuntime.test01?.nodes.find((node) => node.id === 'test01_gate')?.label,
    'Test Gate Forward',
  );
});

test('runtime surfaces title screen save mode from authored title screen markdown', () => {
  const runtimeWithTitleScreenConfig = createRuntimeForContentFiles({
    '../../../packages/content/titlecfg/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: system

titleScreen:
  saveMode: single

exits:
  - id: start
    targetId: room_01
    displayName: Start
---

# Title Screen

## enter
Title.
`,
    '../../../packages/content/titlecfg/room_01.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: room_01
displayName: Room 01
region: system
---

# Room 01

## enter
Room.
`,
    '../../../packages/content/titlecfg/good_ending.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: good_ending
displayName: Good Ending
region: system
tags:
  - ending

exits:
  - id: back_to_title
    targetId: title_screen
    displayName: Back To Title
---

# Good Ending

## enter
Done.
`,
    '../../../packages/content/titlecfg/room_to_ending.md': `---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: room_to_ending
displayName: Room To Ending
region: system

presentationMode: passthrough

endpoints:
  forward:
    from: room_01
    to: good_ending
  backward:
    from: good_ending
    to: room_01
---

# Room To Ending
`,
  }, { validateProjects: true });

  assert.equal(runtimeWithTitleScreenConfig.titlecfg?.titleScreen?.saveMode, 'single');
});

test('runtime surfaces per-project time settings from authored settings sidecar', () => {
  const runtimeWithTimeSettings = createRuntimeForContentFiles({
    '../../../packages/content/timecfg/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: system

exits:
  - id: start
    targetId: room_01
    displayName: Start
---

# Title Screen

## enter
Title.
`,
    '../../../packages/content/timecfg/room_01.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: room_01
displayName: Room 01
region: system
---

# Room 01

## enter
Room.
`,
    '../../../packages/content/timecfg/good_ending.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: good_ending
displayName: Good Ending
region: system
tags:
  - ending

exits:
  - id: back_to_title
    targetId: title_screen
    displayName: Back To Title
---

# Good Ending

## enter
Done.
`,
    '../../../packages/content/timecfg/room_to_ending.md': `---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: room_to_ending
displayName: Room To Ending
region: system

presentationMode: passthrough

endpoints:
  forward:
    from: room_01
    to: good_ending
  backward:
    from: good_ending
    to: room_01
---

# Room To Ending
`,
    '../../../packages/content/timecfg/settings/time.yaml': `calendars:
  default_world:
    preset: earth_like_4phase
    minutesPerPhase: 60
    phases:
      - id: day
        groups:
          - daylike
        statusText:
          - The station day cycle is in full swing.

  moon_colony:
    preset: custom
    phases:
      - id: silver_dawn
        durationMinutes: 180
      - id: long_glow
        durationMinutes: 600

assignments:
  defaultCalendar: default_world
  regions:
    system: default_world
  nodes:
    room_01: moon_colony

schedules:
  streetlamps_at_dusk:
    description: Turn the north sidewalk streetlamps on at dusk.
    trigger:
      kind: phase
      phaseId: dusk
      edge: enter
    repeat:
      everyMinutes: 6
    target:
      nodes:
        - sidewalk_north
      tags:
        - streetlight
    actor:
      - One by one, the streetlamps along the curb flick on.
    lane: recent
    effects:
      - set: [objects.streetlamps.on, true]

  counter_mint_refill:
    description: Refill the sample bowl when day comes around again after a day pickup.
    trigger:
      kind: phase
      phaseId: day
      edge: enter
    when:
      predicate: mint_taken_in_day
    target:
      nodes:
        - room_01
    effects:
      - set: [objects.building02_counter_mint.available, true]

  morning_paper_window:
    description: Drop a paper at dawn and clear it later in the morning.
    trigger:
      kind: phase
      phaseGroup: dawnlike
      edge: enter
    activeWindow:
      stop:
        kind: phase
        phaseId: day
        edge: enter
    target:
      folders:
        - diorama/building04
    effects:
      - set: [objects.building04_morning_paper.available, true]

visibility:
  defaultRecentLog: false
  folders:
    station: true
  nodes:
    sidewalk_north: true
`,
  }, { validateProjects: true });

  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.calendars?.default_world?.preset, 'earth_like_4phase');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.calendars?.default_world?.minutesPerPhase, 60);
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.calendars?.default_world?.phases?.[0]?.groups?.[0], 'daylike');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.calendars?.default_world?.phases?.[0]?.statusText?.[0], 'The station day cycle is in full swing.');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.calendars?.moon_colony?.phases?.[0]?.id, 'silver_dawn');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.assignments?.defaultCalendar, 'default_world');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.assignments?.nodes?.room_01, 'moon_colony');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.schedules?.streetlamps_at_dusk?.trigger.phaseId, 'dusk');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.schedules?.streetlamps_at_dusk?.target?.tags?.[0], 'streetlight');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.schedules?.counter_mint_refill?.trigger.kind, 'phase');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.schedules?.counter_mint_refill?.trigger.phaseId, 'day');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.schedules?.counter_mint_refill?.when?.predicate, 'mint_taken_in_day');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.schedules?.morning_paper_window?.activeWindow?.stop?.phaseId, 'day');
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.visibility?.folders?.station, true);
  assert.equal(runtimeWithTimeSettings.timecfg?.timeSettings?.visibility?.nodes?.sidewalk_north, true);
});

test('demo04 time settings can assign an example subtree calendar by source-path inheritance', () => {
  const runtimeWithDemo04 = createRuntimeForContentFiles(loadProjectFiles('demo04'));
  const project = runtimeWithDemo04.demo04;

  assert.equal(project?.timeSettings?.assignments?.folders?.diorama, 'diorama_block');
  assert.equal(project?.timeSettings?.assignments?.folders?.['diorama/block/building'], 'interior_longform');

  const building01Snapshot = project
    ? resolveProjectClockSnapshot({
      projectId: 'demo04',
      timeSettings: project.timeSettings,
      defaultClock: project.defaultClock,
      nodeFoldersById: project.nodeFoldersById,
      nodeRegionsById: project.nodeRegionsById,
    }, 0, undefined, 'building01_groundfloor')
    : undefined;
  const building04Snapshot = project
    ? resolveProjectClockSnapshot({
      projectId: 'demo04',
      timeSettings: project.timeSettings,
      defaultClock: project.defaultClock,
      nodeFoldersById: project.nodeFoldersById,
      nodeRegionsById: project.nodeRegionsById,
    }, 0, undefined, 'building04_groundfloor')
    : undefined;
  const sidewalkSnapshot = project
    ? resolveProjectClockSnapshot({
      projectId: 'demo04',
      timeSettings: project.timeSettings,
      defaultClock: project.defaultClock,
      nodeFoldersById: project.nodeFoldersById,
      nodeRegionsById: project.nodeRegionsById,
    }, 0, undefined, 'sidewalk_north')
    : undefined;

  assert.equal(building01Snapshot?.calendarId, 'interior_longform');
  assert.equal(building01Snapshot?.phase, 'day');
  assert.equal(building01Snapshot?.nextPhaseInMs, 120_000);
  assert.equal(building04Snapshot?.calendarId, 'interior_longform');
  assert.equal(building04Snapshot?.phase, 'day');
  assert.equal(building04Snapshot?.nextPhaseInMs, 120_000);
  assert.equal(sidewalkSnapshot?.calendarId, 'diorama_block');
  assert.equal(sidewalkSnapshot?.phase, 'day');
  assert.equal(sidewalkSnapshot?.nextPhaseInMs, 120_000);
});

test('playable demos surface single-save title screen config from authored markdown', () => {
  const runtimeWithPlayableDemos = createRuntimeForContentFiles({
    ...loadProjectFiles('demo'),
    ...loadProjectFiles('demo02'),
    ...loadProjectFiles('demo03'),
    ...loadProjectFiles('demo04'),
  }, { validateProjects: true });

  assert.equal(runtimeWithPlayableDemos.demo?.titleScreen?.saveMode, 'single');
  assert.equal(runtimeWithPlayableDemos.demo02?.titleScreen?.saveMode, 'single');
  assert.equal(runtimeWithPlayableDemos.demo03?.titleScreen?.saveMode, 'single');
  assert.equal(runtimeWithPlayableDemos.demo04?.titleScreen?.saveMode, 'single');
});

test('demo nested fixture traversal resolves through passthrough gate path gate chain from subfolder content', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo'));
  const shackRunPage = demoRuntime.getProjectedPage('demo', 'shack_run2');

  assert.equal(shackRunPage?.kind, 'page');

  if (!shackRunPage || shackRunPage.kind !== 'page') {
    throw new Error('Expected a page for shack_run2.');
  }

  const fixtureBranch = shackRunPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'demo_fixture_entry',
  );

  assert.ok(fixtureBranch);

  const fixtureBranchOutcome = demoRuntime.resolveProjectAction('demo', 'shack_run2', fixtureBranch!);

  assert.equal(fixtureBranchOutcome.nextNodeId, 'demo_fixture_entry');
  assert.equal(fixtureBranchOutcome.nextPathDirection, undefined);

  const entryPage = demoRuntime.getProjectedPage('demo', 'demo_fixture_entry');

  assert.equal(entryPage?.kind, 'page');

  if (!entryPage || entryPage.kind !== 'page') {
    throw new Error('Expected a page for demo_fixture_entry.');
  }

  const nestedExit = entryPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'demo_fixture_entry_gate',
  );

  assert.ok(nestedExit);

  const intoPath = demoRuntime.resolveProjectAction('demo', 'demo_fixture_entry', nestedExit!);

  assert.equal(intoPath.nextNodeId, 'demo_fixture_path');
  assert.equal(intoPath.nextPathDirection, 'forward');

  const forwardPathPage = demoRuntime.getProjectedPage('demo', 'demo_fixture_path', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(forwardPathPage?.kind, 'page');

  if (!forwardPathPage || forwardPathPage.kind !== 'page') {
    throw new Error('Expected a page for demo_fixture_path.');
  }

  assert.deepEqual(forwardPathPage.proseBlocks.map((block) => block.text), [
    'The nested walkway proves the runtime can discover content below the project root.',
  ]);

  const forwardArrival = demoRuntime.resolveProjectControl('demo', 'demo_fixture_path', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 1 });

  assert.equal(forwardArrival.nextNodeId, 'demo_fixture_destination');
  assert.equal(forwardArrival.nextPathDirection, undefined);

  const destinationPage = demoRuntime.getProjectedPage('demo', 'demo_fixture_destination');

  assert.equal(destinationPage?.kind, 'page');

  if (!destinationPage || destinationPage.kind !== 'page') {
    throw new Error('Expected a page for demo_fixture_destination.');
  }

  const returnExit = destinationPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'demo_fixture_exit_gate',
  );

  assert.ok(returnExit);

  const backIntoPath = demoRuntime.resolveProjectAction('demo', 'demo_fixture_destination', returnExit!);

  assert.equal(backIntoPath.nextNodeId, 'demo_fixture_path');
  assert.equal(backIntoPath.nextPathDirection, 'backward');

  const backwardArrival = demoRuntime.resolveProjectControl('demo', 'demo_fixture_path', 'backward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 2, pathBeatIndex: 0 });

  assert.equal(backwardArrival.nextNodeId, 'demo_fixture_entry');
  assert.equal(backwardArrival.nextPathDirection, undefined);
});

test('demo title screen starts the project and continues into sunbleached tree through a passthrough gate', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo'));
  const titlePage = demoRuntime.getProjectedPage('demo', 'title_screen');

  assert.equal(titlePage?.kind, 'page');

  if (!titlePage || titlePage.kind !== 'page') {
    throw new Error('Expected a page for title_screen.');
  }

  const continueAction = titlePage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'titlescreen_sunbleachedtree',
  );

  assert.ok(continueAction);

  const outcome = demoRuntime.resolveProjectAction('demo', 'title_screen', continueAction!);

  assert.equal(outcome.nextNodeId, 'sunbleached_tree');
  assert.equal(outcome.nextPathDirection, undefined);
});

test('demo area exit routes through a passthrough gate before landing on the path', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo'));
  const entryPage = demoRuntime.getProjectedPage('demo', 'sunbleached_tree');

  assert.equal(entryPage?.kind, 'page');

  if (!entryPage || entryPage.kind !== 'page') {
    throw new Error('Expected a page for sunbleached_tree.');
  }

  const treeRoadExit = entryPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'sunbleachedtree_oldharboredgeroad',
  );

  assert.ok(treeRoadExit);

  const intoPath = demoRuntime.resolveProjectAction('demo', 'sunbleached_tree', treeRoadExit!);

  assert.equal(intoPath.nextNodeId, 'old_harbor_edge_road');
  assert.equal(intoPath.nextPathDirection, 'forward');

  const pathPage = demoRuntime.getProjectedPage('demo', 'old_harbor_edge_road', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(pathPage?.kind, 'page');

  if (!pathPage || pathPage.kind !== 'page') {
    throw new Error('Expected a page for old_harbor_edge_road.');
  }

  assert.deepEqual(pathPage.proseBlocks.map((block) => block.text), ['*Hahahaha!*']);
  assert.deepEqual(pathPage.controls.map((control) => control.kind), ['continue', 'back']);

  const forwardArrival = demoRuntime.resolveProjectControl('demo', 'old_harbor_edge_road', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 0 });

  assert.equal(forwardArrival.nextNodeId, 'shack_run1');
  assert.equal(forwardArrival.nextPathDirection, undefined);
  assert.equal(forwardArrival.nextPathBeatIndex, undefined);
});

test('demo shack run 2 exposes a gate whose blocked state is authored separately from one-way routing', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo'));
  const shackRunPage = demoRuntime.getProjectedPage('demo', 'shack_run2');

  assert.equal(shackRunPage?.kind, 'page');

  if (!shackRunPage || shackRunPage.kind !== 'page') {
    throw new Error('Expected a page for shack_run2.');
  }

  const shopExit = shackRunPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'dilapidated_shop',
  );

  assert.ok(shopExit);

  const shopOutcome = demoRuntime.resolveProjectAction('demo', 'shack_run2', shopExit!);

  assert.equal(shopOutcome.nextNodeId, 'dilapidated_shop');
  assert.equal(shopOutcome.nextPathDirection, 'forward');

  const shopPage = demoRuntime.getProjectedPage('demo', 'dilapidated_shop', 'forward', {
    areaVisitCount: 1,
  });

  assert.equal(shopPage?.kind, 'page');

  if (!shopPage || shopPage.kind !== 'page') {
    throw new Error('Expected a page for dilapidated_shop.');
  }

  assert.deepEqual(shopPage.proseBlocks.map((block) => block.text), [
    'The shack looks too small to matter and too stubborn to finish collapsing.',
    'The door is shut, swollen with damp, but not locked.',
  ]);
  assert.deepEqual(shopPage.actions.map((action) => action.kind), ['choice', 'exit']);
  assert.deepEqual(shopPage.actions.map((action) => action.label), ['Try the Latch', '[delay: medium] Open the Door']);
  assert.deepEqual(shopPage.controls.map((control) => control.kind), ['back']);
});

test('demo empty shack prototype opens from shack run 2 into a lit shack and can close into a dark variant', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo'));
  const shackRunPage = demoRuntime.getProjectedPage('demo', 'shack_run2');

  assert.equal(shackRunPage?.kind, 'page');

  if (!shackRunPage || shackRunPage.kind !== 'page') {
    throw new Error('Expected a page for shack_run2.');
  }

  const shackExit = shackRunPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'dilapidated_shop',
  );

  assert.ok(shackExit);

  const closedDoorOutcome = demoRuntime.resolveProjectAction('demo', 'shack_run2', shackExit!);

  assert.equal(closedDoorOutcome.nextNodeId, 'dilapidated_shop');
  assert.equal(closedDoorOutcome.nextPathDirection, 'forward');

  const closedDoorPage = demoRuntime.getProjectedPage('demo', 'dilapidated_shop', 'forward', {
    areaVisitCount: 1,
  });

  assert.equal(closedDoorPage?.kind, 'page');

  if (!closedDoorPage || closedDoorPage.kind !== 'page') {
    throw new Error('Expected a page for dilapidated_shop.');
  }

  const openDoorAction = closedDoorPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'dilapidated_shop_open',
  );

  assert.ok(openDoorAction);

  const openDoorOutcome = demoRuntime.resolveProjectAction('demo', 'dilapidated_shop', openDoorAction!, {
    direction: 'forward',
  });

  assert.equal(openDoorOutcome.nextNodeId, 'dilapidated_shop_open');
  assert.equal(openDoorOutcome.nextPathDirection, 'forward');

  const openDoorPage = demoRuntime.getProjectedPage('demo', 'dilapidated_shop_open', 'forward', {
    areaVisitCount: 1,
  });

  assert.equal(openDoorPage?.kind, 'page');

  if (!openDoorPage || openDoorPage.kind !== 'page') {
    throw new Error('Expected a page for dilapidated_shop_open.');
  }

  assert.deepEqual(openDoorPage.controls.map((control) => control.kind), ['continue', 'back']);

  const intoShackOutcome = demoRuntime.resolveProjectControl('demo', 'dilapidated_shop_open', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { areaVisitCount: 1 });

  assert.equal(intoShackOutcome.nextNodeId, 'empty_shack');

  const emptyShackPage = demoRuntime.getProjectedPage('demo', 'empty_shack', undefined, {
    areaVisitCount: 1,
  });

  assert.equal(emptyShackPage?.kind, 'page');

  if (!emptyShackPage || emptyShackPage.kind !== 'page') {
    throw new Error('Expected a page for empty_shack.');
  }

  const closeDoorAction = emptyShackPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'empty_shack_dark',
  );

  assert.ok(closeDoorAction);

  const darkShackOutcome = demoRuntime.resolveProjectAction('demo', 'empty_shack', closeDoorAction!);

  assert.equal(darkShackOutcome.nextNodeId, 'empty_shack_dark');

  const darkShackPage = demoRuntime.getProjectedPage('demo', 'empty_shack_dark', undefined, {
    areaVisitCount: 1,
  });

  assert.equal(darkShackPage?.kind, 'page');

  if (!darkShackPage || darkShackPage.kind !== 'page') {
    throw new Error('Expected a page for empty_shack_dark.');
  }

  assert.deepEqual(darkShackPage.proseBlocks.map((block) => block.text), [
    'The door thumps shut.',
    'The shack goes black enough that the walls seem farther away than they are.',
  ]);
});

test('visible gates surface first-visit prose and preserve inline formatting', () => {
  const contentRuntime = createContentRuntime({
    '../../../packages/content/gate-visits/start_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: start_area
displayName: Start Area
region: test_region

exits:
  - id: toward_gate
    targetId: visit_gate
    displayName: Toward the gate
    key: G
---

# Start Area
`,
    '../../../packages/content/gate-visits/visit_gate.md': `---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: visit_gate
displayName: Visit Gate
region: test_region

presentation:
  forward: billboard
  backward: billboard
---

# Visit Gate

## enter
The threshold leans under old paint.

---

## first_visit
You notice the *fresh scratches* around the lock.

---

## repeat_visit
The scratches still catch the light.
`,
  });

  const firstPage = contentRuntime.getProjectedPage('gate-visits', 'visit_gate', undefined, {
    areaVisitCount: 1,
  });

  assert.equal(firstPage?.kind, 'page');

  if (!firstPage || firstPage.kind !== 'page') {
    throw new Error('Expected a page for visit_gate.');
  }

  assert.deepEqual(firstPage.proseBlocks.map((block) => block.text), [
    'You notice the *fresh scratches* around the lock.',
    'The threshold leans under old paint.',
  ]);

  const repeatPage = contentRuntime.getProjectedPage('gate-visits', 'visit_gate', undefined, {
    areaVisitCount: 2,
  });

  assert.equal(repeatPage?.kind, 'page');

  if (!repeatPage || repeatPage.kind !== 'page') {
    throw new Error('Expected a repeat page for visit_gate.');
  }

  assert.deepEqual(repeatPage.proseBlocks.map((block) => block.text), [
    'The scratches still catch the light.',
    'The threshold leans under old paint.',
  ]);
});

test('blocked passthrough gates stop on the gate page while open reverse travel still resolves through them', () => {
  const contentRuntime = createContentRuntime({
    '../../../packages/content/blocked-gate/start_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: start_area
displayName: Start Area
region: test_region

exits:
  - id: toward_gate
    targetId: blocked_gate
    displayName: Toward the blocked threshold
    key: B
---

# Start Area
`,
    '../../../packages/content/blocked-gate/end_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: end_area
displayName: End Area
region: test_region

exits:
  - id: back_to_gate
    targetId: blocked_gate
    displayName: Head back through the threshold
    key: R
---

# End Area
`,
    '../../../packages/content/blocked-gate/blocked_gate.md': `---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: blocked_gate
displayName: Blocked Threshold
region: test_region

presentation:
  forward: passthrough
  backward: passthrough

blocking:
  forward: blocked
  backward: open

endpoints:
  forward:
    from: start_area
    to: end_area
  backward:
    from: end_area
    to: start_area
---

# Blocked Threshold

## blocked:forward
The threshold is jammed with crates.
`,
  });

  const startPage = contentRuntime.getProjectedPage('blocked-gate', 'start_area');

  assert.equal(startPage?.kind, 'page');

  if (!startPage || startPage.kind !== 'page') {
    throw new Error('Expected a page for start_area.');
  }

  const intoGateAction = startPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'blocked_gate');

  assert.ok(intoGateAction);

  const intoGate = contentRuntime.resolveProjectAction('blocked-gate', 'start_area', intoGateAction!);

  assert.equal(intoGate.nextNodeId, 'blocked_gate');
  assert.equal(intoGate.nextPathDirection, 'forward');

  const blockedGatePage = contentRuntime.getProjectedPage('blocked-gate', 'blocked_gate', 'forward');

  assert.equal(blockedGatePage?.kind, 'page');

  if (!blockedGatePage || blockedGatePage.kind !== 'page') {
    throw new Error('Expected a page for blocked_gate.');
  }

  assert.deepEqual(blockedGatePage.proseBlocks.map((block) => block.text), ['The threshold is jammed with crates.']);
  assert.deepEqual(blockedGatePage.actions.map((action) => action.kind), []);
  assert.deepEqual(blockedGatePage.controls.map((control) => control.kind), ['back']);

  const endPage = contentRuntime.getProjectedPage('blocked-gate', 'end_area');

  assert.equal(endPage?.kind, 'page');

  if (!endPage || endPage.kind !== 'page') {
    throw new Error('Expected a page for end_area.');
  }

  const backToGateAction = endPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'blocked_gate');

  assert.ok(backToGateAction);

  const backThroughGate = contentRuntime.resolveProjectAction('blocked-gate', 'end_area', backToGateAction!);

  assert.equal(backThroughGate.nextNodeId, 'start_area');
  assert.equal(backThroughGate.nextPathDirection, undefined);
});

test('demo shack run 2 can route through a passthrough gate into a blocked dead-end area and show the threshold backside on the way out', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo'));
  const shackRunPage = demoRuntime.getProjectedPage('demo', 'shack_run2');

  assert.equal(shackRunPage?.kind, 'page');

  if (!shackRunPage || shackRunPage.kind !== 'page') {
    throw new Error('Expected a page for shack_run2.');
  }

  const junkExit = shackRunPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'shackrun2_junkchoke',
  );

  assert.ok(junkExit);

  const junkOutcome = demoRuntime.resolveProjectAction('demo', 'shack_run2', junkExit!);

  assert.equal(junkOutcome.nextNodeId, 'junk_choke');
  assert.equal(junkOutcome.nextPathDirection, undefined);

  const junkPage = demoRuntime.getProjectedPage('demo', 'junk_choke');

  assert.equal(junkPage?.kind, 'page');

  if (!junkPage || junkPage.kind !== 'page') {
    throw new Error('Expected a page for junk_choke.');
  }

  assert.deepEqual(junkPage.actions.map((action) => action.targetId), ['shackrun2_junkchoke']);
  assert.deepEqual(junkPage.controls.map((control) => control.kind), []);

  const returnOutcome = demoRuntime.resolveProjectAction('demo', 'junk_choke', junkPage.actions[0]!);

  assert.equal(returnOutcome.nextNodeId, 'shackrun2_junkchoke');
  assert.equal(returnOutcome.nextPathDirection, 'backward');

  const returnGatePage = demoRuntime.getProjectedPage('demo', 'shackrun2_junkchoke', 'backward');

  assert.equal(returnGatePage?.kind, 'page');

  if (!returnGatePage || returnGatePage.kind !== 'page') {
    throw new Error('Expected a page for shackrun2_junkchoke.');
  }

  assert.deepEqual(returnGatePage.proseBlocks.map((block) => block.text), [
    'The threshold back toward Shack Run is all tilted carts, burst crates, and bent scrap catching at your ankles.',
    'You have to step high over the broken spill and pick your footing carefully before the lane opens back out.',
  ]);
  assert.deepEqual(returnGatePage.controls.map((control) => control.kind), ['continue', 'back']);

  const continueOutcome = demoRuntime.resolveProjectControl('demo', 'shackrun2_junkchoke', 'backward', {
    kind: 'continue',
    label: 'Continue',
  });

  assert.equal(continueOutcome.nextNodeId, 'shack_run2');
  assert.equal(continueOutcome.nextPathDirection, undefined);
});

test('demo harbor edge road uses flow:block:forward and stops traversal at the obstruction', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo'));
  const shackRunPage = demoRuntime.getProjectedPage('demo', 'shack_run2');

  assert.equal(shackRunPage?.kind, 'page');

  if (!shackRunPage || shackRunPage.kind !== 'page') {
    throw new Error('Expected a page for shack_run2.');
  }

  const harborRoadExit = shackRunPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'shackrun2_harboredgeroad',
  );

  assert.ok(harborRoadExit);

  const intoHarborRoad = demoRuntime.resolveProjectAction('demo', 'shack_run2', harborRoadExit!);

  assert.equal(intoHarborRoad.nextNodeId, 'harbor_edge_road');
  assert.equal(intoHarborRoad.nextPathDirection, 'forward');

  const firstBlockedBeat = demoRuntime.getProjectedPage('demo', 'harbor_edge_road', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(firstBlockedBeat?.kind, 'page');

  if (!firstBlockedBeat || firstBlockedBeat.kind !== 'page') {
    throw new Error('Expected a page for harbor_edge_road.');
  }

  assert.deepEqual(firstBlockedBeat.proseBlocks.map((block) => block.text), [
    'A storm-felled pine is sprawled across the road into town.',
  ]);
  assert.deepEqual(firstBlockedBeat.controls.map((control) => control.kind), ['continue', 'back']);

  const secondBlockedBeat = demoRuntime.resolveProjectControl('demo', 'harbor_edge_road', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 0 });

  assert.equal(secondBlockedBeat.nextNodeId, 'harbor_edge_road');
  assert.equal(secondBlockedBeat.nextPathBeatIndex, 1);

  const thirdBlockedBeat = demoRuntime.resolveProjectControl('demo', 'harbor_edge_road', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 1 });

  assert.equal(thirdBlockedBeat.nextNodeId, 'harbor_edge_road');
  assert.equal(thirdBlockedBeat.nextPathBeatIndex, 2);

  const finalBlockedBeat = demoRuntime.getProjectedPage('demo', 'harbor_edge_road', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 2,
  });

  assert.equal(finalBlockedBeat?.kind, 'page');

  if (!finalBlockedBeat || finalBlockedBeat.kind !== 'page') {
    throw new Error('Expected a final blocked page for harbor_edge_road.');
  }

  assert.deepEqual(finalBlockedBeat.controls.map((control) => control.kind), ['back']);

  const blockedContinue = demoRuntime.resolveProjectControl('demo', 'harbor_edge_road', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 2 });

  assert.equal(blockedContinue.nextNodeId, undefined);
  assert.equal(blockedContinue.nextPathDirection, undefined);
});

test('visible gates surface POI actions and resolve local gate prose plus choices', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo'));
  const gatePage = demoRuntime.getProjectedPage('demo', 'fish_shop_front');

  assert.equal(gatePage?.kind, 'page');

  if (!gatePage || gatePage.kind !== 'page') {
    throw new Error('Expected a page for fish_shop_front.');
  }

  const doorknockAction = gatePage.actions.find((action) => action.kind === 'poi' && action.id === 'doorknock');
  const waitAction = gatePage.actions.find((action) => action.kind === 'choice' && action.id === 'wait');

  assert.ok(doorknockAction);
  assert.ok(waitAction);

  const doorknockOutcome = demoRuntime.resolveProjectAction('demo', 'fish_shop_front', doorknockAction!);
  const waitOutcome = demoRuntime.resolveProjectAction('demo', 'fish_shop_front', waitAction!);

  assert.equal(doorknockOutcome.logEntry?.text, 'Closed.\n\nPermanently.');
  assert.deepEqual(doorknockOutcome.logEntry?.markers, [{ kind: 'delay', value: 'long' }]);
  assert.deepEqual(doorknockOutcome.logEntry?.blocks, [
    {
      kind: 'paragraph',
      text: 'Closed.',
      markers: undefined,
    },
    {
      kind: 'paragraph',
      text: 'Permanently.',
      markers: [{ kind: 'delay', value: 'long' }],
    },
  ]);
  assert.equal(waitOutcome.logEntry?.text, 'No point waiting around.');
});

test('demo02 closed gate back control returns to the attached area when endpoints are missing', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo02'));
  const gatePage = demoRuntime.getProjectedPage('demo02', 'fish_shop_front');

  assert.equal(gatePage?.kind, 'page');

  if (!gatePage || gatePage.kind !== 'page') {
    throw new Error('Expected a page for demo02 fish_shop_front.');
  }

  const backControl = gatePage.controls.find((control) => control.kind === 'back');

  assert.ok(backControl);

  const backOutcome = demoRuntime.resolveProjectControl('demo02', 'fish_shop_front', undefined, backControl!);

  assert.equal(backOutcome.nextNodeId, 'shack_run1');
  assert.equal(backOutcome.nextPathDirection, undefined);
  assert.equal(backOutcome.logEntry?.text, 'You step back.');
});

test('demo02 old harbor edge road back returns to the previous area', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo02'));
  const oldHarborRoadPage = demoRuntime.getProjectedPage('demo02', 'old_harbor_edge_road', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(oldHarborRoadPage?.kind, 'page');

  if (!oldHarborRoadPage || oldHarborRoadPage.kind !== 'page') {
    throw new Error('Expected a page for demo02 old_harbor_edge_road.');
  }

  const backControl = oldHarborRoadPage.controls.find((control) => control.kind === 'back');

  assert.ok(backControl);

  const backOutcome = demoRuntime.resolveProjectControl('demo02', 'old_harbor_edge_road', 'forward', backControl!, {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(backOutcome.nextNodeId, 'sunbleached_tree');
  assert.equal(backOutcome.nextPathDirection, undefined);
  assert.equal(backOutcome.logEntry?.text, 'You turn back.');
});

test('demo02 harbor edge road back returns toward shack run during the blocked approach', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo02'));
  const harborRoadPage = demoRuntime.getProjectedPage('demo02', 'harbor_edge_road', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(harborRoadPage?.kind, 'page');

  if (!harborRoadPage || harborRoadPage.kind !== 'page') {
    throw new Error('Expected a page for demo02 harbor_edge_road.');
  }

  const backControl = harborRoadPage.controls.find((control) => control.kind === 'back');

  assert.ok(backControl);

  const backOutcome = demoRuntime.resolveProjectControl('demo02', 'harbor_edge_road', 'forward', backControl!, {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(backOutcome.nextNodeId, 'shack_run2');
  assert.equal(backOutcome.nextPathDirection, undefined);
  assert.equal(backOutcome.logEntry?.text, 'You turn back.');
});

test('demo02 short walk is a one-way ending path and hides the back control', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo02'));
  const shortWalkPage = demoRuntime.getProjectedPage('demo02', 'bad_ending_walk', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(shortWalkPage?.kind, 'page');

  if (!shortWalkPage || shortWalkPage.kind !== 'page') {
    throw new Error('Expected a page for demo02 bad_ending_walk.');
  }

  assert.deepEqual(shortWalkPage.controls.map((control) => control.kind), ['continue', 'skip']);
});

test('demo02 bad ending path still reaches the ending area after the final beat', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo02'));

  const endingOutcome = demoRuntime.resolveProjectControl('demo02', 'bad_ending_walk', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, {
    pathVisitCount: 1,
    pathBeatIndex: 3,
  });

  assert.equal(endingOutcome.nextNodeId, 'game_over_bad');
  assert.equal(endingOutcome.nextPathDirection, undefined);

  const endingPage = demoRuntime.getProjectedPage('demo02', 'game_over_bad');

  assert.equal(endingPage?.kind, 'page');

  if (!endingPage || endingPage.kind !== 'page') {
    throw new Error('Expected a page for demo02 game_over_bad.');
  }

  assert.deepEqual(endingPage.proseBlocks.map((block) => block.text), [
    'The harbor keeps breathing without you.',
    'The porch knife was always real.',
    'So were the consequences.',
  ]);
  assert.ok(endingPage.actions.some((action) => action.kind === 'poi' && action.id === 'credits'));
  assert.ok(endingPage.actions.some((action) => action.kind === 'exit' && action.targetId === 'title_screen'));
});

test('demo shack run exposes bad and good ending routes through authored threshold sequences', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo'));
  const shackRunPage = demoRuntime.getProjectedPage('demo', 'shack_run1');

  assert.equal(shackRunPage?.kind, 'page');

  if (!shackRunPage || shackRunPage.kind !== 'page') {
    throw new Error('Expected a page for shack_run1.');
  }

  const badEndingExit = shackRunPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'shackrun1_badendingwalk',
  );
  const goodEndingExit = shackRunPage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'shackrun1_goodendingwalk',
  );

  assert.ok(badEndingExit);
  assert.ok(goodEndingExit);

  const badEndingOutcome = demoRuntime.resolveProjectAction('demo', 'shack_run1', badEndingExit!);

  assert.equal(badEndingOutcome.nextNodeId, 'shackrun1_badendingwalk');
  assert.equal(badEndingOutcome.nextPathDirection, undefined);

  const badEndingGatePage = demoRuntime.getProjectedPage('demo', 'shackrun1_badendingwalk');

  assert.equal(badEndingGatePage?.kind, 'page');

  if (!badEndingGatePage || badEndingGatePage.kind !== 'page') {
    throw new Error('Expected a page for shackrun1_badendingwalk.');
  }

  assert.deepEqual(badEndingGatePage.controls.map((control) => control.kind), []);

  const badEndingPathAction = badEndingGatePage.actions.find(
    (action) => action.kind === 'exit' && action.targetId === 'bad_ending_walk',
  );

  assert.ok(badEndingPathAction);

  const intoBadEndingPath = demoRuntime.resolveProjectAction('demo', 'shackrun1_badendingwalk', badEndingPathAction!);

  assert.equal(intoBadEndingPath.nextNodeId, 'bad_ending_walk');
  assert.equal(intoBadEndingPath.nextPathDirection, 'forward');

  const badEndingPathPage = demoRuntime.getProjectedPage('demo', 'bad_ending_walk', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(badEndingPathPage?.kind, 'page');

  if (!badEndingPathPage || badEndingPathPage.kind !== 'page') {
    throw new Error('Expected a page for bad_ending_walk.');
  }

  assert.deepEqual(badEndingPathPage.controls.map((control) => control.kind), ['continue', 'skip', 'back']);

  const badEndingSecondBeat = demoRuntime.resolveProjectControl('demo', 'bad_ending_walk', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 0 });

  assert.equal(badEndingSecondBeat.nextNodeId, 'bad_ending_walk');
  assert.equal(badEndingSecondBeat.nextPathDirection, 'forward');
  assert.equal(badEndingSecondBeat.nextPathBeatIndex, 1);

  const badEndingThirdBeat = demoRuntime.resolveProjectControl('demo', 'bad_ending_walk', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 1 });

  assert.equal(badEndingThirdBeat.nextNodeId, 'bad_ending_walk');
  assert.equal(badEndingThirdBeat.nextPathDirection, 'forward');
  assert.equal(badEndingThirdBeat.nextPathBeatIndex, 2);

  const badEndingGateArrival = demoRuntime.resolveProjectControl('demo', 'bad_ending_walk', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 2 });

  assert.equal(badEndingGateArrival.nextNodeId, 'game_over_bad');
  assert.equal(badEndingGateArrival.nextPathDirection, undefined);

  const intoEndingPath = demoRuntime.resolveProjectAction('demo', 'shack_run1', goodEndingExit!);

  assert.equal(intoEndingPath.nextNodeId, 'good_ending_walk');
  assert.equal(intoEndingPath.nextPathDirection, 'forward');

  const firstEndingBeat = demoRuntime.getProjectedPage('demo', 'good_ending_walk', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(firstEndingBeat?.kind, 'page');

  if (!firstEndingBeat || firstEndingBeat.kind !== 'page') {
    throw new Error('Expected a page for good_ending_walk.');
  }

  assert.deepEqual(firstEndingBeat.controls.map((control) => control.kind), ['continue', 'skip']);

  const secondEndingBeat = demoRuntime.resolveProjectControl('demo', 'good_ending_walk', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 0 });

  assert.equal(secondEndingBeat.nextNodeId, 'good_ending_walk');
  assert.equal(secondEndingBeat.nextPathBeatIndex, 1);

  const thirdEndingBeat = demoRuntime.resolveProjectControl('demo', 'good_ending_walk', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 1 });

  assert.equal(thirdEndingBeat.nextNodeId, 'good_ending_walk');
  assert.equal(thirdEndingBeat.nextPathBeatIndex, 2);

  const fourthEndingBeat = demoRuntime.resolveProjectControl('demo', 'good_ending_walk', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 2 });

  assert.equal(fourthEndingBeat.nextNodeId, 'good_ending_walk');
  assert.equal(fourthEndingBeat.nextPathBeatIndex, 3);

  const goodEndingOutcome = demoRuntime.resolveProjectControl('demo', 'good_ending_walk', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 3 });

  assert.equal(goodEndingOutcome.nextNodeId, 'game_over_good');
  assert.equal(goodEndingOutcome.nextPathDirection, undefined);

  const badEndingFinalArrival = demoRuntime.resolveProjectAction('demo', 'bad_ending_walk', {
    id: 'badendingwalk_gameoverbad',
    kind: 'exit',
    label: 'Bad Ending Threshold',
    targetId: 'badendingwalk_gameoverbad',
  } as never);

  assert.equal(badEndingFinalArrival.nextNodeId, 'game_over_bad');
  assert.equal(badEndingFinalArrival.nextPathDirection, undefined);
});

test('forward-only paths hide back and reject entry from the far side', () => {
  const contentRuntime = createContentRuntime({
    '../../../packages/content/oneway/start_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: start_area
displayName: Start Area
region: test_region

exits:
  - id: toward_one_way
    targetId: one_way_path
    displayName: Follow the one-way path
    key: O
---

# Start Area
`,
    '../../../packages/content/oneway/end_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: end_area
displayName: End Area
region: test_region

exits:
  - id: back_into_one_way
    targetId: one_way_path
    displayName: Try to head back in
    key: B
---

# End Area
`,
    '../../../packages/content/oneway/one_way_path.md': `---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: one_way_path
displayName: One Way Path
region: test_region

directionality: forward_only

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open

endpoints:
  forward:
    from: start_area
    to: end_area
---

# One Way Path

## flow:first_visit:forward

### beat
First beat.

### beat
Second beat.

---

## flow:repeat:forward

### beat
Repeat beat.
`,
  });

  const startPage = contentRuntime.getProjectedPage('oneway', 'start_area');

  assert.equal(startPage?.kind, 'page');

  if (!startPage || startPage.kind !== 'page') {
    throw new Error('Expected a page for start_area.');
  }

  const intoPathAction = startPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'one_way_path');

  assert.ok(intoPathAction);

  const intoPath = contentRuntime.resolveProjectAction('oneway', 'start_area', intoPathAction!);

  assert.equal(intoPath.nextNodeId, 'one_way_path');
  assert.equal(intoPath.nextPathDirection, 'forward');

  const pathPage = contentRuntime.getProjectedPage('oneway', 'one_way_path', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(pathPage?.kind, 'page');

  if (!pathPage || pathPage.kind !== 'page') {
    throw new Error('Expected a page for one_way_path.');
  }

  assert.deepEqual(pathPage.controls.map((control) => control.kind), ['continue', 'skip']);

  const endPage = contentRuntime.getProjectedPage('oneway', 'end_area');

  assert.equal(endPage?.kind, 'page');

  if (!endPage || endPage.kind !== 'page') {
    throw new Error('Expected a page for end_area.');
  }

  const blockedReturnAction = endPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'one_way_path');

  assert.ok(blockedReturnAction);

  const blockedReturn = contentRuntime.resolveProjectAction('oneway', 'end_area', blockedReturnAction!);

  assert.equal(blockedReturn.nextNodeId, undefined);
  assert.equal(blockedReturn.nextPathDirection, undefined);
});

test('blocked paths use flow:block beats and do not traverse on the final blocked page', () => {
  const contentRuntime = createContentRuntime({
    '../../../packages/content/blocked/start_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: start_area
displayName: Start Area
region: test_region

exits:
  - id: toward_blocked_path
    targetId: blocked_path
    displayName: Toward the roadblock
    key: B
---

# Start Area
`,
    '../../../packages/content/blocked/end_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: end_area
displayName: End Area
region: test_region
---

# End Area
`,
    '../../../packages/content/blocked/blocked_path.md': `---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: blocked_path
displayName: Blocked Path
region: test_region

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: blocked
  backward: open

endpoints:
  forward:
    from: start_area
    to: end_area
  backward:
    from: end_area
    to: start_area
---

# Blocked Path

## flow:block:forward

### beat
The road is blocked.

### beat
You are not getting past it.

## flow:first_visit:forward

### beat
This should not appear while the path is blocked.

## flow:repeat:forward

### beat
This should also stay hidden while blocked.
`,
  });

  const startPage = contentRuntime.getProjectedPage('blocked', 'start_area');

  assert.equal(startPage?.kind, 'page');

  if (!startPage || startPage.kind !== 'page') {
    throw new Error('Expected a page for start_area.');
  }

  const intoPathAction = startPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'blocked_path');

  assert.ok(intoPathAction);

  const intoPath = contentRuntime.resolveProjectAction('blocked', 'start_area', intoPathAction!);

  assert.equal(intoPath.nextNodeId, 'blocked_path');
  assert.equal(intoPath.nextPathDirection, 'forward');

  const firstBeat = contentRuntime.getProjectedPage('blocked', 'blocked_path', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(firstBeat?.kind, 'page');

  if (!firstBeat || firstBeat.kind !== 'page') {
    throw new Error('Expected a page for blocked_path.');
  }

  assert.deepEqual(firstBeat.proseBlocks.map((block) => block.text), ['The road is blocked.']);
  assert.deepEqual(firstBeat.controls.map((control) => control.kind), ['continue', 'back']);

  const nextBeat = contentRuntime.resolveProjectControl('blocked', 'blocked_path', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 0 });

  assert.equal(nextBeat.nextNodeId, 'blocked_path');
  assert.equal(nextBeat.nextPathBeatIndex, 1);

  const finalBeat = contentRuntime.getProjectedPage('blocked', 'blocked_path', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 1,
  });

  assert.equal(finalBeat?.kind, 'page');

  if (!finalBeat || finalBeat.kind !== 'page') {
    throw new Error('Expected a final page for blocked_path.');
  }

  assert.deepEqual(finalBeat.proseBlocks.map((block) => block.text), ['You are not getting past it.']);
  assert.deepEqual(finalBeat.controls.map((control) => control.kind), ['back']);

  const blockedContinue = contentRuntime.resolveProjectControl('blocked', 'blocked_path', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 1 });

  assert.equal(blockedContinue.nextNodeId, undefined);
  assert.equal(blockedContinue.nextPathDirection, undefined);
});

test('forward-only gates hide default back and reject traversal from the far side', () => {
  const contentRuntime = createContentRuntime({
    '../../../packages/content/oneway-gate/start_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: start_area
displayName: Start Area
region: test_region

exits:
  - id: toward_gate
    targetId: one_way_gate
    displayName: Through the shimmering threshold
    key: T
---

# Start Area
`,
    '../../../packages/content/oneway-gate/end_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: end_area
displayName: End Area
region: test_region

exits:
  - id: back_to_gate
    targetId: one_way_gate
    displayName: Try to force your way back
    key: B
---

# End Area
`,
    '../../../packages/content/oneway-gate/one_way_gate.md': `---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: one_way_gate
displayName: One-Way Threshold
region: test_region

directionality: forward_only

presentationMode: billboard

endpoints:
  forward:
    from: start_area
    to: end_area

exits:
  - id: pass_through
    targetId: end_area
    displayName: Step Through
    key: S
---

# One-Way Threshold

## billboard
The air folds inward like a held breath.
`,
  });

  const startPage = contentRuntime.getProjectedPage('oneway-gate', 'start_area');

  assert.equal(startPage?.kind, 'page');

  if (!startPage || startPage.kind !== 'page') {
    throw new Error('Expected a page for start_area.');
  }

  const intoGateAction = startPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'one_way_gate');

  assert.ok(intoGateAction);

  const intoGate = contentRuntime.resolveProjectAction('oneway-gate', 'start_area', intoGateAction!);

  assert.equal(intoGate.nextNodeId, 'one_way_gate');
  assert.equal(intoGate.nextPathDirection, undefined);

  const gatePage = contentRuntime.getProjectedPage('oneway-gate', 'one_way_gate');

  assert.equal(gatePage?.kind, 'page');

  if (!gatePage || gatePage.kind !== 'page') {
    throw new Error('Expected a page for one_way_gate.');
  }

  assert.deepEqual(gatePage.controls.map((control) => control.kind), []);

  const endPage = contentRuntime.getProjectedPage('oneway-gate', 'end_area');

  assert.equal(endPage?.kind, 'page');

  if (!endPage || endPage.kind !== 'page') {
    throw new Error('Expected a page for end_area.');
  }

  const blockedReturnAction = endPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'one_way_gate');

  assert.ok(blockedReturnAction);

  const blockedReturn = contentRuntime.resolveProjectAction('oneway-gate', 'end_area', blockedReturnAction!);

  assert.equal(blockedReturn.nextNodeId, undefined);
  assert.equal(blockedReturn.nextPathDirection, undefined);
});

test('passthrough gates route area to path and back out to the opposite area in both directions', () => {
  const contentRuntime = createContentRuntime(contentFiles);
  const entryPage = contentRuntime.getProjectedPage('test01', 'test01_entry');

  assert.equal(entryPage?.kind, 'page');

  if (!entryPage || entryPage.kind !== 'page') {
    throw new Error('Expected a page for test01_entry.');
  }

  const forwardExit = entryPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'test01_gate');

  assert.ok(forwardExit);

  const intoPath = contentRuntime.resolveProjectAction('test01', 'test01_entry', forwardExit!);

  assert.equal(intoPath.nextNodeId, 'test01_path');
  assert.equal(intoPath.nextPathDirection, 'forward');

  const firstPathPage = contentRuntime.getProjectedPage('test01', 'test01_path', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(firstPathPage?.kind, 'page');

  if (!firstPathPage || firstPathPage.kind !== 'page') {
    throw new Error('Expected a page for test01_path.');
  }

  assert.deepEqual(firstPathPage.proseBlocks.map((block) => block.text), ['This path file was discovered from the test01 folder.']);
  assert.deepEqual(firstPathPage.controls.map((control) => control.kind), ['continue', 'skip', 'back']);

  const backControl = firstPathPage.controls.find((control) => control.kind === 'back');

  assert.ok(backControl);

  const reverseEarly = contentRuntime.resolveProjectControl('test01', 'test01_path', 'forward', backControl!, {
    pathVisitCount: 1,
    pathBeatIndex: 0,
  });

  assert.equal(reverseEarly.nextNodeId, 'test01_entry');
  assert.equal(reverseEarly.nextPathDirection, undefined);

  const nextBeat = contentRuntime.resolveProjectControl('test01', 'test01_path', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 0 });

  assert.equal(nextBeat.nextNodeId, 'test01_path');
  assert.equal(nextBeat.nextPathDirection, 'forward');
  assert.equal(nextBeat.nextPathBeatIndex, 1);

  const secondPathPage = contentRuntime.getProjectedPage('test01', 'test01_path', 'forward', {
    pathVisitCount: 1,
    pathBeatIndex: 1,
  });

  assert.equal(secondPathPage?.kind, 'page');

  if (!secondPathPage || secondPathPage.kind !== 'page') {
    throw new Error('Expected a second page for test01_path.');
  }

  assert.deepEqual(secondPathPage.proseBlocks.map((block) => block.text), ['The maintained road leads the way forward.']);

  const forwardArrival = contentRuntime.resolveProjectControl('test01', 'test01_path', 'forward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 1 });

  assert.equal(forwardArrival.nextNodeId, 'test02_entry');
  assert.equal(forwardArrival.nextPathDirection, undefined);

  const returnPage = contentRuntime.getProjectedPage('test01', 'test02_entry');

  assert.equal(returnPage?.kind, 'page');

  if (!returnPage || returnPage.kind !== 'page') {
    throw new Error('Expected a page for test02_entry.');
  }

  const backwardExit = returnPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'test02_gate');

  assert.ok(backwardExit);

  const backIntoPath = contentRuntime.resolveProjectAction('test01', 'test02_entry', backwardExit!);

  assert.equal(backIntoPath.nextNodeId, 'test01_path');
  assert.equal(backIntoPath.nextPathDirection, 'backward');

  const backwardArrival = contentRuntime.resolveProjectControl('test01', 'test01_path', 'backward', {
    kind: 'continue',
    label: 'Continue',
  }, { pathVisitCount: 1, pathBeatIndex: 1 });

  assert.equal(backwardArrival.nextNodeId, 'test01_entry');
  assert.equal(backwardArrival.nextPathDirection, undefined);
});

test('repeat-mode paths compress to a single page and hide skip control', () => {
  const contentRuntime = createContentRuntime(contentFiles);
  const repeatPage = contentRuntime.getProjectedPage('test01', 'test01_path', 'forward', {
    pathVisitCount: 2,
    pathBeatIndex: 0,
  });

  assert.equal(repeatPage?.kind, 'page');

  if (!repeatPage || repeatPage.kind !== 'page') {
    throw new Error('Expected a repeat page for test01_path.');
  }

  assert.deepEqual(repeatPage.proseBlocks.map((block) => block.text), ['You go forward.']);
  assert.deepEqual(repeatPage.controls.map((control) => control.kind), ['continue', 'back']);
});

test('runtime resolves alias references for authored ids with guid suffixes', () => {
  const aliasRuntime = createContentRuntime({
    '../../../packages/content/alias/AreaObject01.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: alias_entry_{guid}
displayName: Alias Entry

region: alias_region

exits:
  - id: alias_gate
    targetId: alias_gate
    displayName: Through Alias Gate
    key: A
---

# Alias Entry

## enter
Alias entry prose.
`,
    '../../../packages/content/alias/PathObject.md': `---
version: 1
templateSchema: path
templateSchemaVersion: 1

id: alias_path_{guid}
displayName: Alias Path

region: alias_region

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open
  backward: open

endpoints:
  forward:
    from: alias_gate
    to: alias_destination
  backward:
    from: alias_destination
    to: alias_gate
---

# Alias Path

## flow:first_visit:forward

### beat
Forward through the alias path.

## flow:first_visit:backward

### beat
Backward through the alias path.
`,
    '../../../packages/content/alias/GateObject.md': `---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: alias_gate_{guid}
displayName: Alias Gate

presentationMode: passthrough

region: alias_region

endpoints:
  forward:
    from: alias_entry
    to: alias_path
  backward:
    from: alias_path
    to: alias_entry
---

# Alias Gate
`,
    '../../../packages/content/alias/AreaObject02.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: alias_destination_{guid}
displayName: Alias Destination

region: alias_region
---

# Alias Destination

## enter
Alias destination prose.
`,
  });

  const aliasPage = aliasRuntime.getProjectedPage('alias', 'alias_entry_{guid}');

  assert.equal(aliasPage?.kind, 'page');

  if (!aliasPage || aliasPage.kind !== 'page') {
    throw new Error('Expected a page for alias_entry_{guid}.');
  }

  const aliasExit = aliasPage.actions.find((action) => action.kind === 'exit');

  assert.ok(aliasExit);

  const intoAliasPath = aliasRuntime.resolveProjectAction('alias', 'alias_entry_{guid}', aliasExit!);

  assert.equal(intoAliasPath.nextNodeId, 'alias_path_{guid}');
  assert.equal(intoAliasPath.nextPathDirection, 'forward');

  const aliasArrival = aliasRuntime.resolveProjectControl('alias', 'alias_path_{guid}', 'forward', {
    kind: 'continue',
    label: 'Continue',
  });

  assert.equal(aliasArrival.nextNodeId, 'alias_destination_{guid}');
});

test('runtime resolves project-relative source path aliases for nested content nodes', () => {
  const nestedAliasRuntime = createContentRuntime({
    '../../../packages/content/nested/title/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Nested Title
region: nested_region

exits:
  - id: start
    targetId: building01/building01_groundfloor
    displayName: Start
    key: C
---

# Nested Title

## enter
The nested project begins here.
`,
    '../../../packages/content/nested/building01/building01_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: nested_region

exits:
  - id: upstairs
    targetId: building01/building01_upstairs
    displayName: Upstairs
    key: U
---

# Building 01 Ground Floor

## enter
The room resolves by folder path alias.
`,
    '../../../packages/content/nested/building01/building01_upstairs.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_upstairs
displayName: Building 01 Upstairs
region: nested_region

tags:
  - ending

exits:
  - id: finish
    targetId: game_over_good
    displayName: Finish
    key: F
---

# Building 01 Upstairs

## enter
You made it upstairs.
`,
    '../../../packages/content/nested/endings/game_over_good.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_good
displayName: Good Ending
region: nested_region

tags:
  - ending
---

# Good Ending

## enter
The nested project can still end.
`,
  }, { validateProjects: true });

  const titlePage = nestedAliasRuntime.getProjectedPage('nested', 'title_screen');

  assert.equal(titlePage?.kind, 'page');

  if (!titlePage || titlePage.kind !== 'page') {
    throw new Error('Expected a page for nested title_screen.');
  }

  const startAction = titlePage.actions.find((action) => action.kind === 'exit' && action.targetId === 'building01/building01_groundfloor');

  assert.ok(startAction);

  const startOutcome = nestedAliasRuntime.resolveProjectAction('nested', 'title_screen', startAction!);

  assert.equal(startOutcome.nextNodeId, 'building01_groundfloor');

  const groundFloorPage = nestedAliasRuntime.getProjectedPage('nested', 'building01_groundfloor');

  assert.equal(groundFloorPage?.kind, 'page');

  if (!groundFloorPage || groundFloorPage.kind !== 'page') {
    throw new Error('Expected a page for building01_groundfloor.');
  }

  const upstairsAction = groundFloorPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'building01/building01_upstairs');

  assert.ok(upstairsAction);

  const upstairsOutcome = nestedAliasRuntime.resolveProjectAction('nested', 'building01_groundfloor', upstairsAction!);

  assert.equal(upstairsOutcome.nextNodeId, 'building01_upstairs');
});

test('runtime loads event sidecars and associates them with their node ids', () => {
  const runtimeWithEvents = createRuntimeForContentFiles({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: building01/building01_groundfloor
    displayName: Start
    key: C
---

# Title Screen

## enter
The sketch begins here.
`,
    '../../../packages/content/sketch/building01/building01_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: sketch_region

pois:
  - id: vase_01
    displayName: Vase

choices:
  - id: straighten_vase
    displayName: Straighten The Vase

exits:
  - id: leave_room
    targetId: sidewalk_north
    displayName: Leave Room
---

# Building 01 Ground Floor

## enter
The room holds one suspicious vase.
`,
    '../../../packages/content/sketch/building01/events.yaml': `# sketch event comments should be ignored

events:
  inspect_vase_01:
    trigger:
      kind: poi
      actor: player
      nodeId: building01_groundfloor
      poiId: vase_01

    when:
      predicate: resident_is_home

    actor:
      - You take the vase and turn it over in your hands.

    private:
      when:
        predicate: actor_recognizes_cheap_imitation
      text:
        - Another cheap clay imitation. There are too many of those on this block.

    witnesses:
      text:
        - '{actor.name|Someone} takes the vase and turns it over in {actor.pronouns.possessive|their} hands.'
        - '{actor.name|Someone} sighs after a brief inspection.'

    effects:
      - set: [objects.vase_01.last_inspected_by, actor.id]
      - set: [objects.vase_01.last_read_quality, imitation]

  straighten_vase_01:
    trigger:
      kind: choice
      actor: player
      nodeId: building01_groundfloor
      choiceId: straighten_vase

    actor:
      - You rotate the vase until the chipped side faces the wall.

    private:
      text:
        - It changes nothing important, but the room looks slightly less careless.

    effects:
      - set: [objects.vase_01.aligned, true]

  leave_room_untidied:
    trigger:
      kind: exit
      actor: player
      nodeId: building01_groundfloor
      exitId: leave_room

    actor:
      - You leave the room as it was.
`,
    '../../../packages/content/sketch/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: North Sidewalk
region: sketch_region
---

# North Sidewalk

## enter
The street is outside.
`,
  });

  const events = runtimeWithEvents.sketch?.eventsByNodeId.building01_groundfloor;

  assert.equal(events?.length, 3);
  assert.equal(events?.[0]?.id, 'inspect_vase_01');
  assert.equal(events?.[0]?.trigger.nodeId, 'building01_groundfloor');
  assert.equal(events?.[0]?.trigger.poiId, 'vase_01');
  assert.deepEqual(events?.[0]?.actor.text, ['You take the vase and turn it over in your hands.']);
  assert.equal(events?.[0]?.private?.when?.predicate, 'actor_recognizes_cheap_imitation');
  assert.equal(events?.[0]?.witnesses?.text[0], '{actor.name|Someone} takes the vase and turns it over in {actor.pronouns.possessive|their} hands.');
  assert.deepEqual(events?.[0]?.effects, [
    {
      kind: 'set',
      args: ['objects.vase_01.last_inspected_by', 'actor.id'],
    },
    {
      kind: 'set',
      args: ['objects.vase_01.last_read_quality', 'imitation'],
    },
  ]);
  assert.equal(events?.[1]?.id, 'straighten_vase_01');
  assert.equal(events?.[1]?.trigger.kind, 'choice');
  assert.equal(events?.[1]?.trigger.choiceId, 'straighten_vase');
  assert.deepEqual(events?.[1]?.actor.text, ['You rotate the vase until the chipped side faces the wall.']);
  assert.equal(events?.[2]?.id, 'leave_room_untidied');
  assert.equal(events?.[2]?.trigger.kind, 'exit');
  assert.equal(events?.[2]?.trigger.exitId, 'leave_room');
});

test('runtime executes sidecar POI events with predicate-gated text and set effects', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: building01/building01_groundfloor
    displayName: Start
    key: C
---

# Title Screen

## enter
The sketch begins here.
`,
    '../../../packages/content/sketch/building01/building01_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: sketch_region

pois:
  - id: vase_01
    displayName: Vase
    key: V
---

# Building 01 Ground Floor

## enter
The room holds one suspicious vase.

## poi:vase_01
The vase sits very still.
`,
    '../../../packages/content/sketch/building01/events.yaml': `events:
  inspect_vase_01:
    trigger:
      kind: poi
      actor: player
      nodeId: building01_groundfloor
      poiId: vase_01

    when:
      predicate: resident_is_home

    actor:
      - You take the vase and turn it over in your hands.

    private:
      when:
        predicate: actor_recognizes_cheap_imitation
      text:
        - Another cheap clay imitation. There are too many of those on this block.

    witnesses:
      text:
        - '{actor.name|Someone} takes the vase and turns it over in {actor.pronouns.possessive|their} hands.'
        - '{actor.name|Someone} sighs after a brief inspection.'

    effects:
      - set: [objects.vase_01.last_inspected_by, actor.id]
      - set: [objects.vase_01.last_read_quality, imitation]
`,
    '../../../packages/content/sketch/predicates/project.yaml': `# sketch predicate comments should be ignored

predicates:
  resident_is_home:
    equals: [npcs.resident_01.location, building01_groundfloor]

  actor_recognizes_cheap_imitation:
    equals: [actor.perception.recognizes_cheap_imitation, true]
`,
    '../../../packages/content/sketch/state/world.yaml': `# sketch state comments should be ignored

npcs:
  resident_01:
    location: building01_groundfloor

player:
  active:
    id: player_01

players:
  player_01:
    name: Rowan Vale
    pronouns:
      possessive: their
    perception:
      recognizes_cheap_imitation: true
`,
  });

  const initialSessionState = sketchRuntime.createInitialProjectSessionState('sketch');
  const outcome = sketchRuntime.resolveProjectAction(
    'sketch',
    'building01_groundfloor',
    { id: 'vase_01', kind: 'poi', label: 'Vase', key: 'V', keyLabel: '[V]' },
    { sessionState: initialSessionState, actorId: 'player_01', viewerId: 'player_01' },
  );

  assert.equal(outcome.nextNodeId, undefined);
  assert.equal(outcome.logEntry?.text, 'You take the vase and turn it over in your hands.');
  assert.equal(outcome.logEntry?.lane, 'recent');
  assert.deepEqual(outcome.projectionEmissions?.map((emission) => ({ audience: emission.audience.kind, text: emission.text })), [
    { audience: 'actor', text: 'You take the vase and turn it over in your hands.' },
    { audience: 'actor', text: 'Another cheap clay imitation. There are too many of those on this block.' },
    { audience: 'witnesses', text: 'Rowan Vale takes the vase and turns it over in their hands.' },
    { audience: 'witnesses', text: 'Rowan Vale sighs after a brief inspection.' },
  ]);
  assert.deepEqual(outcome.logEntry?.blocks?.map((block) => ({ groupId: block.groupId, text: block.text })), [
    { groupId: 'actor', text: 'You take the vase and turn it over in your hands.' },
    { groupId: 'actor-detail', text: 'Another cheap clay imitation. There are too many of those on this block.' },
  ]);
  assert.equal(outcome.eventResult?.actorId, 'player_01');
  assert.deepEqual(outcome.eventResult?.witnesses?.text, [
    'Rowan Vale takes the vase and turns it over in their hands.',
    'Rowan Vale sighs after a brief inspection.',
  ]);
  assert.equal(outcome.sessionState?.objects?.vase_01?.last_inspected_by, 'player_01');
  assert.equal(outcome.sessionState?.objects?.vase_01?.last_read_quality, 'imitation');
});

test('runtime can surface and resolve sidecar-authored offered actions', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: building04_upstairs
    displayName: Start
---

# Title Screen

## enter
The sketch begins here.
`,
    '../../../packages/content/sketch/building04_upstairs.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building04_upstairs
displayName: Building 04 Upstairs
region: sketch_region
---

# Building 04 Upstairs

## enter
The room is ready.
`,
    '../../../packages/content/sketch/building04/events.yaml': `events:
  go_to_bed_when_room_is_ready:
    trigger:
      kind: choice
      actor: player
      nodeId: building04_upstairs
      choiceId: go_to_bed

    when:
      predicate: can_sleep

    offer:
      label: Go To Bed
      key: G

    actor:
      - You go to bed.

    effects:
      - navigate: [game_over_good]
`,
    '../../../packages/content/sketch/endings/game_over_good.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_good
displayName: Good Ending
region: sketch_region
---

# Good Ending

## enter
You sleep.
`,
    '../../../packages/content/sketch/predicates/project.yaml': `predicates:
  can_sleep:
    equals: [world.sleep.ready, true]
`,
    '../../../packages/content/sketch/state/world.yaml': `world:
  sleep:
    ready: true

player:
  active:
    id: player_01
`,
  });

  const initialSessionState = sketchRuntime.createInitialProjectSessionState('sketch');
  const offeredActions = sketchRuntime.getOfferedActions('sketch', 'building04_upstairs', {
    sessionState: initialSessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });
  const outcome = sketchRuntime.resolveProjectAction('sketch', 'building04_upstairs', offeredActions[0]!, {
    sessionState: initialSessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(offeredActions.length, 1);
  assert.equal(offeredActions[0]?.id, 'go_to_bed');
  assert.equal(offeredActions[0]?.label, 'Go To Bed');
  assert.equal(offeredActions[0]?.key, 'G');
  assert.equal(outcome.logEntry?.text, 'You go to bed.');
  assert.equal(outcome.nextNodeId, 'game_over_good');
});

test('runtime can surface and resolve sidecar-authored reset-run actions', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: game_over_bad
    displayName: Start
---

# Title Screen

## enter
The sketch begins here.
`,
    '../../../packages/content/sketch/game_over_bad.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_bad
displayName: Bad Ending
region: sketch_region
---

# Bad Ending

## enter
Everything goes wrong.
`,
    '../../../packages/content/sketch/events.yaml': `events:
  restart_after_bad_ending:
    trigger:
      kind: choice
      actor: player
      nodeId: game_over_bad
      choiceId: restart

    offer:
      label: Restart
      key: R

    actor:
      - You decide to start over.

    effects:
      - reset_run: [title_screen]
`,
    '../../../packages/content/sketch/state/world.yaml': `player:
  active:
    id: player_01
`,
  });

  const initialSessionState = sketchRuntime.createInitialProjectSessionState('sketch');
  const offeredActions = sketchRuntime.getOfferedActions('sketch', 'game_over_bad', {
    sessionState: initialSessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });
  const outcome = sketchRuntime.resolveProjectAction('sketch', 'game_over_bad', offeredActions[0]!, {
    sessionState: initialSessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(offeredActions.length, 1);
  assert.equal(offeredActions[0]?.id, 'restart');
  assert.equal(outcome.logEntry?.text, 'You decide to start over.');
  assert.equal(outcome.resetNodeId, 'title_screen');
  assert.equal(outcome.nextNodeId, undefined);
});

test('runtime executes sidecar choice events before falling back to authored choice prose', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: building01/building01_groundfloor
    displayName: Start
    key: C
---

# Title Screen

## enter
The sketch begins here.
`,
    '../../../packages/content/sketch/building01/building01_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: sketch_region

choices:
  - id: straighten_vase
    displayName: Straighten The Vase
    key: S
---

# Building 01 Ground Floor

## enter
The room holds one suspicious vase.

## choice:straighten_vase
You nudge the vase a fraction of an inch.
`,
    '../../../packages/content/sketch/building01/events.yaml': `events:
  straighten_vase_01:
    trigger:
      kind: choice
      actor: player
      nodeId: building01_groundfloor
      choiceId: straighten_vase

    actor:
      - You rotate the vase until the chipped side faces the wall.

    private:
      text:
        - It changes nothing important, but the room looks slightly less careless.

    effects:
      - set: [objects.vase_01.aligned, true]
      - set: [objects.vase_01.last_aligned_by, actor.id]
`,
    '../../../packages/content/sketch/state/world.yaml': `objects:
  vase_01:
    aligned: false

player:
  active:
    id: player_01

players:
  player_01:
    name: Rowan Vale
`,
  });

  const initialSessionState = sketchRuntime.createInitialProjectSessionState('sketch');
  const outcome = sketchRuntime.resolveProjectAction(
    'sketch',
    'building01_groundfloor',
    { id: 'straighten_vase', kind: 'choice', label: 'Straighten The Vase', key: 'S', keyLabel: '[S]' },
    { sessionState: initialSessionState, actorId: 'player_01', viewerId: 'player_01' },
  );

  assert.equal(outcome.nextNodeId, undefined);
  assert.equal(outcome.logEntry?.text, 'You rotate the vase until the chipped side faces the wall.');
  assert.equal(outcome.logEntry?.lane, 'visible');
  assert.deepEqual(outcome.logEntry?.blocks?.map((block) => ({ groupId: block.groupId, text: block.text })), [
    { groupId: 'actor', text: 'You rotate the vase until the chipped side faces the wall.' },
    { groupId: 'actor-detail', text: 'It changes nothing important, but the room looks slightly less careless.' },
  ]);
  assert.equal(outcome.sessionState?.objects?.vase_01?.aligned, true);
  assert.equal(outcome.sessionState?.objects?.vase_01?.last_aligned_by, 'player_01');
});

test('sidecar object state can change later event results', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: building01/building01_groundfloor
    displayName: Start
---

# Title Screen

## enter
The sketch begins here.
`,
    '../../../packages/content/sketch/building01/building01_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: sketch_region

pois:
  - id: vase_01
    displayName: Vase
    key: V

choices:
  - id: straighten_vase
    displayName: Straighten The Vase
    key: S
---

# Building 01 Ground Floor

## enter
The room holds one suspicious vase.

## poi:vase_01
The vase sits very still.

## choice:straighten_vase
You nudge the vase a fraction of an inch.
`,
    '../../../packages/content/sketch/building01/events.yaml': `events:
  inspect_vase_01_aligned:
    trigger:
      kind: poi
      actor: player
      nodeId: building01_groundfloor
      poiId: vase_01

    when:
      predicate: vase_is_aligned

    actor:
      - You lift the vase again. The chipped side is tucked neatly toward the wall now.

  inspect_vase_01:
    trigger:
      kind: poi
      actor: player
      nodeId: building01_groundfloor
      poiId: vase_01

    actor:
      - You take the vase and turn it over in your hands.

  straighten_vase_01:
    trigger:
      kind: choice
      actor: player
      nodeId: building01_groundfloor
      choiceId: straighten_vase

    when:
      predicate: vase_is_misaligned

    actor:
      - You rotate the vase until the chipped side faces the wall.

    effects:
      - set: [objects.vase_01.aligned, true]
`,
    '../../../packages/content/sketch/predicates/project.yaml': `predicates:
  vase_is_aligned:
    equals: [objects.vase_01.aligned, true]

  vase_is_misaligned:
    equals: [objects.vase_01.aligned, false]
`,
    '../../../packages/content/sketch/state/world.yaml': `objects:
  vase_01:
    aligned: false

player:
  active:
    id: player_01
`,
  });

  const initialSessionState = sketchRuntime.createInitialProjectSessionState('sketch');
  const firstInspectOutcome = sketchRuntime.resolveProjectAction(
    'sketch',
    'building01_groundfloor',
    { id: 'vase_01', kind: 'poi', label: 'Vase', key: 'V', keyLabel: '[V]' },
    { sessionState: initialSessionState, actorId: 'player_01', viewerId: 'player_01' },
  );

  assert.equal(firstInspectOutcome.logEntry?.text, 'You take the vase and turn it over in your hands.');

  const straightenOutcome = sketchRuntime.resolveProjectAction(
    'sketch',
    'building01_groundfloor',
    { id: 'straighten_vase', kind: 'choice', label: 'Straighten The Vase', key: 'S', keyLabel: '[S]' },
    { sessionState: initialSessionState, actorId: 'player_01', viewerId: 'player_01' },
  );

  const secondInspectOutcome = sketchRuntime.resolveProjectAction(
    'sketch',
    'building01_groundfloor',
    { id: 'vase_01', kind: 'poi', label: 'Vase', key: 'V', keyLabel: '[V]' },
    { sessionState: straightenOutcome.sessionState, actorId: 'player_01', viewerId: 'player_01' },
  );

  assert.equal(secondInspectOutcome.logEntry?.text, 'You lift the vase again. The chipped side is tucked neatly toward the wall now.');
});

test('runtime executes sidecar enter events with predicate-gated text and effects', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: building01_groundfloor
    displayName: Start
---

# Title Screen

## enter
The sketch begins here.
`,
    '../../../packages/content/sketch/building01_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: sketch_region
---

# Building 01 Ground Floor

## enter
The room is waiting.
`,
    '../../../packages/content/sketch/building01/events.yaml': `events:
  enter_room_aligned:
    trigger:
      kind: enter
      actor: player
      nodeId: building01_groundfloor

    when:
      predicate: vase_is_aligned

    actor:
      - The room looks calmer with the vase set straight.

    effects:
      - set: [objects.vase_01.enter_seen, true]
`,
    '../../../packages/content/sketch/predicates/project.yaml': `predicates:
  vase_is_aligned:
    equals: [objects.vase_01.aligned, true]
`,
    '../../../packages/content/sketch/state/world.yaml': `objects:
  vase_01:
    aligned: true

player:
  active:
    id: player_01
`,
  });

  const initialSessionState = sketchRuntime.createInitialProjectSessionState('sketch');
  const outcome = sketchRuntime.resolveProjectEnter('sketch', 'building01_groundfloor', {
    sessionState: initialSessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(outcome.logEntry?.text, 'The room looks calmer with the vase set straight.');
  assert.equal(outcome.logEntry?.lane, 'recent');
  assert.equal(outcome.sessionState?.objects?.vase_01?.enter_seen, true);
});

test('authored poi prose defaults to recent while authored choice prose defaults to visible', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: room_01
    displayName: Start
---

# Title Screen

## enter
Begin.
`,
    '../../../packages/content/sketch/room_01.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: room_01
displayName: Room 01
region: sketch_region

pois:
  - id: mirror
    displayName: Mirror

choices:
  - id: linger
    displayName: Linger
---

# Room 01

## enter
The room waits.

## poi:mirror
You inspect the mirror.

## choice:linger
You linger for a moment.
`,
  });

  const poiOutcome = sketchRuntime.resolveProjectAction('sketch', 'room_01', {
    id: 'mirror',
    kind: 'poi',
    label: 'Mirror',
  });
  const choiceOutcome = sketchRuntime.resolveProjectAction('sketch', 'room_01', {
    id: 'linger',
    kind: 'choice',
    label: 'Linger',
  });

  assert.equal(poiOutcome.logEntry?.text, 'You inspect the mirror.');
  assert.equal(poiOutcome.logEntry?.lane, 'recent');
  assert.equal(choiceOutcome.logEntry?.text, 'You linger for a moment.');
  assert.equal(choiceOutcome.logEntry?.lane, 'visible');
});

test('generated traversal text defaults to recent', () => {
  const contentRuntime = createContentRuntime(contentFiles);
  const continueOutcome = contentRuntime.resolveProjectControl('test01', 'test01_path', 'forward', {
    id: 'continue',
    kind: 'continue',
    label: 'Continue',
  }, {
    pathVisitCount: 1,
    pathBeatIndex: 1,
  });

  assert.equal(continueOutcome.logEntry?.text, 'You keep moving.');
  assert.equal(continueOutcome.logEntry?.lane, 'recent');
});

test('sidecar events can explicitly override lane to visible', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: room_01
    displayName: Start
---

# Title Screen

## enter
Begin.
`,
    '../../../packages/content/sketch/room_01.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: room_01
displayName: Room 01
region: sketch_region

choices:
  - id: remember
    displayName: Remember
---

# Room 01

## enter
The room waits.
`,
    '../../../packages/content/sketch/events.yaml': `events:
  remember_visible:
    trigger:
      kind: choice
      actor: player
      nodeId: room_01
      choiceId: remember

    lane: visible

    actor:
      - The memory lands harder than expected.
`,
  });

  const outcome = sketchRuntime.resolveProjectAction('sketch', 'room_01', {
    id: 'remember',
    kind: 'choice',
    label: 'Remember',
  });

  assert.equal(outcome.logEntry?.text, 'The memory lands harder than expected.');
  assert.equal(outcome.logEntry?.lane, 'visible');
});

test('runtime clock source can override seeded local time for predicate evaluation', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
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
The sketch begins here.
`,
    '../../../packages/content/sketch/sidewalk_north.md': `---
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
    '../../../packages/content/sketch/block/events.yaml': `events:
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
    '../../../packages/content/sketch/predicates/project.yaml': `predicates:
  is_morning:
    equals: [world.time.phase, morning]
`,
    '../../../packages/content/sketch/state/world.yaml': `world:
  time:
    phase: day

player:
  active:
    id: player_01
`,
  }, {
    clockSource: {
      getSnapshot() {
        return {
          phase: 'morning',
          source: 'server',
        };
      },
    },
  });

  const initialSessionState = sketchRuntime.createInitialProjectSessionState('sketch');
  const outcome = sketchRuntime.resolveProjectEnter('sketch', 'sidewalk_north', {
    sessionState: initialSessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(outcome.logEntry?.text, 'Morning light catches the storefront glass before the block fully wakes.');
});

test('runtime clock source can drive sidecar POI events for automatic streetlamp state', () => {
  const sketchFiles = {
    '../../../packages/content/sketch/title_screen.md': `---
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
The sketch begins here.
`,
    '../../../packages/content/sketch/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: North Sidewalk
region: sketch_region

pois:
  - id: streetlamps
    displayName: Streetlamps
---

# North Sidewalk

## enter
The sidewalk is quiet.

## poi:streetlamps
The lamps are just there.
`,
    '../../../packages/content/sketch/block/events.yaml': `events:
  inspect_streetlamps_at_dusk:
    trigger:
      kind: poi
      actor: player
      nodeId: sidewalk_north
      poiId: streetlamps

    when:
      predicate: is_dusk

    actor:
      - The streetlamps have just come on.

  inspect_streetlamps_at_dawn:
    trigger:
      kind: poi
      actor: player
      nodeId: sidewalk_north
      poiId: streetlamps

    when:
      predicate: is_dawn

    actor:
      - The streetlamps have gone dark again.
`,
    '../../../packages/content/sketch/predicates/project.yaml': `predicates:
  is_dusk:
    equals: [world.time.phase, dusk]

  is_dawn:
    equals: [world.time.phase, dawn]
`,
    '../../../packages/content/sketch/state/world.yaml': `world:
  time:
    phase: day

player:
  active:
    id: player_01
`,
  };

  const duskRuntime = createContentRuntime(sketchFiles, {
    clockSource: {
      getSnapshot() {
        return {
          phase: 'dusk',
          source: 'server',
        };
      },
    },
  });
  const dawnRuntime = createContentRuntime(sketchFiles, {
    clockSource: {
      getSnapshot() {
        return {
          phase: 'dawn',
          source: 'server',
        };
      },
    },
  });

  const duskState = duskRuntime.createInitialProjectSessionState('sketch');
  const dawnState = dawnRuntime.createInitialProjectSessionState('sketch');
  const duskOutcome = duskRuntime.resolveProjectAction('sketch', 'sidewalk_north', {
    kind: 'poi',
    id: 'streetlamps',
    label: 'Streetlamps',
  }, {
    sessionState: duskState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });
  const dawnOutcome = dawnRuntime.resolveProjectAction('sketch', 'sidewalk_north', {
    kind: 'poi',
    id: 'streetlamps',
    label: 'Streetlamps',
  }, {
    sessionState: dawnState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(duskOutcome.logEntry?.text, 'The streetlamps have just come on.');
  assert.equal(dawnOutcome.logEntry?.text, 'The streetlamps have gone dark again.');
});

test('phase schedules derive state from the current clock before predicate-based POI evaluation', () => {
  const sketchFiles = {
    '../../../packages/content/sketch/title_screen.md': `---
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
`,
    '../../../packages/content/sketch/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: North Sidewalk
region: sketch_region

pois:
  - id: streetlamps
    displayName: Streetlamps
---

# North Sidewalk
`,
    '../../../packages/content/sketch/good_ending.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: good_ending
displayName: Good Ending
region: sketch_region
tags:
  - ending
---

# Good Ending
`,
    '../../../packages/content/sketch/door.md': `---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: door
displayName: Door
region: sketch_region

presentationMode: passthrough

endpoints:
  forward:
    from: sidewalk_north
    to: good_ending
  backward:
    from: good_ending
    to: sidewalk_north
---

# Door
`,
    '../../../packages/content/sketch/block/events.yaml': `events:
  inspect_streetlamps_when_on:
    trigger:
      kind: poi
      actor: player
      nodeId: sidewalk_north
      poiId: streetlamps

    when:
      predicate: streetlamps_are_on

    actor:
      - The streetlamps are on now.

  inspect_streetlamps_when_off:
    trigger:
      kind: poi
      actor: player
      nodeId: sidewalk_north
      poiId: streetlamps

    when:
      predicate: streetlamps_are_off

    actor:
      - The streetlamps are off.
`,
    '../../../packages/content/sketch/predicates/project.yaml': `predicates:
  streetlamps_are_on:
    equals: [objects.streetlamps.on, true]

  streetlamps_are_off:
    equals: [objects.streetlamps.on, false]
`,
    '../../../packages/content/sketch/state/world.yaml': `objects:
  streetlamps:
    on: false

player:
  active:
    id: player_01
`,
    '../../../packages/content/sketch/settings/time.yaml': `calendars:
  default_world:
    phases:
      - id: day
        durationMinutes: 1
      - id: dusk
        durationMinutes: 1
      - id: dawn
        durationMinutes: 1

assignments:
  defaultCalendar: default_world

schedules:
  lamps_on:
    trigger:
      kind: phase
      phaseId: dusk
    target:
      nodes:
        - sidewalk_north
    effects:
      - set: [objects.streetlamps.on, true]

  lamps_off:
    trigger:
      kind: phase
      phaseId: dawn
    target:
      nodes:
        - sidewalk_north
    effects:
      - set: [objects.streetlamps.on, false]
`,
  };

  const duskRuntime = createContentRuntime(sketchFiles, {
    clockSource: {
      getSnapshot() {
        return { phase: 'dusk', nowMs: 0, source: 'server' };
      },
    },
  });
  const dawnRuntime = createContentRuntime(sketchFiles, {
    clockSource: {
      getSnapshot() {
        return { phase: 'dawn', nowMs: 0, source: 'server' };
      },
    },
  });

  const duskOutcome = duskRuntime.resolveProjectAction('sketch', 'sidewalk_north', {
    kind: 'poi',
    id: 'streetlamps',
    label: 'Streetlamps',
  }, {
    sessionState: duskRuntime.createInitialProjectSessionState('sketch'),
    actorId: 'player_01',
    viewerId: 'player_01',
  });
  const dawnOutcome = dawnRuntime.resolveProjectAction('sketch', 'sidewalk_north', {
    kind: 'poi',
    id: 'streetlamps',
    label: 'Streetlamps',
  }, {
    sessionState: dawnRuntime.createInitialProjectSessionState('sketch'),
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(duskOutcome.logEntry?.text, 'The streetlamps are on now.');
  assert.equal(dawnOutcome.logEntry?.text, 'The streetlamps are off.');
});

test('phase-aligned schedules can re-enable the wrapped mint on the next matching phase, even if the player leaves first', () => {
  const beforeRefillRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return { phase: 'day', nowMs: 0, source: 'server' };
      },
    },
  });
  const afterRefillRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return { phase: 'day', nowMs: 7 * 60_000, source: 'server' };
      },
    },
  });

  const initialState = beforeRefillRuntime.createInitialProjectSessionState('demo04');
  const takeMintOutcome = beforeRefillRuntime.resolveProjectAction('demo04', 'building02_groundfloor', {
    kind: 'choice',
    id: 'take_counter_mint',
    label: 'Take Wrapped Mint',
  }, {
    sessionState: initialState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  const inspectBeforeRefill = beforeRefillRuntime.resolveProjectAction('demo04', 'building02_groundfloor', {
    kind: 'poi',
    id: 'sample_bowl',
    label: 'Sample Bowl',
  }, {
    sessionState: takeMintOutcome.sessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });
  const lookAwayAfterRefill = afterRefillRuntime.resolveProjectAction('demo04', 'sidewalk_north', {
    kind: 'poi',
    id: 'streetlamps',
    label: 'Streetlamps',
  }, {
    sessionState: takeMintOutcome.sessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });
  const inspectAfterRefill = afterRefillRuntime.resolveProjectAction('demo04', 'building02_groundfloor', {
    kind: 'poi',
    id: 'sample_bowl',
    label: 'Sample Bowl',
  }, {
    sessionState: lookAwayAfterRefill.sessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(inspectBeforeRefill.logEntry?.text, 'The bowl is empty now, though it looks like someone still means to keep the gesture going.');
  assert.equal(inspectAfterRefill.logEntry?.text, 'One wrapped mint waits in the bowl like the room is still practicing for customers.');
});

test('phase-aligned schedules can re-enable the wrapped mint on the next matching phase while the player stays on the node', () => {
  const beforeRefillRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return { phase: 'day', nowMs: 0, source: 'server' };
      },
    },
  });
  const afterRefillRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return { phase: 'day', nowMs: 7 * 60_000, source: 'server' };
      },
    },
  });

  const initialState = beforeRefillRuntime.createInitialProjectSessionState('demo04');
  const takeMintOutcome = beforeRefillRuntime.resolveProjectAction('demo04', 'building02_groundfloor', {
    kind: 'choice',
    id: 'take_counter_mint',
    label: 'Take Wrapped Mint',
  }, {
    sessionState: initialState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  const inspectAfterRefill = afterRefillRuntime.resolveProjectAction('demo04', 'building02_groundfloor', {
    kind: 'poi',
    id: 'sample_bowl',
    label: 'Sample Bowl',
  }, {
    sessionState: takeMintOutcome.sessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(inspectAfterRefill.logEntry?.text, 'One wrapped mint waits in the bowl like the room is still practicing for customers.');
});

test('phase-aligned wrapped mint refill does not drift into the next phase when taken late in day', () => {
  const takeLateDayRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return { phase: 'day', nowMs: 90_000, source: 'server' };
      },
    },
  });
  const justBeforeNextDayRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return { phase: 'dawn', nowMs: 359_000, source: 'server' };
      },
    },
  });
  const nextDayRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return { phase: 'day', nowMs: 360_000, source: 'server' };
      },
    },
  });

  const initialState = takeLateDayRuntime.createInitialProjectSessionState('demo04');
  const takeMintOutcome = takeLateDayRuntime.resolveProjectAction('demo04', 'building02_groundfloor', {
    kind: 'choice',
    id: 'take_counter_mint',
    label: 'Take Wrapped Mint',
  }, {
    sessionState: initialState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  const inspectBeforeMatchingPhase = justBeforeNextDayRuntime.resolveProjectAction('demo04', 'building02_groundfloor', {
    kind: 'poi',
    id: 'sample_bowl',
    label: 'Sample Bowl',
  }, {
    sessionState: takeMintOutcome.sessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });
  const inspectOnMatchingPhase = nextDayRuntime.resolveProjectAction('demo04', 'building02_groundfloor', {
    kind: 'poi',
    id: 'sample_bowl',
    label: 'Sample Bowl',
  }, {
    sessionState: takeMintOutcome.sessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(inspectBeforeMatchingPhase.logEntry?.text, 'The bowl is empty now, though it looks like someone still means to keep the gesture going.');
  assert.equal(inspectOnMatchingPhase.logEntry?.text, 'One wrapped mint waits in the bowl like the room is still practicing for customers.');
});

test('schedule windows can make the morning paper appear at dawn and disappear later', () => {
  const dawnRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return { phase: 'dawn', nowMs: 0, source: 'server' };
      },
    },
  });
  const dayRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return { phase: 'day', nowMs: 120_000, source: 'server' };
      },
    },
  });

  const dawnActions = dawnRuntime.getOfferedActions('demo04', 'building04_groundfloor', {
    sessionState: dawnRuntime.createInitialProjectSessionState('demo04'),
    actorId: 'player_01',
    viewerId: 'player_01',
  });
  const dayActions = dayRuntime.getOfferedActions('demo04', 'building04_groundfloor', {
    sessionState: dayRuntime.createInitialProjectSessionState('demo04'),
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.ok(dawnActions.some((action) => action.id === 'read_morning_paper'));
  assert.ok(dayActions.every((action) => action.id !== 'read_morning_paper'));
});

test('runtime clock source can drive a night-only bed POI variant', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: building04_upstairs
    displayName: Start
---

# Title Screen

## enter
The sketch begins here.
`,
    '../../../packages/content/sketch/building04_upstairs.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building04_upstairs
displayName: Building 04 Upstairs
region: sketch_region

pois:
  - id: bed
    displayName: Bed
  - id: night_light
    displayName: Night Light
  - id: bedside_lamp
    displayName: Bedside Lamp
---

# Building 04 Upstairs

## enter
The room is waiting.

## poi:bed
The bed is neatly made.
`,
    '../../../packages/content/sketch/building04/events.yaml': `events:
  inspect_bed_at_night:
    trigger:
      kind: poi
      actor: player
      nodeId: building04_upstairs
      poiId: bed

    when:
      predicate: is_night

    actor:
      - At night the bed looks deeply inviting.
`,
    '../../../packages/content/sketch/predicates/project.yaml': `predicates:
  is_night:
    equals: [world.time.phase, night]
`,
    '../../../packages/content/sketch/state/world.yaml': `world:
  time:
    phase: day

objects:
  night_light:
    on: false

  bedside_lamp:
    on: true

player:
  active:
    id: player_01
`,
  }, {
    clockSource: {
      getSnapshot() {
        return {
          phase: 'night',
          source: 'server',
        };
      },
    },
  });

  const initialSessionState = sketchRuntime.createInitialProjectSessionState('sketch');
  const outcome = sketchRuntime.resolveProjectAction('sketch', 'building04_upstairs', {
    kind: 'poi',
    id: 'bed',
    label: 'Bed',
  }, {
    sessionState: initialSessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(outcome.logEntry?.text, 'At night the bed looks deeply inviting.');
});

test('sidecar-authored go-to-bed only wins when the night light is on and bedside lamp is off at night', () => {
  const sketchFiles = {
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: building04_upstairs
    displayName: Start
---

# Title Screen

## enter
The sketch begins here.
`,
    '../../../packages/content/sketch/building04_upstairs.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building04_upstairs
displayName: Building 04 Upstairs
region: sketch_region
---

# Building 04 Upstairs

## enter
The room is ready.
`,
    '../../../packages/content/sketch/building04/events.yaml': `events:
  go_to_bed_when_room_is_ready:
    trigger:
      kind: choice
      actor: player
      nodeId: building04_upstairs
      choiceId: go_to_bed

    when:
      predicate: building04_can_sleep

    actor:
      - Sweet dreams arrive quickly.

    effects:
      - navigate: [game_over_good]

  go_to_bed_but_not_sleep:
    trigger:
      kind: choice
      actor: player
      nodeId: building04_upstairs
      choiceId: go_to_bed

    when:
      predicate: is_night

    offer:
      label: Go To Bed
      key: G

    actor:
      - You do not fall asleep.
`,
    '../../../packages/content/sketch/endings/game_over_good.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_good
displayName: Good Ending
region: sketch_region
---

# Good Ending

## enter
You sleep.
`,
    '../../../packages/content/sketch/predicates/project.yaml': `predicates:
  is_night:
    equals: [world.time.phase, night]

  night_light_is_on:
    equals: [objects.night_light.on, true]

  bedside_lamp_is_off:
    equals: [objects.bedside_lamp.on, false]

  building04_can_sleep:
    all:
      - predicate: is_night
      - predicate: night_light_is_on
      - predicate: bedside_lamp_is_off
`,
    '../../../packages/content/sketch/state/world.yaml': `world:
  time:
    phase: day

objects:
  night_light:
    on: false
  bedside_lamp:
    on: true

player:
  active:
    id: player_01
`,
  };

  const sketchRuntime = createContentRuntime(sketchFiles, {
    clockSource: {
      getSnapshot() {
        return {
          phase: 'night',
          source: 'server',
        };
      },
    },
  });

  const initialSessionState = sketchRuntime.createInitialProjectSessionState('sketch');
  const offeredActions = sketchRuntime.getOfferedActions('sketch', 'building04_upstairs', {
    sessionState: initialSessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });
  const failOutcome = sketchRuntime.resolveProjectAction('sketch', 'building04_upstairs', offeredActions[0]!, {
    sessionState: initialSessionState,
    actorId: 'player_01',
    viewerId: 'player_01',
  });
  const successOutcome = sketchRuntime.resolveProjectAction('sketch', 'building04_upstairs', offeredActions[0]!, {
    sessionState: {
      ...initialSessionState,
      objects: {
        ...(initialSessionState.objects as Record<string, unknown>),
        night_light: { on: true },
        bedside_lamp: { on: false },
      },
    },
    actorId: 'player_01',
    viewerId: 'player_01',
  });

  assert.equal(offeredActions.length, 1);
  assert.equal(failOutcome.logEntry?.text, 'You do not fall asleep.');
  assert.equal(failOutcome.nextNodeId, undefined);
  assert.equal(successOutcome.logEntry?.text, 'Sweet dreams arrive quickly.');
  assert.equal(successOutcome.nextNodeId, 'game_over_good');
});

test('runtime executes sidecar exit events before traversal completes', () => {
  const sketchRuntime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: sketch_region

exits:
  - id: start
    targetId: building01_groundfloor
    displayName: Start
---

# Title Screen

## enter
The sketch begins here.
`,
    '../../../packages/content/sketch/building01_groundfloor.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: building01_groundfloor
displayName: Building 01 Ground Floor
region: sketch_region

exits:
  - id: leave_room
    targetId: sidewalk_north
    displayName: Leave Room
    key: O
---

# Building 01 Ground Floor

## enter
The room is waiting.
`,
    '../../../packages/content/sketch/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: North Sidewalk
region: sketch_region
---

# North Sidewalk

## enter
The street opens up.
`,
    '../../../packages/content/sketch/building01/events.yaml': `events:
  leave_room_untidied:
    trigger:
      kind: exit
      actor: player
      nodeId: building01_groundfloor
      exitId: leave_room

    when:
      predicate: vase_is_misaligned

    actor:
      - You leave the room with the vase still slightly wrong.

    effects:
      - set: [objects.vase_01.left_misaligned, true]
`,
    '../../../packages/content/sketch/predicates/project.yaml': `predicates:
  vase_is_misaligned:
    equals: [objects.vase_01.aligned, false]
`,
    '../../../packages/content/sketch/state/world.yaml': `objects:
  vase_01:
    aligned: false

player:
  active:
    id: player_01
`,
  });

  const initialSessionState = sketchRuntime.createInitialProjectSessionState('sketch');
  const outcome = sketchRuntime.resolveProjectAction(
    'sketch',
    'building01_groundfloor',
    { id: 'leave_room', kind: 'exit', label: 'Leave Room', key: 'O', keyLabel: '[O]', targetId: 'sidewalk_north' },
    { sessionState: initialSessionState, actorId: 'player_01', viewerId: 'player_01' },
  );

  assert.equal(outcome.nextNodeId, 'sidewalk_north');
  assert.equal(outcome.logEntry?.text, 'You leave the room with the vase still slightly wrong.');
  assert.equal(outcome.sessionState?.objects?.vase_01?.left_misaligned, true);
});

test('runtime skips malformed or schema-less content files without poisoning the project', () => {
  const runtimeWithInvalidFiles = createRuntimeForContentFiles({
    '../../../packages/content/bad/AreaObject.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: good_area
displayName: Good Area

region: bad_region
---

# Good Area

## enter
Still valid.
`,
    '../../../packages/content/bad/MissingSchema.md': `---
version: 1
id: missing_schema
displayName: Missing Schema
---

# Missing Schema
`,
    '../../../packages/content/bad/InvalidArea.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

displayName: Invalid Area
---

# Invalid Area
`,
  });

  assert.deepEqual(Object.keys(runtimeWithInvalidFiles), ['bad']);
  assert.equal(runtimeWithInvalidFiles.bad?.startNodeId, 'good_area');
  assert.deepEqual(runtimeWithInvalidFiles.bad?.nodes, [{ id: 'good_area', label: 'Good Area', region: 'bad_region' }]);
  assert.deepEqual(Object.keys(runtimeWithInvalidFiles.bad?.pagesByNodeId ?? {}), ['good_area']);
});

test('runtime skips a project when title_screen is missing or not connected', () => {
  const runtimeWithInvalidProject = createRuntimeForContentFiles({
    '../../../packages/content/no-start/room.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: room
displayName: Room
region: test_region

exits:
  - id: to_ending
    targetId: game_over_bad
    displayName: East
    key: E
---

# Room

## enter
An ordinary room.
`,
    '../../../packages/content/no-start/game_over_bad.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_bad
displayName: Bad Ending
region: test_region

tags:
  - ending
---

# Bad Ending

## enter
Too late.
`,
  }, { validateProjects: true });

  assert.equal(runtimeWithInvalidProject['no-start'], undefined);
});

test('runtime skips a project when no ending area is connected from the graph', () => {
  const runtimeWithNoEnding = createRuntimeForContentFiles({
    '../../../packages/content/no-ending/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: test_region

exits:
  - id: continue
    targetId: town_square
    displayName: Continue
    key: C
---

# Title Screen

## enter
You can begin, but not finish.
`,
    '../../../packages/content/no-ending/town_square.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: town_square
displayName: Town Square
region: test_region

exits:
  - id: west
    targetId: title_screen
    displayName: West
    key: W
---

# Town Square

## enter
There is no conclusion here.
`,
    '../../../packages/content/no-ending/game_over_good.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: game_over_good
displayName: Good Ending
region: test_region

tags:
  - ending
---

# Good Ending

## enter
But nobody can reach it.
`,
  }, { validateProjects: true });

  assert.equal(runtimeWithNoEnding['no-ending'], undefined);
});

test('numeric shortcut keys survive parsing and remain visible in projected pages', () => {
  const numericKeyRuntime = createRuntimeForContentFiles({
    '../../../packages/content/numeric/AreaObject.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: numeric_entry
displayName: Numeric Entry

region: numeric_region

exits:
  - id: numeric_gate
    targetId: numeric_gate
    displayName: Exit With Numeric Key
    key: 1
---

# Numeric Entry

## enter
Numeric shortcut test.
`,
    '../../../packages/content/numeric/GateObject.md': `---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: numeric_gate
displayName: Numeric Gate

presentationMode: passthrough
region: numeric_region
---

# Numeric Gate
`,
  });

  const page = numericKeyRuntime.numeric?.pagesByNodeId.numeric_entry;

  assert.equal(page?.kind, 'page');

  if (!page || page.kind !== 'page') {
    throw new Error('Expected a page for numeric_entry.');
  }

  assert.equal(page.actions[0]?.key, '1');
  assert.equal(page.actions[0]?.keyLabel, '[1]');
});

test('keyboard shortcut matching is case-insensitive and supports numeric keys', () => {
  const numberPage = project?.pagesByNodeId.test01_entry;
  const letterPage = project?.pagesByNodeId.test02_entry;

  assert.equal(numberPage?.kind, 'page');
  assert.equal(letterPage?.kind, 'page');

  if (!numberPage || numberPage.kind !== 'page') {
    throw new Error('Expected a page for test01_entry.');
  }

  if (!letterPage || letterPage.kind !== 'page') {
    throw new Error('Expected a page for test02_entry.');
  }

  const letterMatch = findMatchingShortcut(letterPage, 'X');
  const numberMatch = findMatchingShortcut(numberPage, '1');

  assert.equal(letterMatch?.kind, 'action');
  assert.equal(letterMatch?.kind === 'action' ? letterMatch.action.id : undefined, 'test02_gate');
  assert.equal(numberMatch?.kind, 'action');
  assert.equal(numberMatch?.kind === 'action' ? numberMatch.action.id : undefined, 'test01_gate');
});

test('recent log keeps repeated lines and still enforces a bounded tail', () => {
  let now = 1000;
  let entries = appendLogEntry(undefined, { id: '1', text: 'It is picked clean.' }, now);
  entries = appendLogEntry(entries, { id: '2', text: 'It is picked clean.' }, now + 500);
  entries = appendLogEntry(entries, { id: '3', text: 'A different line.' }, now + 600);

  assert.deepEqual(entries?.map((entry) => entry.text), ['It is picked clean.', 'It is picked clean.', 'A different line.']);

  for (let index = 0; index < 10; index += 1) {
    now += 10;
    entries = appendLogEntry(entries, { id: `tail-${index}`, text: `Line ${index}` }, now);
  }

  assert.equal(entries?.length, 8);
  assert.deepEqual(entries?.map((entry) => entry.text), [
    'Line 2',
    'Line 3',
    'Line 4',
    'Line 5',
    'Line 6',
    'Line 7',
    'Line 8',
    'Line 9',
  ]);
});

test('recent log replacement on fresh entry drops stale lines from a prior visit', () => {
  const oldEntries = createRecentLogEntries([
    { id: '1', text: 'Daylight flattens the storefronts into a tidy row of surfaces and reflections.' },
    { id: '2', text: 'Out here the whole block feels arranged for inspection.' },
  ], 1000);
  const replacementEntries = createRecentLogEntries([
    { id: '3', text: 'Dusk pulls a copper sheen across the storefront glass and softens the hard edges of the block.' },
    { id: '4', text: 'The whole row feels less inspected now, and more like it is bracing for the night shift.' },
  ], 2000);

  assert.deepEqual(oldEntries?.map((entry) => entry.text), [
    'Daylight flattens the storefronts into a tidy row of surfaces and reflections.',
    'Out here the whole block feels arranged for inspection.',
  ]);
  assert.deepEqual(replacementEntries?.map((entry) => entry.text), [
    'Dusk pulls a copper sheen across the storefront glass and softens the hard edges of the block.',
    'The whole row feels less inspected now, and more like it is bracing for the night shift.',
  ]);
});

test('runtime resolves numbered POI attempt prose and falls back to the latest authored attempt', () => {
  const attemptRuntime = createContentRuntime({
    '../../../packages/content/attempts/AreaObject.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: attempt_area
displayName: Attempt Area

region: old_harbor

pois:
  - id: wildraspberrybush
    displayName: Wild Raspberry Bush
---

# Attempt Area

## enter
First arrival.

## poi:wildraspberrybush:1
First berry check.

## poi:wildraspberrybush:2
Second berry check.
`,
  });

  const page = attemptRuntime.getProjectedPage('attempts', 'attempt_area');

  assert.equal(page?.kind, 'page');

  if (!page || page.kind !== 'page') {
    throw new Error('Expected a page for attempt_area.');
  }

  const poiAction = page.actions.find((action) => action.kind === 'poi' && action.id === 'wildraspberrybush');

  assert.ok(poiAction);
  assert.equal(attemptRuntime.resolveProjectAction('attempts', 'attempt_area', poiAction!, { attempt: 1 }).logEntry?.text, 'First berry check.');
  assert.equal(attemptRuntime.resolveProjectAction('attempts', 'attempt_area', poiAction!, { attempt: 2 }).logEntry?.text, 'Second berry check.');
  assert.equal(attemptRuntime.resolveProjectAction('attempts', 'attempt_area', poiAction!, { attempt: 5 }).logEntry?.text, 'Second berry check.');
});

test('runtime randomly selects between repeated variants for the same numbered POI attempt', () => {
  const originalRandom = Math.random;
  const randomValues = [0.1, 0.2, 0.9, 0.2];
  let randomIndex = 0;

  Math.random = () => {
    const value = randomValues[randomIndex] ?? 0;
    randomIndex += 1;
    return value;
  };

  try {
    const attemptRuntime = createContentRuntime({
      '../../../packages/content/attempts/AreaObject.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: attempt_area
displayName: Attempt Area

region: old_harbor

pois:
  - id: wildraspberrybush
    displayName: Wild Raspberry Bush
---

# Attempt Area

## enter
First arrival.

## poi:wildraspberrybush:2
Variant one.

## poi:wildraspberrybush:2
Variant two.
`,
    });

    const page = attemptRuntime.getProjectedPage('attempts', 'attempt_area');

    assert.equal(page?.kind, 'page');

    if (!page || page.kind !== 'page') {
      throw new Error('Expected a page for attempt_area.');
    }

    const poiAction = page.actions.find((action) => action.kind === 'poi' && action.id === 'wildraspberrybush');

    assert.ok(poiAction);
    assert.equal(attemptRuntime.resolveProjectAction('attempts', 'attempt_area', poiAction!, { attempt: 2 }).logEntry?.text, 'Variant one.');
    assert.equal(attemptRuntime.resolveProjectAction('attempts', 'attempt_area', poiAction!, { attempt: 2 }).logEntry?.text, 'Variant two.');
  } finally {
    Math.random = originalRandom;
  }
});

test('runtime supports weighted selection for repeated numbered POI attempt variants', () => {
  const originalRandom = Math.random;
  const randomValues = [0.1, 0.2, 0.98, 0.2];
  let randomIndex = 0;

  Math.random = () => {
    const value = randomValues[randomIndex] ?? 0;
    randomIndex += 1;
    return value;
  };

  try {
    const attemptRuntime = createContentRuntime({
      '../../../packages/content/attempts/AreaObject.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: attempt_area
displayName: Attempt Area

region: old_harbor

pois:
  - id: adjacenttothetree
    displayName: At the Base of the Tree
---

# Attempt Area

## enter
First arrival.

## poi:adjacenttothetree:1 @weighted @weight=6
There's probably better places to stand though you know you're faster than any heavy branch.

## poi:adjacenttothetree:1 @weighted @weight=1
The thought lands mean and bright: if the branch comes down, you're still faster. Maybe demon fast.
`,
    });

    const page = attemptRuntime.getProjectedPage('attempts', 'attempt_area');

    assert.equal(page?.kind, 'page');

    if (!page || page.kind !== 'page') {
      throw new Error('Expected a page for attempt_area.');
    }

    const poiAction = page.actions.find((action) => action.kind === 'poi' && action.id === 'adjacenttothetree');

    assert.ok(poiAction);
    assert.equal(
      attemptRuntime.resolveProjectAction('attempts', 'attempt_area', poiAction!, { attempt: 1 }).logEntry?.text,
      'There\'s probably better places to stand though you know you\'re faster than any heavy branch.',
    );
    assert.equal(
      attemptRuntime.resolveProjectAction('attempts', 'attempt_area', poiAction!, { attempt: 1 }).logEntry?.text,
      'The thought lands mean and bright: if the branch comes down, you\'re still faster. Maybe demon fast.',
    );
  } finally {
    Math.random = originalRandom;
  }
});

test('runtime preserves fade markers on action log entries', () => {
  const attemptRuntime = createContentRuntime({
    '../../../packages/content/attempts/AreaObject.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: attempt_area
displayName: Attempt Area

region: old_harbor

pois:
  - id: wildraspberrybush
    displayName: Wild Raspberry Bush
---

# Attempt Area

## enter
First arrival.

## poi:wildraspberrybush:1
*Sigh*...
[fade: medium]
`,
  });

  const page = attemptRuntime.getProjectedPage('attempts', 'attempt_area');

  assert.equal(page?.kind, 'page');

  if (!page || page.kind !== 'page') {
    throw new Error('Expected a page for attempt_area.');
  }

  const poiAction = page.actions.find((action) => action.kind === 'poi' && action.id === 'wildraspberrybush');

  assert.ok(poiAction);
  assert.deepEqual(attemptRuntime.resolveProjectAction('attempts', 'attempt_area', poiAction!, { attempt: 1 }).logEntry?.markers, [
    { kind: 'fade', value: 'medium' },
  ]);
});

test('runtime selects first_visit on first arrival and repeat_visit on later arrivals', () => {
  const areaRuntime = createContentRuntime({
    '../../../packages/content/visits/AreaObject.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: visit_area
displayName: Visit Area

region: old_harbor
---

# Visit Area

## enter
Arrival line.

## first_visit
First time here.

## repeat_visit
Later visit one.

## repeat_visit
Later visit two.
`,
  });

  const firstPage = areaRuntime.getProjectedPage('visits', 'visit_area', undefined, { areaVisitCount: 1 });
  const repeatPage = areaRuntime.getProjectedPage('visits', 'visit_area', undefined, { areaVisitCount: 2 });

  assert.equal(firstPage?.kind, 'page');
  assert.equal(repeatPage?.kind, 'page');

  if (!firstPage || firstPage.kind !== 'page' || !repeatPage || repeatPage.kind !== 'page') {
    throw new Error('Expected projected pages for visit_area.');
  }

  assert.deepEqual(firstPage.proseBlocks.map((block) => block.text), ['First time here.', 'Arrival line.']);
  assert.ok(['Later visit one.', 'Later visit two.'].includes(repeatPage.proseBlocks[0]?.text ?? ''));
  assert.equal(repeatPage.proseBlocks[1]?.text, 'Arrival line.');
});

test('runtime selects blocked prose for blocked areas after lifecycle prose', () => {
  const areaRuntime = createContentRuntime({
    '../../../packages/content/visits/BlockedAreaObject.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: blocked_area
displayName: Blocked Area
region: old_harbor

blocking:
  state: blocked
---

# Blocked Area

## first_visit
First look.

## blocked
The way onward is choked off.

## enter
You stop in the narrow lane.
`,
  });

  const firstPage = areaRuntime.getProjectedPage('visits', 'blocked_area', undefined, { areaVisitCount: 1 });
  const repeatPage = areaRuntime.getProjectedPage('visits', 'blocked_area', undefined, { areaVisitCount: 2 });

  assert.equal(firstPage?.kind, 'page');
  assert.equal(repeatPage?.kind, 'page');

  if (!firstPage || firstPage.kind !== 'page' || !repeatPage || repeatPage.kind !== 'page') {
    throw new Error('Expected projected pages for blocked_area.');
  }

  assert.deepEqual(firstPage.proseBlocks.map((block) => block.text), [
    'First look.',
    'The way onward is choked off.',
    'You stop in the narrow lane.',
  ]);
  assert.deepEqual(repeatPage.proseBlocks.map((block) => block.text), [
    'The way onward is choked off.',
    'You stop in the narrow lane.',
  ]);
});

test('runtime cycles enter prose across repeated area arrivals', () => {
  const areaRuntime = createContentRuntime({
    '../../../packages/content/cycle/AreaObject.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: cycle_area
displayName: Cycle Area

region: old_harbor
---

# Cycle Area

## enter @cycle
prose1

## enter @cycle
prose2

## enter @cycle
prose3
`,
  });

  const firstPage = areaRuntime.getProjectedPage('cycle', 'cycle_area', undefined, { areaVisitCount: 1 });
  const secondPage = areaRuntime.getProjectedPage('cycle', 'cycle_area', undefined, { areaVisitCount: 2 });
  const thirdPage = areaRuntime.getProjectedPage('cycle', 'cycle_area', undefined, { areaVisitCount: 3 });
  const fourthPage = areaRuntime.getProjectedPage('cycle', 'cycle_area', undefined, { areaVisitCount: 4 });

  assert.equal(firstPage?.kind, 'page');
  assert.equal(secondPage?.kind, 'page');
  assert.equal(thirdPage?.kind, 'page');
  assert.equal(fourthPage?.kind, 'page');

  if (!firstPage || firstPage.kind !== 'page' || !secondPage || secondPage.kind !== 'page' || !thirdPage || thirdPage.kind !== 'page' || !fourthPage || fourthPage.kind !== 'page') {
    throw new Error('Expected projected pages for cycle_area.');
  }

  assert.equal(firstPage.proseBlocks[0]?.text, 'prose1');
  assert.equal(secondPage.proseBlocks[0]?.text, 'prose2');
  assert.equal(thirdPage.proseBlocks[0]?.text, 'prose3');
  assert.equal(fourthPage.proseBlocks[0]?.text, 'prose1');
});

test('runtime cycles POI prose by attempt count when slot mode is cycle', () => {
  const areaRuntime = createContentRuntime({
    '../../../packages/content/cycle/AreaObject.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: cycle_area
displayName: Cycle Area

region: old_harbor

pois:
  - id: bell
    displayName: Bell
---

# Cycle Area

## enter
Base line.

## poi:bell:1 @cycle
ring1

## poi:bell:1 @cycle
ring2

## poi:bell:1 @cycle
ring3
`,
  });

  const page = areaRuntime.getProjectedPage('cycle', 'cycle_area');

  assert.equal(page?.kind, 'page');

  if (!page || page.kind !== 'page') {
    throw new Error('Expected a page for cycle_area.');
  }

  const poiAction = page.actions.find((action) => action.kind === 'poi' && action.id === 'bell');

  assert.ok(poiAction);
  assert.equal(areaRuntime.resolveProjectAction('cycle', 'cycle_area', poiAction!, { attempt: 1 }).logEntry?.text, 'ring1');
  assert.equal(areaRuntime.resolveProjectAction('cycle', 'cycle_area', poiAction!, { attempt: 2 }).logEntry?.text, 'ring2');
  assert.equal(areaRuntime.resolveProjectAction('cycle', 'cycle_area', poiAction!, { attempt: 3 }).logEntry?.text, 'ring3');
  assert.equal(areaRuntime.resolveProjectAction('cycle', 'cycle_area', poiAction!, { attempt: 4 }).logEntry?.text, 'ring1');
});

test('stable projected page resolver does not refresh visible prose when POI log updates append on the same node', () => {
  let resolveCount = 0;

  const resolver = createStableProjectedPageResolver((projectId, nodeId) => {
    resolveCount += 1;

    return {
      kind: 'page',
      nodeId: nodeId ?? 'node',
      nodeKind: 'area',
      title: `${projectId}-${resolveCount}`,
      proseBlocks: [
        {
          kind: 'paragraph',
          text: `visible-${resolveCount}`,
        },
      ],
      actions: [],
      controls: [],
    };
  });

  const firstPage = resolver.resolvePage('demo', 'sunbleached_tree', undefined, 1, undefined, undefined, undefined, undefined);
  const secondPage = resolver.resolvePage('demo', 'sunbleached_tree', undefined, 1, undefined, undefined, undefined, [
    {
      id: 'log-1',
      text: 'look closer',
    },
  ]);

  assert.equal(resolveCount, 1);
  assert.equal(firstPage?.kind, 'page');
  assert.equal(secondPage?.kind, 'page');

  if (!firstPage || firstPage.kind !== 'page' || !secondPage || secondPage.kind !== 'page') {
    throw new Error('Expected projected pages from the stable resolver.');
  }

  assert.equal(firstPage.proseBlocks[0]?.text, 'visible-1');
  assert.equal(secondPage.proseBlocks[0]?.text, 'visible-1');
  assert.equal(secondPage.recentLog?.[0]?.text, 'look closer');
});

test('stable projected page resolver appends visible-lane log entries into page prose instead of recent', () => {
  const resolver = createStableProjectedPageResolver(() => ({
    kind: 'page',
    nodeId: 'sunbleached_tree',
    nodeKind: 'area',
    title: 'Stable test',
    proseBlocks: [
      {
        kind: 'paragraph',
        text: 'visible-1',
      },
    ],
    actions: [],
    controls: [],
  }));

  const page = resolver.resolvePage('demo', 'sunbleached_tree', undefined, 1, undefined, undefined, undefined, [
    {
      id: 'log-1',
      text: 'You take a closer look.',
      lane: 'visible',
    },
  ]);

  assert.equal(page?.kind, 'page');

  if (!page || page.kind !== 'page') {
    throw new Error('Expected projected page from the stable resolver.');
  }

  assert.deepEqual(page.proseBlocks.map((block) => block.text), ['visible-1', 'You take a closer look.']);
  assert.equal(page.recentLog, undefined);
});

test('stable projected page resolver refreshes visible prose after an actual area revisit', () => {
  let resolveCount = 0;

  const resolver = createStableProjectedPageResolver((_projectId, nodeId, _pathDirection, options) => {
    resolveCount += 1;

    return {
      kind: 'page',
      nodeId: nodeId ?? 'node',
      nodeKind: 'area',
      title: 'Stable test',
      proseBlocks: [
        {
          kind: 'paragraph',
          text: `visit-${options?.areaVisitCount ?? 0}`,
        },
      ],
      actions: [],
      controls: [],
    };
  });

  const firstPage = resolver.resolvePage('demo', 'sunbleached_tree', undefined, 1, undefined, undefined, undefined, undefined);
  const revisitPage = resolver.resolvePage('demo', 'sunbleached_tree', undefined, 2, undefined, undefined, undefined, undefined);

  assert.equal(resolveCount, 2);
  assert.equal(firstPage?.kind, 'page');
  assert.equal(revisitPage?.kind, 'page');

  if (!firstPage || firstPage.kind !== 'page' || !revisitPage || revisitPage.kind !== 'page') {
    throw new Error('Expected projected pages from the stable resolver.');
  }

  assert.equal(firstPage.proseBlocks[0]?.text, 'visit-1');
  assert.equal(revisitPage.proseBlocks[0]?.text, 'visit-2');
});

test('projected page render key changes when a run reset replays the same node and visit count', () => {
  const firstRunKey = buildProjectedPageRenderKey({
    projectId: 'demo',
    nodeId: 'sunbleached_tree',
    pathDirection: undefined,
    areaVisitCount: 1,
    runNonce: 0,
  });
  const resetRunKey = buildProjectedPageRenderKey({
    projectId: 'demo',
    nodeId: 'sunbleached_tree',
    pathDirection: undefined,
    areaVisitCount: 1,
    runNonce: 1,
  });

  assert.notEqual(firstRunKey, resetRunKey);
});

test('projected page render key changes when the page revision changes on the same node', () => {
  const openHoursKey = buildProjectedPageRenderKey({
    projectId: 'demo04',
    nodeId: 'building03groundfloor_sidewalk_east',
    pathDirection: 'backward',
    areaVisitCount: 1,
    runNonce: 0,
    revisionKey: JSON.stringify({ phase: 'dusk' }),
  });
  const closedHoursKey = buildProjectedPageRenderKey({
    projectId: 'demo04',
    nodeId: 'building03groundfloor_sidewalk_east',
    pathDirection: 'backward',
    areaVisitCount: 1,
    runNonce: 0,
    revisionKey: JSON.stringify({ phase: 'night' }),
  });

  assert.notEqual(openHoursKey, closedHoursKey);
});

test('runtime projected page includes live npc idle prose from session state', () => {
  const runtime = createContentRuntime({
    '../../../packages/content/sketch/title_screen.md': `---
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
The sketch begins here.
`,
    '../../../packages/content/sketch/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: Sidewalk North
region: sketch_region
---

# Sidewalk North

## enter
You stand on the north stretch of the block.
`,
    '../../../packages/content/sketch/npcs/walker_01.yaml': `id: walker_01
displayName: Block Walker
location: sidewalk_north

idle:
  activeMode: strolling

  modes:
    strolling:
      default:
        shared:
          - A walker lingers here long enough to notice you noticing them.
`,
    '../../../packages/content/sketch/state/world.yaml': `player:
  active:
    id: player_01

players:
  player_01:
    location: sidewalk_north

npcs:
  walker_01:
    location: sidewalk_north
`,
  });

  const presentPage = runtime.getProjectedPage('sketch', 'sidewalk_north', undefined, {
    sessionState: runtime.createInitialProjectSessionState('sketch'),
  });
  const absentPage = runtime.getProjectedPage('sketch', 'sidewalk_north', undefined, {
    sessionState: {
      ...runtime.createInitialProjectSessionState('sketch'),
      npcs: {
        walker_01: {
          location: 'sidewalk_east',
        },
      },
    },
  });

  assert.equal(presentPage?.kind, 'page');
  assert.equal(absentPage?.kind, 'page');

  if (!presentPage || presentPage.kind !== 'page' || !absentPage || absentPage.kind !== 'page') {
    throw new Error('Expected projected pages for npc idle prose test.');
  }

  assert.ok(presentPage.proseBlocks.some((block) => block.text === 'A walker lingers here long enough to notice you noticing them.'));
  assert.ok(!absentPage.proseBlocks.some((block) => block.text === 'A walker lingers here long enough to notice you noticing them.'));
});

test('runtime projected page does not append live weather prose directly to node content', () => {
  const runtime = createContentRuntime({
    '../../../packages/content/weatherbox/title_screen.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: block

exits:
  - id: start
    targetId: sidewalk_north
    displayName: Start
---

# Title Screen

## enter
Begin.
`,
    '../../../packages/content/weatherbox/sidewalk_north.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sidewalk_north
displayName: Sidewalk North
region: block
---

# Sidewalk North

## enter
You wait on the curb.
`,
    '../../../packages/content/weatherbox/settings/weather.yaml': `patterns:
  block_weather:
    steps:
      - id: rain_light
        kind: rain
        intensity: light
        statusText:
          - A light rain traces the curb.

assignments:
  defaultPattern: block_weather
  regions:
    block: block_weather

visibility:
  defaultRecentLog: false
  regions:
    block: true
`,
  }, {
    weatherSource: {
      getSnapshot(project, nodeId, nodeRegion) {
        return {
          patternId: 'block_weather',
          stepId: 'rain_light',
          kind: 'rain',
          intensity: 'light',
          regionId: nodeRegion ?? (nodeId ? project.nodeRegionsById[nodeId] : undefined),
          visibleInRecentLog: true,
          statusText: ['A light rain traces the curb.'],
          source: 'test',
        };
      },
    },
  });

  const page = runtime.getProjectedPage('weatherbox', 'sidewalk_north');

  assert.equal(page?.kind, 'page');

  if (!page || page.kind !== 'page') {
    throw new Error('Expected projected page for weather prose test.');
  }

  assert.ok(!page.proseBlocks.some((block) => block.text === 'A light rain traces the curb.'));
});

test('demo04 building03 sidewalk-facing gate exposes day-only entry and night-only lockout behavior', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return {
          phase: 'day',
          source: 'test',
        };
      },
    },
  });
  const initialSessionState = demoRuntime.createInitialProjectSessionState('demo04');
  const activePlayerId = 'player_01';
  const sidewalkPage = demoRuntime.getProjectedPage('demo04', 'sidewalk_east');

  assert.equal(sidewalkPage?.kind, 'page');

  if (!sidewalkPage || sidewalkPage.kind !== 'page') {
    throw new Error('Expected page for sidewalk_east.');
  }

  const towardDoor = sidewalkPage.actions.find((action) => action.kind === 'exit' && action.targetId === 'building03groundfloor_sidewalk_east');

  assert.ok(towardDoor);

  const gateArrival = demoRuntime.resolveProjectAction('demo04', 'sidewalk_east', towardDoor!, {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });

  assert.equal(gateArrival.nextNodeId, 'building03groundfloor_sidewalk_east');
  assert.equal(gateArrival.nextPathDirection, 'backward');

  const gateEnter = demoRuntime.resolveProjectEnter('demo04', 'building03groundfloor_sidewalk_east', {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });

  assert.equal(gateEnter.logEntry?.text, 'The door stands open and unlocked right now.');

  const gatePage = demoRuntime.getProjectedPage('demo04', 'building03groundfloor_sidewalk_east', 'backward');

  assert.equal(gatePage?.kind, 'page');

  if (!gatePage || gatePage.kind !== 'page') {
    throw new Error('Expected page for building03 gate.');
  }

  const businessHoursAction = gatePage.actions.find((action) => action.kind === 'poi' && action.id === 'business_hours');

  assert.ok(businessHoursAction);

  const businessHoursOutcome = demoRuntime.resolveProjectAction('demo04', 'building03groundfloor_sidewalk_east', businessHoursAction!, {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });

  assert.equal(businessHoursOutcome.logEntry?.text, 'Open all day. Closed at night. Right now the place is open.');

  const offeredActions = demoRuntime.getOfferedActions('demo04', 'building03groundfloor_sidewalk_east', {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });
  const enterBuildingAction = offeredActions.find((action) => action.id === 'enter_building03');

  assert.ok(enterBuildingAction);

  const enterBuildingOutcome = demoRuntime.resolveProjectAction('demo04', 'building03groundfloor_sidewalk_east', enterBuildingAction!, {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });

  assert.equal(enterBuildingOutcome.nextNodeId, 'building03_groundfloor');
});

test('demo04 building03 ground floor exit now stops on the door gate before the sidewalk', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo04'));
  const initialSessionState = demoRuntime.createInitialProjectSessionState('demo04');
  const activePlayerId = 'player_01';
  const groundFloorPage = demoRuntime.getProjectedPage('demo04', 'building03_groundfloor');

  assert.equal(groundFloorPage?.kind, 'page');

  if (!groundFloorPage || groundFloorPage.kind !== 'page') {
    throw new Error('Expected ground floor page for building03.');
  }

  const exitToDoor = groundFloorPage.actions.find((action) => action.kind === 'exit' && action.id === 'building03_to_east');

  assert.ok(exitToDoor);

  const exitOutcome = demoRuntime.resolveProjectAction('demo04', 'building03_groundfloor', exitToDoor!, {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });

  assert.equal(exitOutcome.nextNodeId, 'building03groundfloor_sidewalk_east');
  assert.equal(exitOutcome.nextPathDirection, 'forward');

  const forwardGatePage = demoRuntime.getProjectedPage('demo04', 'building03groundfloor_sidewalk_east', 'forward');

  assert.equal(forwardGatePage?.kind, 'page');

  if (!forwardGatePage || forwardGatePage.kind !== 'page') {
    throw new Error('Expected forward-facing gate page for building03 door.');
  }

  assert.equal(
    forwardGatePage.proseBlocks[0]?.text,
    'The east-side door stands right there with the sidewalk beyond it, close enough to leave through without quite being outside yet.',
  );
});

test('demo04 building03 door back control returns to the side you are standing on', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo04'));
  const backwardGatePage = demoRuntime.getProjectedPage('demo04', 'building03groundfloor_sidewalk_east', 'backward');
  const forwardGatePage = demoRuntime.getProjectedPage('demo04', 'building03groundfloor_sidewalk_east', 'forward');

  assert.equal(backwardGatePage?.kind, 'page');
  assert.equal(forwardGatePage?.kind, 'page');

  if (!backwardGatePage || backwardGatePage.kind !== 'page' || !forwardGatePage || forwardGatePage.kind !== 'page') {
    throw new Error('Expected gate pages for building03 door.');
  }

  const backwardBackControl = backwardGatePage.controls.find((control) => control.kind === 'back');
  const forwardBackControl = forwardGatePage.controls.find((control) => control.kind === 'back');

  assert.ok(backwardBackControl);
  assert.ok(forwardBackControl);

  const backwardOutcome = demoRuntime.resolveProjectControl('demo04', 'building03groundfloor_sidewalk_east', 'backward', backwardBackControl!);
  const forwardOutcome = demoRuntime.resolveProjectControl('demo04', 'building03groundfloor_sidewalk_east', 'forward', forwardBackControl!);

  assert.equal(backwardOutcome.nextNodeId, 'sidewalk_east');
  assert.equal(forwardOutcome.nextNodeId, 'building03_groundfloor');
});

test('demo04 building03 night behavior forces interiors outside and keeps the sidewalk gate closed', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return {
          phase: 'night',
          source: 'test',
        };
      },
    },
  });
  const initialSessionState = demoRuntime.createInitialProjectSessionState('demo04');
  const activePlayerId = 'player_01';

  const downstairsNightEnter = demoRuntime.resolveProjectEnter('demo04', 'building03_groundfloor', {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });
  const upstairsNightEnter = demoRuntime.resolveProjectEnter('demo04', 'building03_upstairs', {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });

  assert.equal(downstairsNightEnter.nextNodeId, 'building03groundfloor_sidewalk_east');
  assert.equal(downstairsNightEnter.nextPathDirection, 'backward');
  assert.deepEqual(
    downstairsNightEnter.logEntry?.blocks?.map((block) => block.text),
    [
      'The room gives you only a blink of interior shadow before the closed door and the tight layout push the visit back outside.',
      '*boink!*',
    ],
  );
  assert.equal(upstairsNightEnter.nextNodeId, 'building03groundfloor_sidewalk_east');
  assert.equal(upstairsNightEnter.nextPathDirection, 'backward');
  assert.deepEqual(
    upstairsNightEnter.logEntry?.blocks?.map((block) => block.text),
    [
      'Upstairs feels unavailable while the door is closed. A moment later you are back out at the door.',
      '*boink!*',
    ],
  );

  const gateEnter = demoRuntime.resolveProjectEnter('demo04', 'building03groundfloor_sidewalk_east', {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });

  assert.equal(gateEnter.logEntry?.text, 'The door is shut and locked right now.');

  const gatePage = demoRuntime.getProjectedPage('demo04', 'building03groundfloor_sidewalk_east', 'backward');

  assert.equal(gatePage?.kind, 'page');

  if (!gatePage || gatePage.kind !== 'page') {
    throw new Error('Expected page for building03 gate at night.');
  }

  const businessHoursAction = gatePage.actions.find((action) => action.kind === 'poi' && action.id === 'business_hours');

  assert.ok(businessHoursAction);

  const businessHoursOutcome = demoRuntime.resolveProjectAction('demo04', 'building03groundfloor_sidewalk_east', businessHoursAction!, {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });

  assert.equal(businessHoursOutcome.logEntry?.text, 'Open all day. Closed at night. Right now the place is closed.');
  assert.deepEqual(
    demoRuntime.getOfferedActions('demo04', 'building03groundfloor_sidewalk_east', {
      sessionState: initialSessionState,
      actorId: activePlayerId,
      viewerId: activePlayerId,
    }).map((action) => action.id),
    [],
  );
});

test('demo04 building03 gate still answers business hours and allows entry at dusk', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo04'), {
    clockSource: {
      getSnapshot() {
        return {
          phase: 'dusk',
          source: 'test',
        };
      },
    },
  });
  const initialSessionState = demoRuntime.createInitialProjectSessionState('demo04');
  const activePlayerId = 'player_01';
  const gateEnter = demoRuntime.resolveProjectEnter('demo04', 'building03groundfloor_sidewalk_east', {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });

  assert.equal(gateEnter.logEntry?.text, 'The door stands open and unlocked right now.');

  const gatePage = demoRuntime.getProjectedPage('demo04', 'building03groundfloor_sidewalk_east', 'backward');

  assert.equal(gatePage?.kind, 'page');

  if (!gatePage || gatePage.kind !== 'page') {
    throw new Error('Expected page for building03 gate at dusk.');
  }

  const businessHoursAction = gatePage.actions.find((action) => action.kind === 'poi' && action.id === 'business_hours');

  assert.ok(businessHoursAction);

  const businessHoursOutcome = demoRuntime.resolveProjectAction('demo04', 'building03groundfloor_sidewalk_east', businessHoursAction!, {
    sessionState: initialSessionState,
    actorId: activePlayerId,
    viewerId: activePlayerId,
  });

  assert.equal(businessHoursOutcome.logEntry?.text, 'Open all day. Closed at night. Right now the place is open.');
  assert.deepEqual(
    demoRuntime.getOfferedActions('demo04', 'building03groundfloor_sidewalk_east', {
      sessionState: initialSessionState,
      actorId: activePlayerId,
      viewerId: activePlayerId,
    }).map((action) => action.id),
    ['enter_building03'],
  );
});

test('stable projected page resolver refreshes visible prose after a session-state revision change', () => {
  let resolveCount = 0;

  const resolver = createStableProjectedPageResolver((_projectId, nodeId, _pathDirection, options) => {
    resolveCount += 1;

    return {
      kind: 'page',
      nodeId: nodeId ?? 'node',
      nodeKind: 'area',
      title: 'Session test',
      proseBlocks: [
        {
          kind: 'paragraph',
          text: typeof options?.sessionState?.npcs === 'object'
            && options.sessionState.npcs !== null
            && !Array.isArray(options.sessionState.npcs)
            && typeof (options.sessionState.npcs as Record<string, unknown>).walker_01 === 'object'
            && (options.sessionState.npcs as Record<string, { location?: string }>).walker_01 !== null
            ? (options.sessionState.npcs as Record<string, { location?: string }>).walker_01?.location ?? 'none'
            : 'none',
        },
      ],
      actions: [],
      controls: [],
    };
  });

  const firstSessionState = { npcs: { walker_01: { location: 'sidewalk_north' } } };
  const secondSessionState = { npcs: { walker_01: { location: 'sidewalk_east' } } };
  const firstPage = resolver.resolvePage('demo', 'sidewalk_north', undefined, 1, undefined, undefined, firstSessionState, undefined, JSON.stringify(firstSessionState));
  const secondPage = resolver.resolvePage('demo', 'sidewalk_north', undefined, 1, undefined, undefined, secondSessionState, undefined, JSON.stringify(secondSessionState));

  assert.equal(resolveCount, 2);
  assert.equal(firstPage?.kind, 'page');
  assert.equal(secondPage?.kind, 'page');

  if (!firstPage || firstPage.kind !== 'page' || !secondPage || secondPage.kind !== 'page') {
    throw new Error('Expected projected pages from the stable resolver session test.');
  }

  assert.equal(firstPage.proseBlocks[0]?.text, 'sidewalk_north');
  assert.equal(secondPage.proseBlocks[0]?.text, 'sidewalk_east');
});

test('runtime surfaces per-project weather settings from authored settings sidecar', () => {
  const demoRuntime = createContentRuntime(loadProjectFiles('demo04'));

  assert.equal(demoRuntime.runtime.demo04?.weatherSettings?.assignments?.defaultPattern, 'block_weather');
  assert.equal(demoRuntime.runtime.demo04?.weatherSettings?.visibility?.regions?.diorama_block, true);
  assert.equal(demoRuntime.runtime.demo04?.weatherSettings?.visibility?.nodes?.building01_groundfloor, false);
  assert.equal(demoRuntime.runtime.demo04?.weatherSettings?.visibility?.nodes?.building04_groundfloor, false);
});