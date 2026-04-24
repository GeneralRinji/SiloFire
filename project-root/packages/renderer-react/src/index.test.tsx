import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ProjectionResult } from '../../projection/src';
import { ProjectedPageView } from './components/ProjectedPageView';
import { AUTO_PROSE_GROUP_DELAY_MS, ProseBlocks, buildProseUpdatePlan, createScheduledBlocks } from './components/ProseBlocks';

test('ProjectedPageView renders area navigation sections for area pages', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'sunbleached_tree',
    nodeKind: 'area',
    title: "Big O' Sunbleached Tree",
    tagline: 'Creaking above the path in the harbor wind.',
    proseBlocks: [
      {
        kind: 'paragraph',
        text: 'You hear children in the distance fading.',
      },
    ],
    actions: [
      {
        id: 'wildraspberrybush',
        kind: 'poi',
        label: 'Wild Raspberry Bush',
        key: 'W',
        keyLabel: '[W]',
      },
      {
        id: 'walk',
        kind: 'choice',
        label: "I'd rather walk",
        key: 'A',
        keyLabel: '[A]',
      },
      {
        id: 'harbor_edge',
        kind: 'exit',
        label: 'Back to Harbor Edge Road',
        key: 'H',
        keyLabel: '[H]',
        targetId: 'harbor_edge',
      },
    ],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Area Navigation/);
  assert.match(html, /Points Of Interest/);
  assert.match(html, /Choices/);
  assert.match(html, /Exits/);
  assert.match(html, /Recent/);
  assert.doesNotMatch(html, /No recent entries yet/);
  assert.match(html, /Back to Harbor Edge Road/);
});

test('ProjectedPageView uses authored area navigation label overrides when present', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'sunbleached_tree',
    nodeKind: 'area',
    title: "Big O' Sunbleached Tree",
    proseBlocks: [],
    areaNavigationLabels: {
      pois: 'Things To Check',
      choices: 'What You Do',
      exits: 'Ways Out',
    },
    actions: [
      {
        id: 'wildraspberrybush',
        kind: 'poi',
        label: 'Wild Raspberry Bush',
        key: 'W',
        keyLabel: '[W]',
      },
      {
        id: 'walk',
        kind: 'choice',
        label: "I'd rather walk",
        key: 'A',
        keyLabel: '[A]',
      },
      {
        id: 'harbor_edge',
        kind: 'exit',
        label: 'Back to Harbor Edge Road',
        key: 'H',
        keyLabel: '[H]',
        targetId: 'harbor_edge',
      },
    ],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Things To Check/);
  assert.match(html, /What You Do/);
  assert.match(html, /Ways Out/);
  assert.doesNotMatch(html, />Points Of Interest</);
  assert.doesNotMatch(html, />Choices</);
  assert.doesNotMatch(html, />Exits</);
});

test('ProjectedPageView hides navigation headings when an authored label is [none]', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'title_screen',
    nodeKind: 'area',
    title: 'My Awesome Game',
    proseBlocks: [],
    areaNavigationLabels: {
      exits: '[none]',
    },
    actions: [
      {
        id: 'continue',
        kind: 'exit',
        label: 'Continue',
        key: 'C',
        keyLabel: '[C]',
        meta: 'Last: Sunbleached Tree | 2m ago',
        targetId: 'titlescreen_sunbleachedtree',
      },
    ],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.doesNotMatch(html, /Area Navigation/);
  assert.doesNotMatch(html, />Exits</);
  assert.match(html, /Continue/);
  assert.match(html, /Last: Sunbleached Tree \| 2m ago/);
  assert.doesNotMatch(html, /titlescreen_sunbleachedtree/);
});

test('ProjectedPageView renders recent log entries inside the recent panel', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'sunbleached_tree',
    nodeKind: 'area',
    title: "Big O' Sunbleached Tree",
    proseBlocks: [],
    recentLog: [
      {
        id: 'log-1',
        text: '*Sigh*... It is picked clean by smaller hands.',
        blocks: [
          {
            kind: 'paragraph',
            text: '*Sigh*... It is picked clean by smaller hands.',
            markers: [{ kind: 'fade', value: 'out medium' }],
          },
        ],
      },
    ],
    actions: [],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Recent/);
  assert.match(html, /recent-log__block--fade-out/);
  assert.match(html, /--fade-out-duration:1800ms/);
  assert.match(html, /<em><span>Sigh<\/span><\/em><span>\.\.\. It is picked clean by smaller hands\.<\/span>/);
  assert.doesNotMatch(html, /No recent entries yet/);
});

