import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AdminOverviewScreen, AdminProjectScreen } from './AdminScreen';

test('AdminOverviewScreen renders site announcement management blocks', () => {
  const html = renderToStaticMarkup(
    <AdminOverviewScreen
      projects={[]}
      siteAnnouncements={{
        calendarScope: 'site',
        currentTimeMs: Date.parse('2026-04-26T12:00:00.000Z'),
        activeAnnouncements: [
          {
            id: 'persistent',
            scope: 'site',
            title: 'Persistent Sample',
            body: 'Always up.',
            mode: 'persistent',
            priority: 100,
            enabled: true,
            createdAtMs: 10,
            updatedAtMs: 10,
          },
        ],
        upcomingAnnouncements: [
          {
            id: 'future-window',
            scope: 'site',
            title: 'Future Window',
            body: 'Covers two weeks.',
            mode: 'dismissible',
            priority: 5,
            enabled: true,
            startsAtMs: Date.parse('2026-05-02T12:00:00.000Z'),
            endsAtMs: Date.parse('2026-05-16T12:00:00.000Z'),
            createdAtMs: 10,
            updatedAtMs: 10,
          },
        ],
        expiredAnnouncements: [],
        disabledAnnouncements: [
          {
            id: 'disabled',
            scope: 'site',
            title: 'Disabled Sample',
            body: 'Not public right now.',
            mode: 'dismissible',
            priority: 1,
            enabled: false,
            startsAtMs: Date.parse('2026-05-06T12:00:00.000Z'),
            endsAtMs: Date.parse('2026-05-10T12:00:00.000Z'),
            createdAtMs: 10,
            updatedAtMs: 10,
          },
        ],
        allAnnouncements: [
          {
            id: 'persistent',
            scope: 'site',
            title: 'Persistent Sample',
            body: 'Always up.',
            mode: 'persistent',
            priority: 100,
            enabled: true,
            createdAtMs: 10,
            updatedAtMs: 10,
          },
          {
            id: 'future-window',
            scope: 'site',
            title: 'Future Window',
            body: 'Covers two weeks.',
            mode: 'dismissible',
            priority: 5,
            enabled: true,
            startsAtMs: Date.parse('2026-05-02T12:00:00.000Z'),
            endsAtMs: Date.parse('2026-05-16T12:00:00.000Z'),
            createdAtMs: 10,
            updatedAtMs: 10,
          },
          {
            id: 'disabled',
            scope: 'site',
            title: 'Disabled Sample',
            body: 'Not public right now.',
            mode: 'dismissible',
            priority: 1,
            enabled: false,
            startsAtMs: Date.parse('2026-05-06T12:00:00.000Z'),
            endsAtMs: Date.parse('2026-05-10T12:00:00.000Z'),
            createdAtMs: 10,
            updatedAtMs: 10,
          },
        ],
      }}
      onBackHome={() => {}}
      onOpenProject={() => {}}
      onSignOut={() => {}}
      onCreateSiteAnnouncement={async () => undefined}
      onUpdateSiteAnnouncement={async () => undefined}
      onDeleteSiteAnnouncement={async () => undefined}
    />,
  );

  assert.match(html, /Site Announcements/);
  assert.match(html, /server-time\//);
  assert.match(html, /create\/announcement/);
  assert.match(html, /Announcement Calendar/);
  assert.match(html, /view\/month-grid/);
  assert.match(html, /months-visible\/2/);
  assert.match(html, /range\/Apr 2026 -&gt; May 2026/);
  assert.match(html, /calendar\/prev-month/);
  assert.match(html, /calendar\/current-month/);
  assert.match(html, /calendar\/next-month/);
  assert.doesNotMatch(html, /<button[^>]*disabled[^>]*>calendar\/prev-month<\/button>/);
  assert.doesNotMatch(html, /<button[^>]*disabled[^>]*>calendar\/next-month<\/button>/);
  assert.match(html, /Apr 2026/);
  assert.match(html, /May 2026/);
  assert.match(html, /Future Window/);
  assert.match(html, /Announcement Timeline/);
  assert.match(html, /Persistent Sample/);
  assert.match(html, /Disabled Sample/);
  assert.match(html, /enabled\/false/);
  assert.match(html, /edit/);
  assert.match(html, /optional: \/status or https:\/\/status.example.com/);
  assert.match(html, /optional when link-href is set/);
});

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
      onOpenNode={() => {}}
      onResetHearts={() => {}}
      onSignOut={() => {}}
    />,
  );

  assert.match(html, /Demo 04/);
  assert.match(html, /hearts\/5/);
  assert.match(html, /Selected Node/);
  assert.match(html, /Current Node List/);
  assert.match(html, /route\/projects\/demo04\/nodes\/sidewalk_north/);
  assert.match(html, /href="\/projects\/demo04\/nodes\/title_screen"/);
  assert.match(html, /href="\/projects\/demo04\/nodes\/sidewalk_north"/);
  assert.match(html, /open\/node/);
  assert.match(html, /building03_door/);
  assert.doesNotMatch(html, /open\/sidewalk_north/);
});