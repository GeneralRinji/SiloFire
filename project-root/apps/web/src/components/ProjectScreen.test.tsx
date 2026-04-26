import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ProjectScreen } from './ProjectScreen';

test('ProjectScreen renders a selected projected page without invalid component boundaries', () => {
  const html = renderToStaticMarkup(
    <ProjectScreen
      project={{
        id: 'demo',
        folderName: 'demo',
        title: 'Demo Project',
        description: 'Renderer smoke test.',
        owner: 'test',
        status: 'playable-demo',
        tools: [],
        features: [],
      }}
      nodes={[{ id: 'start', label: 'Start' }]}
      selectedNodeId="start"
      selectedPage={{
        kind: 'page',
        nodeId: 'start',
        nodeKind: 'area',
        title: 'Start',
        proseBlocks: [
          {
            kind: 'paragraph',
            text: 'Visible entry text.',
          },
        ],
        recentLog: [
          {
            id: 'recent-1',
            text: 'A recent entry.',
          },
        ],
        actions: [
          {
            id: 'look',
            kind: 'poi',
            label: 'Look around',
            key: 'L',
            keyLabel: '[L]',
          },
        ],
        controls: [],
      }}
      onBackHome={() => {}}
      onResetRun={() => {}}
      onHeartNode={async () => true}
      onSelectNode={() => {}}
      onAction={() => {}}
      onControl={() => {}}
    />,
  );

  assert.match(html, /Demo Project/);
  assert.match(html, /Visible Text/);
  assert.match(html, /Visible entry text\./);
  assert.match(html, /Recent/);
  assert.match(html, /reset\/run/);
  assert.match(html, /Look around/);
  assert.match(html, /terminal-heart-pane__glyph" aria-hidden="true">♡</);
  assert.match(html, /Show this node some love \(analytics only\)/);
  assert.ok(html.indexOf('Look around') < html.indexOf('Show this node some love (analytics only)'));
  assert.match(html, /aria-pressed="false"/);
});