test('ProjectedPageView preserves inline markdown in event-style private recent log text', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'building01_groundfloor',
    nodeKind: 'area',
    title: 'Building 01 Ground Floor',
    proseBlocks: [],
    recentLog: [
      {
        id: 'log-event-1',
        text: 'Another cheap clay imitation. There are too many of those on this block. *Sigh*.',
        blocks: [
          {
            groupId: 'private',
            kind: 'paragraph',
            text: 'Another cheap clay imitation. There are too many of those on this block. *Sigh*.',
          },
        ],
      },
    ],
    actions: [],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Another cheap clay imitation\. There are too many of those on this block\./);
  assert.match(html, /<em><span>Sigh<\/span><\/em><span>\.<\/span>/);
});

test('ProjectedPageView delays recent log entries when a delay marker is present', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'fish_shop_front',
    nodeKind: 'gate',
    title: 'Fishmonger Shop Door',
    proseBlocks: [],
    recentLog: [
      {
        id: 'log-1',
        text: 'Closed.\n\nPermanently.',
        blocks: [
          {
            kind: 'paragraph',
            text: 'Closed.',
          },
          {
            kind: 'paragraph',
            text: 'Permanently.',
            markers: [{ kind: 'delay', value: 'long' }],
          },
        ],
      },
    ],
    actions: [],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Closed\./);
  assert.doesNotMatch(html, /Permanently\./);
});

test('ProjectedPageView keeps navigation visible by default even when prose uses delays', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'shack_run2',
    nodeKind: 'area',
    title: 'Shack Run',
    proseBlocks: [
      {
        kind: 'paragraph',
        text: 'Loose siding ticks in the wind.',
      },
      {
        kind: 'paragraph',
        text: 'Something heavy creaks ahead.',
        markers: [{ kind: 'delay', value: 'long' }],
      },
    ],
    actions: [
      {
        id: 'dilapidated_shop',
        kind: 'exit',
        label: 'Dilapidated Shop',
        key: 'D',
        keyLabel: '[D]',
        targetId: 'dilapidated_shop',
      },
    ],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Loose siding ticks in the wind\./);
  assert.match(html, /Area Navigation/);
  assert.match(html, /Dilapidated Shop/);
});

test('ProjectedPageView does not delay navigation for runtime-appended visible prose', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'sunbleached_tree',
    nodeKind: 'area',
    title: "Big O' Sunbleached Tree",
    proseBlocks: [
      {
        groupId: 'runtime-log:log-1',
        kind: 'paragraph',
        text: 'It\'s picked clean by smaller hands.',
        markers: [{ kind: 'delay', value: 'long' }],
      },
    ],
    actions: [
      {
        id: 'wildraspberrybush',
        kind: 'poi',
        label: 'Wild Raspberry Bush',
        key: 'W',
        keyLabel: '[W]',
      },
    ],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Wild Raspberry Bush/);
});

test('ProseBlocks uses fade-out class when fade marker requests out direction', () => {
  const html = renderToStaticMarkup(
    <ProseBlocks
      blocks={[
        { kind: 'paragraph', text: 'Gone soon.', markers: [{ kind: 'fade', value: 'out slow' }] },
      ]}
    />,
  );

  assert.match(html, /prose-stack__block--fade-out/);
  assert.match(html, /--fade-out-duration:3200ms/);
});

test('ProseBlocks uses distinct fade speed classes for long fades', () => {
  const html = renderToStaticMarkup(
    <ProseBlocks
      blocks={[
        { kind: 'paragraph', text: 'Still here.', markers: [{ kind: 'fade', value: 'out long' }] },
      ]}
    />,
  );

  assert.match(html, /--fade-out-duration:5200ms/);
});

test('ProseBlocks supports combined fade-in and fade-out markers on the same block', () => {
  const html = renderToStaticMarkup(
    <ProseBlocks
      blocks={[
        {
          kind: 'paragraph',
          text: 'You slow anyway.',
          markers: [
            { kind: 'fade', value: 'in long' },
            { kind: 'fade', value: 'out long' },
          ],
        },
      ]}
    />,
  );

  assert.match(html, /prose-stack__block--fade-in-out/);
  assert.match(html, /--fade-in-duration:5200ms/);
  assert.match(html, /--fade-out-duration:5200ms/);
  assert.match(html, /--fade-out-delay:10400ms/);
});

