import { useEffect, useRef, useState } from 'react';

import { getJukeboxPlaybackStartOffsetSeconds, type JukeboxPlaybackState } from '../jukeboxPlayback';

const SIDEBAR_JUKEBOX_MUTE_STORAGE_KEY = 'silofire.jukebox.muted';
const JUKEBOX_TRACK_END_GAP_MS = 5_000;
const YOUTUBE_PLAYER_STATE_ENDED = 0;
const YOUTUBE_PLAYER_STATE_PAUSED = 2;

interface SidebarJukeboxPlayerProps {
  playback: JukeboxPlaybackState;
  visible?: boolean;
  onPlaybackEnded?: () => void | Promise<void>;
}

interface YouTubePlayer {
  destroy(): void;
  getCurrentTime(): number;
  loadVideoById(videoId: string): void;
  mute(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  unMute(): void;
  playVideo(): void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data: number;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      width: number;
      height: number;
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: YouTubePlayerEvent) => void;
        onStateChange?: (event: YouTubePlayerEvent) => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
    __silofireYouTubeIframeApiPromise?: Promise<YouTubeNamespace>;
  }
}

export function SidebarJukeboxPlayer({ playback, visible = true, onPlaybackEnded }: SidebarJukeboxPlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const loadedTrackIdRef = useRef<string | undefined>();
  const latestTrackIdRef = useRef(playback.trackId);
  const endedTimerRef = useRef<number | undefined>();
  const [isMuted, setIsMuted] = useState(() => readStoredJukeboxMutePreference());

  useEffect(() => {
    latestTrackIdRef.current = playback.trackId;
    clearEndedTimer(endedTimerRef.current);
    endedTimerRef.current = undefined;
  }, [playback.trackId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hostRef.current) {
      return undefined;
    }

    let canceled = false;

    void loadYouTubeIframeApi().then((YT) => {
      if (canceled || !hostRef.current) {
        return;
      }

      if (!playerRef.current) {
        playerRef.current = new YT.Player(hostRef.current, {
          width: 168,
          height: 96,
          videoId: playback.videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              loadedTrackIdRef.current = playback.trackId;
              syncPlayerToPlayback(event.target, playback, isMuted);
            },
            onStateChange: (event) => {
              if (event.data === YOUTUBE_PLAYER_STATE_PAUSED) {
                window.setTimeout(() => {
                  event.target.playVideo();
                }, 50);
                return;
              }

              if (event.data !== YOUTUBE_PLAYER_STATE_ENDED) {
                return;
              }

              clearEndedTimer(endedTimerRef.current);
              endedTimerRef.current = window.setTimeout(() => {
                if (latestTrackIdRef.current !== playback.trackId) {
                  return;
                }

                void onPlaybackEnded?.();
              }, JUKEBOX_TRACK_END_GAP_MS);
            },
          },
        });

        return;
      }

      if (loadedTrackIdRef.current !== playback.trackId) {
        loadedTrackIdRef.current = playback.trackId;
        playerRef.current.loadVideoById(playback.videoId);
        syncPlayerToPlayback(playerRef.current, playback, isMuted);
      }
    }).catch((error) => {
      console.error('Unable to load YouTube iframe API.', error);
    });

    return () => {
      canceled = true;
    };
  }, [isMuted, onPlaybackEnded, playback.trackId, playback.videoId]);

  useEffect(() => {
    syncPlayerMuteState(playerRef.current, isMuted);
    writeStoredJukeboxMutePreference(isMuted);
  }, [isMuted]);

  function handleAudioToggle() {
    const nextMuted = !isMuted;

    setIsMuted(nextMuted);

    if (!nextMuted) {
      playerRef.current?.unMute();
      playerRef.current?.playVideo();
      return;
    }

    playerRef.current?.mute();
  }

  useEffect(() => () => {
    clearEndedTimer(endedTimerRef.current);
    endedTimerRef.current = undefined;
    playerRef.current?.destroy();
    playerRef.current = null;
  }, []);

  return (
    <section className={visible ? 'terminal-block terminal-block--jukebox-airplay' : 'terminal-block terminal-block--jukebox-airplay terminal-block--jukebox-airplay-hidden'}>
      <div className="jukebox-airplay__header">
        <p className="terminal-label">Jukebox Airplay</p>
        <button
          type="button"
          className="terminal-link terminal-link--muted"
          onClick={handleAudioToggle}
        >
          {isMuted ? 'unmute' : 'mute'}
        </button>
      </div>

      <p className="terminal-copy terminal-copy--strong">
        now/{playback.song.title} - {playback.song.artist}
      </p>
      <p className="terminal-copy">
        source/youtube{playback.trackMode ? ` | mode/${playback.trackMode}` : ''}
      </p>

      <div className="jukebox-airplay__viewport" aria-label={`Now playing ${playback.song.title} by ${playback.song.artist}`}>
        <div ref={hostRef} className="jukebox-airplay__player" />
      </div>
    </section>
  );
}

function syncPlayerToPlayback(player: YouTubePlayer, playback: JukeboxPlaybackState, muted: boolean): void {
  syncPlayerMuteState(player, muted);

  const startOffsetSeconds = getJukeboxPlaybackStartOffsetSeconds(playback);

  if (startOffsetSeconds > 0) {
    player.seekTo(startOffsetSeconds, true);
  }

  player.playVideo();
}

function syncPlayerMuteState(player: YouTubePlayer | null, muted: boolean): void {
  if (!player) {
    return;
  }

  if (muted) {
    player.mute();
    return;
  }

  player.unMute();
}

function clearEndedTimer(timerId: number | undefined): void {
  if (typeof window === 'undefined' || timerId === undefined) {
    return;
  }

  window.clearTimeout(timerId);
}

function readStoredJukeboxMutePreference(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const value = window.localStorage.getItem(SIDEBAR_JUKEBOX_MUTE_STORAGE_KEY);

    if (value === 'false') {
      return false;
    }

    if (value === 'true') {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function writeStoredJukeboxMutePreference(muted: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(SIDEBAR_JUKEBOX_MUTE_STORAGE_KEY, String(muted));
  } catch {
    // Ignore client-only preference write failures.
  }
}

function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube iframe API requires a browser window.'));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (window.__silofireYouTubeIframeApiPromise) {
    return window.__silofireYouTubeIframeApiPromise;
  }

  window.__silofireYouTubeIframeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-silofire-youtube-api="true"]');
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();

      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }

      reject(new Error('YouTube iframe API loaded without a Player constructor.'));
    };

    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.dataset.silofireYoutubeApi = 'true';
    script.onerror = () => reject(new Error('Unable to load YouTube iframe API script.'));
    document.head.appendChild(script);
  });

  return window.__silofireYouTubeIframeApiPromise;
}