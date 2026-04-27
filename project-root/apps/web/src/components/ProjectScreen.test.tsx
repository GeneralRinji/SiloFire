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
      siteAnnouncements={[
        {
          id: 'maintenance',
          scope: 'site',
          title: 'Maintenance',
          body: 'Server work in five minutes.',
          mode: 'persistent',
          priority: 100,
          colorTone: 'critical',
          enabled: true,
          createdAtMs: 10,
          updatedAtMs: 10,
        },
      ]}
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
  assert.match(html, /Server work in five minutes\./);
  assert.ok(html.indexOf('Look around') < html.indexOf('Show this node some love (analytics only)'));
  assert.ok(html.indexOf('Maintenance') < html.indexOf('Visible entry text.'));
  assert.match(html, /aria-pressed="false"/);
});

test('ProjectScreen can hide the public node list while keeping the project header block', () => {
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
      showNodeList={false}
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
        recentLog: [],
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

  assert.match(html, /silofire:\/demo/);
  assert.match(html, /Demo Project/);
  assert.match(html, /reset\/run/);
  assert.doesNotMatch(html, /<p class="terminal-label">Nodes<\/p>/);
  assert.doesNotMatch(html, /open\/Start/);
});

test('ProjectScreen can render dev-only state panes', () => {
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
      showStatePanes
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
        recentLog: [],
        actions: [],
        controls: [],
      }}
      activeClock={{
        nodeId: 'start',
        calendarId: 'demo_block',
        phase: 'night',
        nowLabel: '4/26/2026, 1:46:47 AM',
        nextPhaseLabel: '13s',
        source: 'server:state-world',
      }}
      activeWeather={{
        kind: 'clear',
        intensity: 'soft',
        patternId: 'demo_weather',
        stepId: 'clear_soft',
        regionId: 'block',
        source: 'server',
      }}
      activeAmbientNpcs={[
        {
          id: 'walker_01',
          displayName: 'Block Walker',
          previousNodeId: 'sidewalk_south',
          nextNodeId: 'sidewalk_west',
          behavior: 'move',
        },
      ]}
      sessionNpcStateById={{
        walker_01: {
          location: 'sidewalk_north',
          behavior: 'move',
        },
      }}
      sessionObjectStateById={{
        night_light: {
          on: false,
        },
      }}
      onBackHome={() => {}}
      onSelectNode={() => {}}
    />,
  );

  assert.match(html, /<p class="terminal-label">Time<\/p>/);
  assert.match(html, /phase\/night/);
  assert.match(html, /server-now\/4\/26\/2026, 1:46:47 AM/);
  assert.match(html, /<p class="terminal-label">Ambient<\/p>/);
  assert.match(html, /Block Walker/);
  assert.match(html, /<p class="terminal-label">Objects<\/p>/);
  assert.match(html, /night_light/);
  assert.match(html, /field\/on/);
  assert.match(html, /current\/false/);
});