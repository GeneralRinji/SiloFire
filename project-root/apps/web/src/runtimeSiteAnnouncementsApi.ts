import type { SiteAnnouncementSnapshot } from '../../../packages/runtime-server/src';

export interface RuntimeSiteAnnouncementStream {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface ServerRuntimeSiteAnnouncementSource {
  subscribe(callbacks?: {
    onUpdate?: (snapshot: SiteAnnouncementSnapshot) => void;
    onError?: (error: unknown) => void;
  }): () => void;
}

export async function getRuntimeSiteAnnouncementSnapshot(): Promise<SiteAnnouncementSnapshot | undefined> {
  let response: Response;

  try {
    response = await fetch('/api/site-announcements');
  } catch (error) {
    console.error('Site announcement request failed.', error);
    return undefined;
  }

  if (!response.ok) {
    return undefined;
  }

  return response.json() as Promise<SiteAnnouncementSnapshot>;
}

export function createServerRuntimeSiteAnnouncementSource(
  streamFactory: (url: string) => RuntimeSiteAnnouncementStream = (url) => new EventSource(url),
): ServerRuntimeSiteAnnouncementSource {
  return {
    subscribe(callbacks) {
      const stream = streamFactory(buildRuntimeSiteAnnouncementStreamUrl());

      stream.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          return;
        }

        callbacks?.onUpdate?.(JSON.parse(event.data) as SiteAnnouncementSnapshot);
      };

      stream.onerror = (error) => {
        callbacks?.onError?.(error);
      };

      return () => {
        stream.onmessage = null;
        stream.onerror = null;
        stream.close();
      };
    },
  };
}

export function buildRuntimeSiteAnnouncementStreamUrl(): string {
  return '/api/site-announcements/stream';
}