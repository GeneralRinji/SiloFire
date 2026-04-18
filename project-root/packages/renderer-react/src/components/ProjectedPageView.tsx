import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { ProjectedAction, ProjectedControl, ProjectedLogEntry, ProjectedMarker, ProjectedProseBlock, ProjectionResult } from '../../../projection/src';
import { NodeNavigation } from './NodeNavigation';
import { PageShell } from './PageShell';
import { getFadePresentation } from './fadeMarker';
import { buildProseScheduleKey, countInitiallyVisibleBlocks, createScheduledBlocks, ProseBlocks } from './ProseBlocks';
import { renderRichText } from './renderRichText';

interface ProjectedPageViewProps {
  page: ProjectionResult;
  navigationKey?: string;
  onAction?: (action: ProjectedAction) => void;
  onControl?: (control: ProjectedControl) => void;
}

export function ProjectedPageView({ page, navigationKey, onAction, onControl }: ProjectedPageViewProps) {
  const recentLogRef = useRef<HTMLUListElement | null>(null);
  const [pageStartTimeMs, setPageStartTimeMs] = useState(() => Date.now());

  const recentLogKey =
    page.kind === 'page' && page.recentLog && page.recentLog.length > 0
      ? page.recentLog.map((entry) => entry.id).join('|')
      : '';

  useLayoutEffect(() => {
    if (page.kind !== 'page' || !page.recentLog || page.recentLog.length === 0 || !recentLogRef.current) {
      return;
    }

    scheduleRecentLogScroll(recentLogRef.current);
  }, [page.kind, recentLogKey]);

  useEffect(() => {
    setPageStartTimeMs(Date.now());
  }, [navigationKey]);

  useEffect(() => {
    if (page.kind !== 'page' || !page.recentLog || page.recentLog.length === 0 || !recentLogRef.current) {
      return;
    }

    const recentLogElement = recentLogRef.current;
    const queueScroll = () => {
      scheduleRecentLogScroll(recentLogElement);
    };
    const resizeObserver = new ResizeObserver(() => {
      queueScroll();
    });
    const mutationObserver = new MutationObserver(() => {
      queueScroll();
    });

    resizeObserver.observe(recentLogElement);
    mutationObserver.observe(recentLogElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    queueScroll();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [page.kind, recentLogKey]);

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
    <PageShell eyebrow={`${page.nodeKind} / projected page`} title={page.title} tagline={page.tagline}>
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

        <NodeNavigation
          page={page}
          onAction={onAction}
          onControl={onControl}
          baseDelayMs={navigationBaseDelayMs}
          pageStartTimeMs={pageStartTimeMs}
        />
      </div>
    </PageShell>
  );
}

function scrollRecentLogToBottom(element: HTMLUListElement): void {
  element.scrollTop = element.scrollHeight;
}

function scheduleRecentLogScroll(element: HTMLUListElement): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollRecentLogToBottom(element);
    });
  });
}

function getNavigationBaseDelayMs(blocks: ProjectedProseBlock[]): number {
  const scheduledBlocks = createScheduledBlocks(blocks);

  if (scheduledBlocks.length === 0) {
    return 0;
  }

  return scheduledBlocks[scheduledBlocks.length - 1]?.delayMs ?? 0;
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