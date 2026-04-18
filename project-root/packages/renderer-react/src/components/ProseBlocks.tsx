import { useEffect, useState } from 'react';

import type { ProjectedProseBlock } from '../../../projection/src';
import { getFadePresentation } from './fadeMarker';
import { renderRichText } from './renderRichText';

interface ProseBlocksProps {
  blocks: ProjectedProseBlock[];
}

interface ScheduledProseBlock {
  block: ProjectedProseBlock;
  delayMs: number;
  startsNewGroup: boolean;
}

export const AUTO_PROSE_GROUP_DELAY_MS = 650;

export function ProseBlocks({ blocks }: ProseBlocksProps) {
  if (blocks.length === 0) {
    return (
      <section className="panel-stack__section panel-stack__section--prose">
        <header className="section-header">
          <span className="section-header__rule" aria-hidden="true" />
          <h2>Visible Text</h2>
        </header>

        <div className="prose-stack" />
      </section>
    );
  }

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
    <section className="panel-stack__section panel-stack__section--prose">
      <header className="section-header">
        <span className="section-header__rule" aria-hidden="true" />
        <h2>Visible Text</h2>
      </header>

      <div className="prose-stack">
        {scheduledBlocks.map((scheduledBlock, index) => {
          if (index >= visibleBlockCount) {
            return null;
          }

          const { block, startsNewGroup } = scheduledBlock;
          const fadePresentation = getFadePresentation(block.markers, 'prose-stack__block');

          return (
          <article
            key={`${block.kind}-${index}`}
            className={getBlockClassName(block, startsNewGroup, fadePresentation.className)}
            style={fadePresentation.style}
          >
            {renderRichText(block.text)}
          </article>
          );
        })}
      </div>
    </section>
  );
}

export function createScheduledBlocks(blocks: ProjectedProseBlock[]): ScheduledProseBlock[] {
  let cumulativeDelayedMs = 0;
  let previousGroupId: string | undefined;

  return blocks.map((block) => {
    const currentGroupId = block.groupId;
    const groupChanged = previousGroupId !== undefined && currentGroupId !== previousGroupId;

    if (groupChanged) {
      cumulativeDelayedMs += AUTO_PROSE_GROUP_DELAY_MS;
    }

    const delayMs = getDelayMs(block);

    if (delayMs > 0) {
      cumulativeDelayedMs += delayMs;
    }

    previousGroupId = currentGroupId;

    return {
      block,
      delayMs: cumulativeDelayedMs,
      startsNewGroup: groupChanged,
    };
  });
}

export function buildProseScheduleKey(blocks: ProjectedProseBlock[]): string {
  return JSON.stringify(
    blocks.map((block) => ({
      kind: block.kind,
      text: block.text,
      markers: block.markers?.map((marker) => ({ kind: marker.kind, value: marker.value })) ?? [],
    })),
  );
}

export function countInitiallyVisibleBlocks(blocks: ScheduledProseBlock[]): number {
  let visibleCount = 0;

  for (const block of blocks) {
    if (block.delayMs > 0) {
      break;
    }

    visibleCount += 1;
  }

  return visibleCount;
}

function getDelayMs(block: ProjectedProseBlock): number {
  const delayMarker = block.markers?.find((marker) => marker.kind === 'delay');

  if (!delayMarker) {
    return 0;
  }

  return delayValueToMs(delayMarker.value);
}

function getBlockClassName(
  block: ProjectedProseBlock,
  startsNewGroup: boolean,
  fadeClassName: string | undefined,
): string {
  const classNames = [`prose-stack__block`, `prose-stack__block--${block.kind}`];

  if (startsNewGroup) {
    classNames.push('prose-stack__block--group-start');
  }

  if (fadeClassName) {
    classNames.push(fadeClassName);
  }

  return classNames.join(' ');
}

export function delayValueToMs(value: string): number {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'fast' || normalized === 'short') {
    return 250;
  }

  if (normalized === 'medium') {
    return 900;
  }

  if (normalized === 'slow' || normalized === 'long') {
    return 1600;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
