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

test('ProjectScreen renders the sidebar jukebox player when active playback is present', () => {
  const html = renderToStaticMarkup(
    <ProjectScreen
      project={{
        id: 'prototypehub',
        folderName: 'PrototypeHub',
        title: 'Prototype Hub',
        description: 'Fixture test.',
        owner: 'test',
        status: 'playable-demo',
        tools: [],
        features: [],
      }}
      nodes={[{ id: 'lobby_area', label: 'Lobby' }]}
      selectedNodeId="lobby_area"
      selectedPage={{
        kind: 'page',
        nodeId: 'lobby_area',
        nodeKind: 'area',
        title: 'Lobby',
        proseBlocks: [],
        recentLog: [],
        actions: [],
        controls: [],
      }}
      jukeboxPlayback={{
        objectId: 'prototypehub_lobby_jukebox',
        trackId: 'song_001',
        trackLabel: 'Never Gonna Give You Up by Rick Astley',
        trackMode: 'paid',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        videoId: 'dQw4w9WgXcQ',
        song: {
          id: 'song_001',
          title: 'Never Gonna Give You Up',
          artist: 'Rick Astley',
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          approxDurationSeconds: 213,
          approxDurationText: 'about 3.5 minutes',
          vibe: 'unavoidable',
          marqueeTexts: [],
          flavorTexts: [],
          tags: [],
        },
      }}
      onBackHome={() => {}}
      onSelectNode={() => {}}
    />,
  );

  assert.match(html, /Jukebox Airplay/);
  assert.match(html, /mute/);
  assert.match(html, /now\/Never Gonna Give You Up - Rick Astley/);
  assert.match(html, /source\/youtube \| mode\/paid/);
});

test('ProjectScreen does not render the sidebar jukebox player when playback is hidden', () => {
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
      nodes={[{ id: 'title_screen', label: 'Title' }]}
      selectedNodeId="title_screen"
      selectedPage={{
        kind: 'page',
        nodeId: 'title_screen',
        nodeKind: 'area',
        title: 'Title Screen',
        proseBlocks: [
          {
            kind: 'paragraph',
            text: 'Pick a run.',
          },
        ],
        recentLog: [],
        actions: [],
        controls: [],
      }}
      jukeboxPlayback={{
        objectId: 'prototypehub_lobby_jukebox',
        trackId: 'song_003',
        trackLabel: 'Never Gonna Give You Up by Rick Astley',
        trackMode: 'paid',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        videoId: 'dQw4w9WgXcQ',
        song: {
          id: 'song_003',
          title: 'Never Gonna Give You Up',
          artist: 'Rick Astley',
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          durationMs: 212000,
          vibe: 'euphoric',
          marqueeTexts: [],
          flavorTexts: [],
          tags: [],
        },
      }}
      jukeboxPlaybackVisible={false}
      onBackHome={() => {}}
      onResetRun={() => {}}
      onHeartNode={async () => true}
      onSelectNode={() => {}}
      onAction={() => {}}
      onControl={() => {}}
    />,
  );

  assert.doesNotMatch(html, /Jukebox Airplay/);
  assert.doesNotMatch(html, /Never Gonna Give You Up/);
});