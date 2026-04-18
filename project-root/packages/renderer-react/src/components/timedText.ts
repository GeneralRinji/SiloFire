import { delayValueToMs } from './ProseBlocks';

const DELAY_MARKER_PATTERN = /^\s*\[delay:\s*([^\]]+)\]\s*/i;

interface TimedText {
  text: string;
  delayMs: number;
  hasExplicitDelay: boolean;
}

export function parseTimedText(text: string): TimedText {
  const match = text.match(DELAY_MARKER_PATTERN);

  if (!match) {
    return {
      text,
      delayMs: 0,
      hasExplicitDelay: false,
    };
  }

  return {
    text: text.slice(match[0].length),
    delayMs: delayValueToMs(match[1]),
    hasExplicitDelay: true,
  };
}

export function normalizeNavigationTitle(title: string | undefined): string | undefined {
  if (title === undefined) {
    return undefined;
  }

  const timedTitle = parseTimedText(title);

  if (timedTitle.text.trim() === '[none]') {
    return undefined;
  }

  return title;
}

export function getActionListFirstVisibleDelay(title: string | undefined, itemLabels: string[], baseDelayMs: number): number {
  const timedTitle = title ? parseTimedText(title) : undefined;

  if (timedTitle?.hasExplicitDelay) {
    return baseDelayMs + timedTitle.delayMs;
  }

  if (itemLabels.length === 0) {
    return 0;
  }

  const itemDelays = itemLabels.map((label) => {
    const timedLabel = parseTimedText(label);
    return timedLabel.hasExplicitDelay ? baseDelayMs + timedLabel.delayMs : 0;
  });

  return Math.min(...itemDelays);
}

export function getRemainingDelayMs(targetDelayMs: number, pageStartTimeMs: number | undefined): number {
  if (targetDelayMs <= 0 || pageStartTimeMs === undefined) {
    return Math.max(0, targetDelayMs);
  }

  const elapsedMs = Date.now() - pageStartTimeMs;
  return Math.max(0, targetDelayMs - elapsedMs);
}