import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import type { ProjectedAction, ProjectedControl, ProjectedFixturePanel, ProjectedLogEntry, ProjectedMarker, ProjectedProseBlock, ProjectionResult } from '../../../projection/src';
import { NodeNavigation } from './NodeNavigation';
import { PageShell } from './PageShell';
import { getFadePresentation } from './fadeMarker';
import { buildProseScheduleKey, countInitiallyVisibleBlocks, createScheduledBlocks, ProseBlocks } from './ProseBlocks';
import { renderRichText } from './renderRichText';
import { useAutoScrollToBottom } from './useAutoScrollToBottom';

interface ProjectedPageViewProps {
  page: ProjectionResult;
  navigationKey?: string;
  footerPane?: ReactNode;
  onAction?: (action: ProjectedAction) => void;
  onControl?: (control: ProjectedControl) => void;
}

export function ProjectedPageView({ page, navigationKey, footerPane, onAction, onControl }: ProjectedPageViewProps) {
  const pageShellRef = useRef<HTMLElement | null>(null);
  const recentLogRef = useRef<HTMLUListElement | null>(null);
  const [pageStartTimeMs, setPageStartTimeMs] = useState(() => Date.now());

  const recentLogKey =
    page.kind === 'page' && page.recentLog && page.recentLog.length > 0
      ? page.recentLog.map((entry) => entry.id).join('|')
      : '';

  useAutoScrollToBottom(recentLogRef.current, page.kind === 'page' && Boolean(page.recentLog && page.recentLog.length > 0), recentLogKey);

  useLayoutEffect(() => {
    if (!navigationKey) {
      return;
    }

    pageShellRef.current?.scrollIntoView({ block: 'start' });
  }, [navigationKey]);

  useEffect(() => {
    setPageStartTimeMs(Date.now());
  }, [navigationKey]);

  if (page.kind === 'auto_advance') {
    return (
      <PageShell eyebrow={`${page.nodeKind} / auto advance`} title="Passing Through">
        <section className="panel-stack__section">
          <p className="empty-copy">This node resolves without a visible page.</p>
        </section>
      </PageShell>
    );
  }

  const navigationBaseDelayMs = getNavigationBaseDelayMs(page.proseBlocks);

  return (
    <PageShell ref={pageShellRef} eyebrow={`${page.nodeKind} / projected page`} title={page.title} tagline={page.tagline}>
      <div className="panel-stack">
        <ProseBlocks blocks={page.proseBlocks} />

        <section className="panel-stack__section panel-stack__section--recent">
          <header className="section-header">
            <span className="section-header__rule" aria-hidden="true" />
            <h2>Recent</h2>
          </header>
          {page.recentLog && page.recentLog.length > 0 ? (
            <ul ref={recentLogRef} className="recent-log" aria-live="polite">
              {page.recentLog.map((entry) => <RecentLogItem key={entry.id} entry={entry} />)}
            </ul>
          ) : null}
        </section>

        {page.fixturePanels?.map((panel) => <FixturePanel key={panel.id} panel={panel} />)}

        <NodeNavigation
          page={page}
          onAction={onAction}
          onControl={onControl}
          baseDelayMs={navigationBaseDelayMs}
          pageStartTimeMs={pageStartTimeMs}
        />

        {footerPane}
      </div>
    </PageShell>
  );
}

function FixturePanel({ panel }: { panel: ProjectedFixturePanel }) {
  return (
    <section className="panel-stack__section fixture-panel">
      <header className="section-header">
        <span className="section-header__rule" aria-hidden="true" />
        <h2>{panel.title}</h2>
      </header>

      {panel.subtitle ? <p className="fixture-panel__subtitle">{panel.subtitle}</p> : null}

      <div className="fixture-panel__sections">
        {panel.sections.map((section) => (
          <section key={section.id} className="fixture-panel__section">
            {section.title ? <p className="fixture-panel__section-title">{section.title}</p> : null}
            <div className={getFixturePanelBlocksClassName(section.id, section.blocks.length)}>
              {section.blocks.map((block, index) => (
                <div key={`${section.id}-${index}`} className="recent-log__block recent-log__block--group-start">
                  {renderRichText(block.text)}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function getFixturePanelBlocksClassName(sectionId: string, blockCount: number): string {
  const classNames = ['fixture-panel__blocks'];

  if (sectionId === 'queue' && blockCount > 5) {
    classNames.push('fixture-panel__blocks--scrollable');
  }

  return classNames.join(' ');
}

function getNavigationBaseDelayMs(blocks: ProjectedProseBlock[]): number {
  const scheduledBlocks = createScheduledBlocks(blocks.filter((block) => !isRuntimeLogProseBlock(block)));

  if (scheduledBlocks.length === 0) {
    return 0;
  }

  return scheduledBlocks[scheduledBlocks.length - 1]?.delayMs ?? 0;
}

function isRuntimeLogProseBlock(block: ProjectedProseBlock): boolean {
  return typeof block.groupId === 'string' && block.groupId.startsWith('runtime-log:');
}

function RecentLogItem({ entry }: { entry: ProjectedLogEntry }) {
  const blocks = getRecentLogBlocks(entry);
  const blockScheduleKey = buildProseScheduleKey(blocks);
  const scheduledBlocks = createScheduledBlocks(blocks);
  const [visibleBlockCount, setVisibleBlockCount] = useState(() => countInitiallyVisibleBlocks(scheduledBlocks));

  useEffect(() => {
    const nextScheduledBlocks = createScheduledBlocks(blocks);
    const initialVisibleCount = countInitiallyVisibleBlocks(nextScheduledBlocks);
    setVisibleBlockCount(initialVisibleCount);

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    nextScheduledBlocks.forEach((scheduledBlock, index) => {
      if (index < initialVisibleCount || scheduledBlock.delayMs <= 0) {
        return;
      }

      timers.push(
        setTimeout(() => {
          setVisibleBlockCount((current) => Math.max(current, index + 1));
        }, scheduledBlock.delayMs),
      );
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [blockScheduleKey]);

  return (
    <li className="recent-log__item">
      {scheduledBlocks.map((scheduledBlock, index) => {
        if (index >= visibleBlockCount) {
          return null;
        }

        const { block, startsNewGroup } = scheduledBlock;
        const fadePresentation = getFadePresentation(block.markers as ProjectedMarker[] | undefined, 'recent-log__block');

        return (
          <div
            key={`${entry.id}-${index}`}
            className={getRecentLogBlockClassName(startsNewGroup, fadePresentation.className)}
            style={fadePresentation.style}
          >
            {renderRichText(block.text)}
          </div>
        );
      })}
    </li>
  );
}

function getRecentLogBlocks(entry: ProjectedLogEntry): ProjectedProseBlock[] {
  if (entry.blocks && entry.blocks.length > 0) {
    return entry.blocks;
  }

  return [
    {
      kind: 'paragraph',
      text: entry.text,
      markers: entry.markers,
    },
  ];
}

function getRecentLogBlockClassName(startsNewGroup: boolean, fadeClassName: string | undefined): string {
  const classNames = ['recent-log__block'];

  if (startsNewGroup) {
    classNames.push('recent-log__block--group-start');
  }

  if (fadeClassName) {
    classNames.push(fadeClassName);
  }

  return classNames.join(' ');
}