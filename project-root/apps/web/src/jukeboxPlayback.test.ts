import test from 'node:test';
import assert from 'node:assert/strict';

import { findActiveJukeboxPlayback, getJukeboxPlaybackStartOffsetSeconds } from './jukeboxPlayback';

test('findActiveJukeboxPlayback includes server track timing for the active jukebox song', () => {
  const playback = findActiveJukeboxPlayback({
    prototypehub_lobby_jukebox: {
      currentTrack: 'song_003',
      currentTrackLabel: 'Never Gonna Give You Up by Rick Astley',
      currentTrackMode: 'paid',
      currentTrackStartedAtMs: 30_000,
      currentTrackEndsAtMs: 243_000,
    },
  }, 90_000);

  assert.ok(playback);
  assert.equal(playback.trackId, 'song_003');
  assert.equal(playback.trackStartedAtMs, 30_000);
  assert.equal(playback.trackEndsAtMs, 243_000);
  assert.equal(playback.snapshotNowMs, 90_000);
  assert.equal(getJukeboxPlaybackStartOffsetSeconds(playback), 60);
});

test('getJukeboxPlaybackStartOffsetSeconds clamps to the authored song duration window', () => {
  const playback = findActiveJukeboxPlayback({
    prototypehub_lobby_jukebox: {
      currentTrack: 'song_011',
      currentTrackStartedAtMs: 1_000,
      currentTrackEndsAtMs: 200_000,
    },
  }, 999_999);

  assert.ok(playback);
  assert.equal(getJukeboxPlaybackStartOffsetSeconds(playback), playback.song.approxDurationSeconds);
});