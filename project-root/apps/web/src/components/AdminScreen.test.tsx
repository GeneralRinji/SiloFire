import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AdminProjectScreen } from './AdminScreen';

test('AdminProjectScreen renders analytics without player-facing open links', () => {
  const html = renderToStaticMarkup(
    <AdminProjectScreen
      project={{
        projectId: 'demo04',
        title: 'Demo 04',
        totalHearts: 7,
        nodes: [
          {
            nodeId: 'sidewalk_north',
            label: 'Sidewalk North',
            heartCount: 5,
          },
          {
            nodeId: 'building04_groundfloor',
            label: 'Building 04 Ground Floor',
            heartCount: 2,
          },
        ],
        nodeList: [
          {
            nodeId: 'title_screen',
            label: 'Title Screen',
          },
          {
            nodeId: 'sidewalk_north',
            label: 'Sidewalk North',
          },
        ],
        sessionNpcStateById: {
          resident_01: {
            location: 'building04_groundfloor',
          },
        },
        sessionObjectStateById: {
          building03_door: {
            open: true,
          },
        },
      }}
      onBackOverview={() => {}}
      onResetHearts={() => {}}
      onSignOut={() => {}}
    />,
  );

  assert.match(html, /Demo 04/);
  assert.match(html, /hearts\/5/);
  assert.match(html, /Current Node List/);
  assert.match(html, /building03_door/);
  assert.doesNotMatch(html, /open\/sidewalk_north/);
  assert.doesNotMatch(html, /open\/title_screen/);
});