test('ProseBlocks accepts numeric fade durations', () => {
  const html = renderToStaticMarkup(
    <ProseBlocks
      blocks={[
        { kind: 'paragraph', text: 'Still here.', markers: [{ kind: 'fade', value: 'out 7000' }] },
      ]}
    />,
  );

  assert.match(html, /--fade-out-duration:7000ms/);
});

test('ProjectedPageView renders path navigation controls for path pages', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'old_harbor_edge_road',
    nodeKind: 'path',
    title: 'Old Harbor Edge Road',
    proseBlocks: [
      {
        kind: 'beat',
        text: 'The sea sits closer here.',
      },
    ],
    actions: [],
    controls: [
      {
        id: 'continue',
        kind: 'continue',
        label: 'Continue',
        key: 'A',
        keyLabel: '[A]',
      },
      {
        id: 'back',
        kind: 'back',
        label: 'Back',
        key: 'B',
        keyLabel: '[B]',
      },
    ],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Path Navigation/);
  assert.match(html, /Traversal Controls/);
  assert.match(html, /Continue/);
  assert.match(html, /Back/);
});

test('ProjectedPageView keeps the visible text panel for path pages with no prose blocks', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'old_harbor_edge_road',
    nodeKind: 'path',
    title: 'Old Harbor Edge Road',
    proseBlocks: [],
    actions: [],
    controls: [
      {
        id: 'back',
        kind: 'back',
        label: 'Back',
        key: 'B',
        keyLabel: '[B]',
      },
    ],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Visible Text/);
  assert.doesNotMatch(html, /No visible text is authored for this view yet\./);
  assert.match(html, /Path Navigation/);
});

test('ProjectedPageView renders gate auto-advance fallback', () => {
  const page: ProjectionResult = {
    kind: 'auto_advance',
    nodeId: 'shop_door',
    nodeKind: 'gate',
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Passing Through/);
  assert.match(html, /This node resolves without a visible page/);
});

test('ProjectedPageView renders gate navigation sections with authored label overrides', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'fish_shop_front',
    nodeKind: 'gate',
    title: 'Fishmonger Shop Door',
    gateNavigationLabels: {
      pois: 'Things To Try',
      choices: 'What You Decide',
      exits: 'Ways Out',
      controls: 'Threshold Controls',
    },
    proseBlocks: [],
    actions: [
      { id: 'doorknock', kind: 'poi', label: 'Knock on the Door.', key: 'K', keyLabel: '[K]' },
      { id: 'wait', kind: 'choice', label: 'Wait a Moment', key: 'W', keyLabel: '[W]' },
      { id: 'shack_run', kind: 'exit', label: 'Back to Shack Run', key: 'R', keyLabel: '[R]', targetId: 'shack_run' },
    ],
    controls: [
      { id: 'back', kind: 'back', label: 'Back', key: 'B', keyLabel: '[B]' },
    ],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Gate Navigation/);
  assert.match(html, /Things To Try/);
  assert.match(html, /What You Decide/);
  assert.match(html, /Ways Out/);
  assert.match(html, /Threshold Controls/);
  assert.match(html, /Wait a Moment/);
});

test('ProjectedPageView does not show plain navigation headings before a delayed item becomes visible', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'bad_threshold',
    nodeKind: 'gate',
    title: 'Bad Ending Threshold',
    gateNavigationLabels: {
      exits: 'Exits',
    },
    proseBlocks: [],
    actions: [
      {
        id: 'bad_ending_walk',
        kind: 'exit',
        label: '[delay: medium] *Get Away*',
        key: 'A',
        keyLabel: '[A]',
        targetId: 'bad_ending_walk',
      },
    ],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.doesNotMatch(html, /Gate Navigation/);
  assert.doesNotMatch(html, />Exits</);
  assert.doesNotMatch(html, /Get Away/);
});

test('ProjectedPageView hides delayed navigation groups and items from initial render', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'bad_threshold',
    nodeKind: 'gate',
    title: 'Bad Ending Threshold',
    gateNavigationLabels: {
      exits: '[delay: medium] Exits',
    },
    proseBlocks: [],
    actions: [
      {
        id: 'stay',
        kind: 'choice',
        label: 'Stay Put',
        key: 'S',
        keyLabel: '[S]',
      },
      {
        id: 'bad_ending_walk',
        kind: 'exit',
        label: '[delay: short] *Get Away*',
        key: 'A',
        keyLabel: '[A]',
        targetId: 'bad_ending_walk',
      },
    ],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /Gate Navigation/);
  assert.match(html, /Threshold Choices/);
  assert.match(html, /Stay Put/);
  assert.doesNotMatch(html, />Exits</);
  assert.doesNotMatch(html, /Get Away/);
  assert.doesNotMatch(html, /delay: short/);
});

