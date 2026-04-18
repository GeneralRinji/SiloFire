import type { CSSProperties } from 'react';

import type { ProjectedMarker } from '../../../projection/src';

const DEFAULT_FADE_IN_MS = 600;
const DEFAULT_FADE_OUT_MS = 2600;

export interface FadePresentation {
  className?: string;
  style?: CSSProperties;
}

export function getDelayDurationMs(markers: ProjectedMarker[] | undefined): number | undefined {
  const delayMarker = markers?.find((marker) => marker.kind === 'delay');

  if (!delayMarker) {
    return undefined;
  }

  return parseTimingDurationMs(delayMarker.value);
}

export function getFadePresentation(
  markers: ProjectedMarker[] | undefined,
  classPrefix: string,
): FadePresentation {
  const fadeMarkers = markers
    ?.filter((marker) => marker.kind === 'fade')
    .map((marker) => parseFadeMarker(marker.value)) ?? [];

  if (fadeMarkers.length === 0) {
    return {};
  }

  const enterFade = fadeMarkers.find((marker) => marker.direction === 'in');
  const exitFade = [...fadeMarkers].reverse().find((marker) => marker.direction === 'out');

  if (enterFade && exitFade) {
    const fadeInDurationMs = enterFade.durationMs ?? DEFAULT_FADE_IN_MS;
    const fadeOutDurationMs = exitFade.durationMs ?? DEFAULT_FADE_OUT_MS;

    return {
      className: `${classPrefix}--fade-in-out`,
      style: createFadeStyle({
        fadeInDurationMs,
        fadeOutDurationMs,
        fadeOutDelayMs: fadeInDurationMs + fadeOutDurationMs,
      }),
    };
  }

  if (exitFade) {
    return {
      className: `${classPrefix}--fade-out`,
      style: createFadeStyle({ fadeOutDurationMs: exitFade.durationMs ?? DEFAULT_FADE_OUT_MS }),
    };
  }

  return {
    className: `${classPrefix}--fade-in`,
    style: createFadeStyle({ fadeInDurationMs: enterFade?.durationMs ?? DEFAULT_FADE_IN_MS }),
  };
}

function createFadeStyle(options: {
  fadeInDurationMs?: number;
  fadeOutDurationMs?: number;
  fadeOutDelayMs?: number;
}): CSSProperties {
  const style: Record<string, string> = {};

  if (options.fadeInDurationMs) {
    style['--fade-in-duration'] = `${options.fadeInDurationMs}ms`;
  }

  if (options.fadeOutDurationMs) {
    style['--fade-out-duration'] = `${options.fadeOutDurationMs}ms`;
  }

  if (options.fadeOutDelayMs) {
    style['--fade-out-delay'] = `${options.fadeOutDelayMs}ms`;
  }

  return style as CSSProperties;
}

function parseFadeMarker(value: string): { direction: 'in' | 'out'; durationMs?: number } {
  return {
    direction: parseFadeDirection(value),
    durationMs: parseFadeDurationMs(value),
  };
}

function parseFadeDirection(value: string): 'in' | 'out' {
  const tokens = value.trim().toLowerCase().split(/\s+/).filter((token) => token.length > 0);

  if (tokens.includes('out') || tokens.includes('fade-out') || tokens.includes('fadeout')) {
    return 'out';
  }

  return 'in';
}

function parseFadeDurationMs(value: string): number | undefined {
  return parseTimingDurationMs(value, {
    fast: 900,
    short: 900,
    medium: 1800,
    slow: 3200,
    long: 5200,
  });
}

function parseTimingDurationMs(
  value: string,
  namedDurations: Record<string, number> = {
    fast: 250,
    short: 250,
    medium: 900,
    slow: 1600,
    long: 1600,
  },
): number | undefined {
  const tokens = value.trim().toLowerCase().split(/\s+/).filter((token) => token.length > 0);

  const numericToken = tokens.find((token) => /^\d+(?:\.\d+)?$/.test(token));

  if (numericToken) {
    const parsed = Number(numericToken);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  for (const [token, durationMs] of Object.entries(namedDurations)) {
    if (tokens.includes(token)) {
      return durationMs;
    }
  }

  return undefined;
}