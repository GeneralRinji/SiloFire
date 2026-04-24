import test from 'node:test';
import assert from 'node:assert/strict';

import { createRuntimeSessionServiceForContentFiles } from '../../../packages/runtime-server/src';

test('runtime session service owns first-visit and repeat-visit progression', () => {
  const service = createRuntimeSessionServiceForContentFiles({
    '../../../packages/content/visits/visit_area.md': `---
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
    '../../../packages/content/visits/second_area.md': `---
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
  });

  const firstView = service.createSession('visits', { nodeId: 'visit_area' });

  assert.equal(firstView?.page?.kind, 'page');

  if (!firstView || !firstView.page || firstView.page.kind !== 'page') {
    throw new Error('Expected an initial page for visit_area.');
  }

  assert.deepEqual(firstView.page.proseBlocks.map((block) => block.text), ['First time here.', 'Arrival line.']);
  assert.equal(firstView.snapshot.areaVisitCounts.visit_area, 1);

  const onwardAction = firstView.page.actions.find((action) => action.id === 'onward');

  if (!onwardAction) {
    throw new Error('Expected onward action on visit_area.');
  }

  const secondView = service.applyAction(firstView.snapshot.sessionId, onwardAction);

  assert.equal(secondView?.page?.kind, 'page');

  if (!secondView || !secondView.page || secondView.page.kind !== 'page') {
    throw new Error('Expected a page for second_area.');
  }

  const returnAction = secondView.page.actions.find((action) => action.id === 'return');

  if (!returnAction) {
    throw new Error('Expected return action on second_area.');
  }

  const repeatView = service.applyAction(firstView.snapshot.sessionId, returnAction);

  assert.equal(repeatView?.page?.kind, 'page');

  if (!repeatView || !repeatView.page || repeatView.page.kind !== 'page') {
    throw new Error('Expected a repeated page for visit_area.');
  }

  assert.deepEqual(repeatView.page.proseBlocks.map((block) => block.text), ['Later visit.', 'Arrival line.']);
  assert.equal(repeatView.snapshot.areaVisitCounts.visit_area, 2);
});