test('ProjectedPageView hides the outer navigation shell when all visible gate navigation is explicitly delayed', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'bad_threshold',
    nodeKind: 'gate',
    title: 'Bad Ending Threshold',
    gateNavigationLabels: {
      exits: '[delay: short] Exits',
    },
    proseBlocks: [],
    actions: [
      {
        id: 'bad_ending_walk',
        kind: 'exit',
        label: '[delay: medium] *Get Away*',
        key: 'A',
        keyLabel: '[A]',
        targetId: 'bad_ending_walk',
      },
    ],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.doesNotMatch(html, /Gate Navigation/);
  assert.doesNotMatch(html, />Exits</);
  assert.doesNotMatch(html, /Get Away/);
});

test('ProjectedPageView renders inline markdown in action labels', () => {
  const page: ProjectionResult = {
    kind: 'page',
    nodeId: 'bad_threshold',
    nodeKind: 'gate',
    title: 'Bad Ending Threshold',
    proseBlocks: [],
    actions: [
      {
        id: 'bad_ending_walk',
        kind: 'exit',
        label: '*Get Away*',
        key: 'A',
        keyLabel: '[A]',
        targetId: 'bad_ending_walk',
      },
    ],
    controls: [],
  };

  const html = renderToStaticMarkup(<ProjectedPageView page={page} />);

  assert.match(html, /<em><span>Get Away<\/span><\/em>/);
});

test('ProseBlocks preserves authored order when delaying later prose blocks', () => {
  const html = renderToStaticMarkup(
    <ProseBlocks
      blocks={[
        { kind: 'paragraph', text: 'First line.' },
        { kind: 'paragraph', text: 'Second line.', markers: [{ kind: 'delay', value: 'medium' }] },
        { kind: 'paragraph', text: 'Third line.' },
      ]}
    />,
  );

  assert.match(html, /First line\./);
  assert.doesNotMatch(html, /Second line\./);
  assert.doesNotMatch(html, /Third line\./);
  assert.doesNotMatch(html, /delay:medium/);
});

test('createScheduledBlocks adds a short gap between prose groups', () => {
  const scheduled = createScheduledBlocks([
    { groupId: 'enter', kind: 'paragraph', text: 'First line.' },
    { groupId: 'enter', kind: 'paragraph', text: 'Second line.', markers: [{ kind: 'delay', value: 'medium' }] },
    { groupId: 'first_visit', kind: 'paragraph', text: 'Third line.' },
  ]);

  assert.deepEqual(
    scheduled.map((entry) => entry.delayMs),
    [0, 900, 900 + AUTO_PROSE_GROUP_DELAY_MS],
  );
  assert.deepEqual(
    scheduled.map((entry) => entry.startsNewGroup),
    [false, false, true],
  );
});

test('buildProseUpdatePlan preserves visible prose when delayed blocks append', () => {
  const previousBlocks = [
    { kind: 'paragraph', text: 'Existing text.' },
  ];
  const nextBlocks = [
    ...previousBlocks,
    { kind: 'paragraph', text: 'Appended later.', markers: [{ kind: 'delay', value: 'medium' }] },
  ];

  const updatePlan = buildProseUpdatePlan(previousBlocks, nextBlocks, 1);

  assert.equal(updatePlan.reset, false);
  assert.equal(updatePlan.initialVisibleCount, 1);
  assert.deepEqual(updatePlan.scheduledReveals, [{ index: 1, delayMs: 900 }]);
});

test('buildProseUpdatePlan resets when prose changes instead of appending', () => {
  const previousBlocks = [
    { kind: 'paragraph', text: 'Original text.' },
  ];
  const nextBlocks = [
    { kind: 'paragraph', text: 'Replacement text.' },
  ];

  const updatePlan = buildProseUpdatePlan(previousBlocks, nextBlocks, 1);

  assert.equal(updatePlan.reset, true);
  assert.equal(updatePlan.initialVisibleCount, 1);
  assert.deepEqual(updatePlan.scheduledReveals, []);
});