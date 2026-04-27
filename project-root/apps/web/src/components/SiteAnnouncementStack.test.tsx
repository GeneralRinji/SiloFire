import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SiteAnnouncementStack } from './SiteAnnouncementStack';

test('SiteAnnouncementStack renders server-provided announcement order with tone and link styling', () => {
  const html = renderToStaticMarkup(
    <SiteAnnouncementStack
      announcements={[
        {
          id: 'priority-first',
          scope: 'site',
          title: 'Maintenance',
          body: 'Server work is in progress.',
          mode: 'persistent',
          priority: 10,
          colorTone: 'critical',
          enabled: true,
          createdAtMs: 10,
          updatedAtMs: 10,
        },
        {
          id: 'priority-second',
          scope: 'site',
          title: 'Read More',
          body: 'See the update notes.',
          mode: 'dismissible',
          priority: 5,
          linkHref: '/admin',
          linkLabel: 'Open Admin',
          colorTone: 'info',
          enabled: true,
          createdAtMs: 10,
          updatedAtMs: 10,
        },
      ]}
    />,
  );

  assert.match(html, /Site announcements/);
  assert.match(html, /site-announcement-card--critical/);
  assert.match(html, /site-announcement-card--persistent/);
  assert.match(html, /site-announcement-card--info/);
  assert.match(html, /href="\/admin"/);
  assert.match(html, /Open Admin/);
  assert.match(html, /Dismiss Read More/);
  assert.ok(html.indexOf('Maintenance') < html.indexOf('Read More'));
});

test('SiteAnnouncementStack renders nothing when there are no active announcements', () => {
  const html = renderToStaticMarkup(<SiteAnnouncementStack announcements={[]} />);
  assert.equal(html, '');
});