test('runtime session service owns action attempt counts', () => {
  const service = createRuntimeSessionServiceForContentFiles({
    '../../../packages/content/attempts/attempt_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: attempt_area
displayName: Attempt Area
region: old_harbor

pois:
  - id: berries
    displayName: Inspect Berries
---

# Attempt Area

## poi:berries:1
First berry check.

## poi:berries:2
Second berry check.
`,
  });

  const firstView = service.createSession('attempts');

  assert.equal(firstView?.page?.kind, 'page');

  if (!firstView || !firstView.page || firstView.page.kind !== 'page') {
    throw new Error('Expected an initial page for attempt_area.');
  }

  const poiAction = firstView.page.actions.find((action) => action.id === 'berries');

  if (!poiAction) {
    throw new Error('Expected berries POI action.');
  }

  const secondView = service.applyAction(firstView.snapshot.sessionId, poiAction);
  const thirdView = service.applyAction(firstView.snapshot.sessionId, poiAction);

  assert.equal(secondView?.snapshot.actionAttemptsByNodeId.attempt_area?.['poi:berries'], 1);
  assert.equal(thirdView?.snapshot.actionAttemptsByNodeId.attempt_area?.['poi:berries'], 2);
  assert.equal(secondView?.page?.kind, 'page');
  assert.equal(thirdView?.page?.kind, 'page');

  if (!secondView?.page || secondView.page.kind !== 'page' || !thirdView?.page || thirdView.page.kind !== 'page') {
    throw new Error('Expected projected pages after repeated berries inspection.');
  }

  const secondLog = secondView.snapshot.recentLogByNodeId.attempt_area?.[secondView.snapshot.recentLogByNodeId.attempt_area.length - 1];
  const thirdLog = thirdView.snapshot.recentLogByNodeId.attempt_area?.[thirdView.snapshot.recentLogByNodeId.attempt_area.length - 1];

  assert.equal(secondLog?.text, 'First berry check.');
  assert.equal(thirdLog?.text, 'Second berry check.');
});

test('runtime session service clears node recent log when revisiting a node', () => {
  const service = createRuntimeSessionServiceForContentFiles({
    '../../../packages/content/revisit/visit_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: visit_area
displayName: Visit Area
region: old_harbor

pois:
  - id: sign
    displayName: Read Sign

exits:
  - id: onward
    targetId: second_area
    displayName: Move On
---

# Visit Area

## enter
Arrival line.

## poi:sign
You read the sign.
`,
    '../../../packages/content/revisit/second_area.md': `---
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
  });

  const firstView = service.createSession('revisit', { nodeId: 'visit_area' });

  assert.equal(firstView?.page?.kind, 'page');

  if (!firstView?.page || firstView.page.kind !== 'page') {
    throw new Error('Expected an initial page for revisit test.');
  }

  const signAction = firstView.page.actions.find((action) => action.id === 'sign');
  const onwardAction = firstView.page.actions.find((action) => action.id === 'onward');

  if (!signAction || !onwardAction) {
    throw new Error('Expected sign and onward actions on visit_area.');
  }

  const afterPoiView = service.applyAction(firstView.snapshot.sessionId, signAction);

  if (!afterPoiView?.page || afterPoiView.page.kind !== 'page') {
    throw new Error('Expected page after POI action.');
  }

  assert.notEqual(afterPoiView.page.proseBlocks.some((block) => block.text === 'You read the sign.'), true);
  assert.equal(afterPoiView.page.recentLog?.some((entry) => entry.text === 'You read the sign.'), true);

  const secondView = service.applyAction(firstView.snapshot.sessionId, onwardAction);

  if (!secondView?.page || secondView.page.kind !== 'page') {
    throw new Error('Expected second area page.');
  }

  const returnAction = secondView.page.actions.find((action) => action.id === 'return');

  if (!returnAction) {
    throw new Error('Expected return action on second_area.');
  }

  const revisitView = service.applyAction(firstView.snapshot.sessionId, returnAction);

  if (!revisitView?.page || revisitView.page.kind !== 'page') {
    throw new Error('Expected revisit page for visit_area.');
  }

  assert.notEqual(revisitView.page.proseBlocks.some((block) => block.text === 'You read the sign.'), true);
  assert.notEqual(revisitView.page.recentLog?.some((entry) => entry.text === 'You read the sign.'), true);
});

test('runtime session service reset returns to the title screen for mid-game single-save sessions', () => {
  const service = createRuntimeSessionServiceForContentFiles({
    '../../../packages/content/reset/title_screen.md': `---
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
    targetId: middle_area
    displayName: Begin
---

# Title Screen

## enter
Fresh start.
`,
    '../../../packages/content/reset/middle_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: middle_area
displayName: Middle Area
region: old_harbor

exits:
  - id: ending
    targetId: ending_area
    displayName: Finish
---

# Middle Area

## enter
Testing room.
`,
    '../../../packages/content/reset/ending_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: ending_area
displayName: Ending Area
region: old_harbor
---

# Ending Area

## ending
The end.
`,
  });

  const titleView = service.createSession('reset');

  if (!titleView?.page || titleView.page.kind !== 'page') {
    throw new Error('Expected title screen page.');
  }

  const beginAction = titleView.page.actions.find((action) => action.id === 'begin');

  if (!beginAction) {
    throw new Error('Expected begin exit on title screen.');
  }

  const middleView = service.applyAction(titleView.snapshot.sessionId, beginAction);

  if (!middleView?.page || middleView.page.kind !== 'page') {
    throw new Error('Expected middle area page.');
  }

  assert.equal(middleView.page.nodeId, 'middle_area');

  const resetView = service.resetSession(titleView.snapshot.sessionId);

  if (!resetView?.page || resetView.page.kind !== 'page') {
    throw new Error('Expected page after reset.');
  }

  assert.equal(resetView.page.nodeId, 'title_screen');
  assert.equal(resetView.snapshot.route.nodeId, 'title_screen');
  assert.equal(resetView.snapshot.route.runNonce, 1);
  assert.equal(resetView.snapshot.areaVisitCounts.title_screen, 1);
});

test('runtime session service reset stays on title screen when already at title', () => {
  const service = createRuntimeSessionServiceForContentFiles({
    '../../../packages/content/resettitle/title_screen.md': `---
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
    targetId: middle_area
    displayName: Begin
---

# Title Screen

## enter
Fresh start.
`,
    '../../../packages/content/resettitle/middle_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: middle_area
displayName: Middle Area
region: old_harbor

exits:
  - id: ending
    targetId: ending_area
    displayName: Finish
---

# Middle Area

## enter
Testing room.
`,
    '../../../packages/content/resettitle/ending_area.md': `---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: ending_area
displayName: Ending Area
region: old_harbor
---

# Ending Area

## ending
The end.
`,
  });

  const titleView = service.createSession('resettitle');

  if (!titleView?.page || titleView.page.kind !== 'page') {
    throw new Error('Expected title screen page.');
  }

  const resetView = service.resetSession(titleView.snapshot.sessionId);

  if (!resetView?.page || resetView.page.kind !== 'page') {
    throw new Error('Expected title screen page after reset.');
  }

  assert.equal(resetView.page.nodeId, 'title_screen');
  assert.equal(resetView.snapshot.route.nodeId, 'title_screen');
  assert.equal(resetView.snapshot.route.runNonce, 1);
});