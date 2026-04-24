import { useEffect, useRef, useState } from 'react';

import type { ProjectedProseBlock } from '../../../projection/src';
import { getFadePresentation } from './fadeMarker';
import { renderRichText } from './renderRichText';
import { delayValueToMs } from './timing';
import { useAutoScrollToBottom } from './useAutoScrollToBottom';

interface ProseBlocksProps {
  blocks: ProjectedProseBlock[];
}

interface ScheduledProseBlock {
  block: ProjectedProseBlock;
  delayMs: number;
  startsNewGroup: boolean;
}

interface ProseUpdatePlan {
  reset: boolean;
  initialVisibleCount: number;
  scheduledReveals: Array<{
    index: number;
    delayMs: number;
  }>;
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
  const previousBlocksRef = useRef<ProjectedProseBlock[] | undefined>(undefined);
  const visibleBlockCountRef = useRef(visibleBlockCount);
  const proseStackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    visibleBlockCountRef.current = visibleBlockCount;
  }, [visibleBlockCount]);

  useEffect(() => {
    const updatePlan = buildProseUpdatePlan(previousBlocksRef.current, blocks, visibleBlockCountRef.current);
    previousBlocksRef.current = blocks;
    setVisibleBlockCount(updatePlan.initialVisibleCount);

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    updatePlan.scheduledReveals.forEach(({ index, delayMs }) => {
      timers.push(
        setTimeout(() => {
          setVisibleBlockCount((current) => Math.max(current, index + 1));
        }, delayMs),
      );
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [blockScheduleKey]);

  useAutoScrollToBottom(proseStackRef.current, visibleBlockCount > 0, `${blockScheduleKey}:${visibleBlockCount}`);

  return (
    <section className="panel-stack__section panel-stack__section--prose">
      <header className="section-header">
        <span className="section-header__rule" aria-hidden="true" />
        <h2>Visible Text</h2>
      </header>

      <div ref={proseStackRef} className="prose-stack">
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

export function buildProseUpdatePlan(
  previousBlocks: ProjectedProseBlock[] | undefined,
  nextBlocks: ProjectedProseBlock[],
  currentVisibleCount: number,
): ProseUpdatePlan {
  const nextScheduledBlocks = createScheduledBlocks(nextBlocks);
  const nextInitialVisibleCount = countInitiallyVisibleBlocks(nextScheduledBlocks);

  if (!previousBlocks || !isProseBlockPrefix(previousBlocks, nextBlocks)) {
    return {
      reset: true,
      initialVisibleCount: nextInitialVisibleCount,
      scheduledReveals: nextScheduledBlocks.flatMap((scheduledBlock, index) => (
        index < nextInitialVisibleCount || scheduledBlock.delayMs <= 0
          ? []
          : [{ index, delayMs: scheduledBlock.delayMs }]
      )),
    };
  }

  const previousScheduledBlocks = createScheduledBlocks(previousBlocks);
  const previousDelayMs = previousScheduledBlocks.length > 0 ? previousScheduledBlocks[previousScheduledBlocks.length - 1]!.delayMs : 0;
  let initialVisibleCount = Math.min(currentVisibleCount, nextScheduledBlocks.length);

  while (initialVisibleCount < nextScheduledBlocks.length) {
    const relativeDelayMs = getAppendRelativeDelayMs(nextScheduledBlocks, previousBlocks.length, previousDelayMs, initialVisibleCount);

    if (relativeDelayMs > 0) {
      break;
    }

    initialVisibleCount += 1;
  }

  return {
    reset: false,
    initialVisibleCount,
    scheduledReveals: nextScheduledBlocks.flatMap((_, index) => {
      if (index < initialVisibleCount) {
        return [];
      }

      return [{
        index,
        delayMs: getAppendRelativeDelayMs(nextScheduledBlocks, previousBlocks.length, previousDelayMs, index),
      }];
    }),
  };
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

export function isProseBlockPrefix(previousBlocks: ProjectedProseBlock[], nextBlocks: ProjectedProseBlock[]): boolean {
  if (previousBlocks.length > nextBlocks.length) {
    return false;
  }

  return previousBlocks.every((block, index) => serializeProseBlock(block) === serializeProseBlock(nextBlocks[index]));
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

function getAppendRelativeDelayMs(
  scheduledBlocks: ScheduledProseBlock[],
  previousLength: number,
  previousDelayMs: number,
  index: number,
): number {
  const scheduledBlock = scheduledBlocks[index];

  if (!scheduledBlock) {
    return 0;
  }

  if (index < previousLength) {
    return scheduledBlock.delayMs;
  }

  return Math.max(0, scheduledBlock.delayMs - previousDelayMs);
}

function serializeProseBlock(block: ProjectedProseBlock): string {
  return JSON.stringify({
    kind: block.kind,
    text: block.text,
    groupId: block.groupId,
    markers: block.markers?.map((marker) => ({ kind: marker.kind, value: marker.value })) ?? [],
  });
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

