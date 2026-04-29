import { JUKEBOX_CATALOGS, type JukeboxCatalogSong } from '../../../packages/runtime/src/jukeboxCatalogs';

export interface JukeboxPlaybackState {
  objectId: string;
  trackId: string;
  trackLabel: string;
  trackMode?: string;
  trackStartedAtMs?: number;
  trackEndsAtMs?: number;
  snapshotNowMs?: number;
  youtubeUrl: string;
  videoId: string;
  song: JukeboxCatalogSong;
}

const JUKEBOX_SONGS_BY_ID = new Map<string, JukeboxCatalogSong>(
  Object.values(JUKEBOX_CATALOGS)
    .flat()
    .map((song) => [song.id, song]),
);

export function findActiveJukeboxPlayback(
  sessionObjectStateById: Record<string, Record<string, string | number | boolean>> | undefined,
  sessionNowMs?: number,
): JukeboxPlaybackState | undefined {
  if (!sessionObjectStateById) {
    return undefined;
  }

  for (const [objectId, objectState] of Object.entries(sessionObjectStateById)) {
    const trackId = typeof objectState.currentTrack === 'string' && objectState.currentTrack !== 'none'
      ? objectState.currentTrack
      : undefined;

    if (!trackId) {
      continue;
    }

    const song = JUKEBOX_SONGS_BY_ID.get(trackId);

    if (!song) {
      continue;
    }

    const videoId = extractYouTubeVideoId(song.youtubeUrl);

    if (!videoId) {
      continue;
    }

    return {
      objectId,
      trackId,
      trackLabel: typeof objectState.currentTrackLabel === 'string' && objectState.currentTrackLabel.length > 0
        ? objectState.currentTrackLabel
        : `${song.title} by ${song.artist}`,
      trackMode: typeof objectState.currentTrackMode === 'string' && objectState.currentTrackMode.length > 0
        ? objectState.currentTrackMode
        : undefined,
      trackStartedAtMs: readFinitePositiveNumber(objectState.currentTrackStartedAtMs),
      trackEndsAtMs: readFinitePositiveNumber(objectState.currentTrackEndsAtMs),
      snapshotNowMs: typeof sessionNowMs === 'number' && Number.isFinite(sessionNowMs)
        ? sessionNowMs
        : undefined,
      youtubeUrl: song.youtubeUrl,
      videoId,
      song,
    };
  }

  return undefined;
}

export function extractYouTubeVideoId(urlText: string): string | undefined {
  if (urlText.trim().length === 0) {
    return undefined;
  }

  let url: URL;

  try {
    url = new URL(urlText);
  } catch {
    return undefined;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  if (hostname === 'youtu.be') {
    return normalizeYouTubeVideoId(url.pathname.slice(1));
  }

  if (hostname !== 'youtube.com' && hostname !== 'm.youtube.com') {
    return undefined;
  }

  if (url.pathname === '/watch') {
    return normalizeYouTubeVideoId(url.searchParams.get('v') ?? '');
  }

  if (url.pathname.startsWith('/embed/')) {
    return normalizeYouTubeVideoId(url.pathname.slice('/embed/'.length));
  }

  if (url.pathname.startsWith('/shorts/')) {
    return normalizeYouTubeVideoId(url.pathname.slice('/shorts/'.length));
  }

  return undefined;
}

function normalizeYouTubeVideoId(value: string): string | undefined {
  const trimmedValue = value.trim();
  return /^[A-Za-z0-9_-]{6,}$/.test(trimmedValue) ? trimmedValue : undefined;
}

export function getJukeboxPlaybackStartOffsetSeconds(playback: Pick<JukeboxPlaybackState, 'song' | 'trackStartedAtMs' | 'trackEndsAtMs' | 'snapshotNowMs'>): number {
  if (typeof playback.trackStartedAtMs !== 'number' || typeof playback.snapshotNowMs !== 'number') {
    return 0;
  }

  const approxDurationMs = Math.max(0, playback.song.approxDurationSeconds * 1000);
  const elapsedMs = Math.max(0, playback.snapshotNowMs - playback.trackStartedAtMs);
  const elapsedUntilEndMs = typeof playback.trackEndsAtMs === 'number'
    ? Math.max(0, playback.trackEndsAtMs - playback.trackStartedAtMs)
    : approxDurationMs;
  const maxElapsedMs = Math.max(0, Math.min(approxDurationMs, elapsedUntilEndMs));

  return Math.max(0, Math.min(elapsedMs, maxElapsedMs)) / 1000;
}

function readFinitePositiveNumber(value: string | number | boolean | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}