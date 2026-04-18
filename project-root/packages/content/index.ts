export interface ContentProjectRecord {
  id: string;
  title: string;
  description: string;
  folderName: string;
  status: 'playable-demo' | 'placeholder';
  owner?: string;
  tools: string[];
  features: string[];
  publishedDate?: string;
  releaseStatus?: string;
  version?: string;
  genre?: string;
  rating?: string;
  contentWarnings: string[];
}

export interface ContentProjectAvailability {
  active?: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

interface ContentProjectMetadata {
  title: string;
  description: string;
  folderName: string;
  owner?: string;
  tools?: string[];
  features?: string[];
  publishedDate?: string;
  releaseStatus?: string;
  version?: string;
  genre?: string;
  rating?: string;
  contentWarnings?: string[];
  availability?: ContentProjectAvailability;
}

export const CONTENT_PROJECT_METADATA_BY_ID: Record<string, ContentProjectMetadata> = {
  demo: {
    title: 'demo',
    description: 'Area, path, and gate sample pages wired through projection and the renderer shell.',
    folderName: 'demo',
    owner: 'Ashley',
    tools: ['TypeScript', 'React', 'Markdown content'],
    features: ['Legacy sample', 'Area/path/gate baseline'],
    publishedDate: '2025-01-10',
    releaseStatus: 'retired',
    version: '0.1.0',
    genre: 'Spatial fiction prototype',
    rating: 'Teen',
    contentWarnings: ['knife threat', 'bad ending themes'],
    availability: {
      active: false,
    },
  },
  demo02: {
    title: 'Harbor Leaving',
    description: 'A small walk through old harbor roads, bad thresholds, and one possible way out.',
    folderName: 'demo02',
    owner: 'Ashley',
    tools: ['TypeScript', 'React', 'AI-assisted authoring'],
    features: ['Area nodes', 'Gate nodes', 'Path nodes', 'Spatial traversal system', 'Covers nearly every spatial-node implementation'],
    publishedDate: '2025-03-02',
    releaseStatus: 'complete',
    version: '0.2.0',
    genre: 'Coastal noir',
    rating: 'Teen',
    contentWarnings: ['knife threat', 'bad ending themes'],
    availability: {
      active: true,
    },
  },
  demo03: {
    title: 'Lantern Quarter',
    description: 'A compact MUD-style town block built around cardinal movement and readable room structure.',
    folderName: 'demo03',
    owner: 'Ashley',
    tools: ['TypeScript', 'React', 'AI-authored map and prose'],
    features: ['Area-node spatial model', 'Classic north south east west navigation', 'Readable room structure', 'Compact town-block exploration', 'AI-authored content experiment'],
    publishedDate: '2025-08-14',
    releaseStatus: 'finished',
    version: '0.3.0',
    genre: 'Town MUD',
    rating: 'All ages',
    contentWarnings: ['bad ending themes'],
    availability: {
      active: true,
    },
  },
  demo04: {
    title: 'Diorama Block',
    description: 'A tiny block for wandering, peeking in windows, and eventually calling it a night.',
    folderName: 'demo04',
    owner: 'Ashley',
    tools: ['TypeScript', 'React', 'AI-assisted authoring', 'Stateful runtime'],
    features: ['State machines in progress', 'State scripting engine in progress', 'Clock-driven world state', 'Weather shifts', 'Room-state reactions', 'Recent log and runtime feedback', 'Winning path is still a small mystery'],
    publishedDate: '2026-04-17',
    releaseStatus: 'state system in development',
    version: '0.4.0',
    genre: 'Diorama slice-of-life',
    rating: 'All ages',
    contentWarnings: [],
    availability: {
      active: true,
    },
  },
};

export function isContentProjectAvailable(projectId: string, now = new Date()): boolean {
  const availability = CONTENT_PROJECT_METADATA_BY_ID[projectId]?.availability;

  if (!availability) {
    return true;
  }

  if (availability.active === false) {
    return false;
  }

  const nowMs = now.getTime();
  const effectiveFromMs = parseAvailabilityDate(availability.effectiveFrom);
  const effectiveUntilMs = parseAvailabilityDate(availability.effectiveUntil, true);

  if (effectiveFromMs !== undefined && nowMs < effectiveFromMs) {
    return false;
  }

  if (effectiveUntilMs !== undefined && nowMs > effectiveUntilMs) {
    return false;
  }

  return true;
}

function parseAvailabilityDate(value: string | undefined, endOfDay = false): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
    : value;
  const parsed = Date.parse(normalized);

  return Number.isNaN(parsed) ? undefined : parsed;
}

export function buildContentProjectRecord(
  projectId: string,
  status: ContentProjectRecord['status'],
): ContentProjectRecord {
  const metadata = CONTENT_PROJECT_METADATA_BY_ID[projectId];

  return {
    id: projectId,
    title: metadata?.title ?? projectId,
    description: metadata?.description ?? 'Discovered content project.',
    folderName: metadata?.folderName ?? projectId,
    status,
    owner: metadata?.owner,
    tools: metadata?.tools ?? [],
    features: metadata?.features ?? [],
    publishedDate: metadata?.publishedDate,
    releaseStatus: metadata?.releaseStatus,
    version: metadata?.version,
    genre: metadata?.genre,
    rating: metadata?.rating,
    contentWarnings: metadata?.contentWarnings ?? [],
  };
}