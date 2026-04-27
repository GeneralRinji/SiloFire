import type { KeyValueStore } from '../../storage/src';

export type SiteAnnouncementScope = 'site';

export type SiteAnnouncementMode = 'dismissible' | 'blocking' | 'persistent';

export type SiteAnnouncementColorTone = 'neutral' | 'info' | 'warning' | 'critical';

export interface SiteAnnouncementRecord {
  id: string;
  scope: SiteAnnouncementScope;
  title: string;
  body: string;
  mode: SiteAnnouncementMode;
  priority: number;
  startsAtMs?: number;
  endsAtMs?: number;
  linkHref?: string;
  linkLabel?: string;
  colorTone?: SiteAnnouncementColorTone;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SiteAnnouncementSnapshot {
  calendarScope: SiteAnnouncementScope;
  currentTimeMs: number;
  nextChangeAtMs?: number;
  activeAnnouncements: SiteAnnouncementRecord[];
  upcomingAnnouncements: SiteAnnouncementRecord[];
  expiredAnnouncements: SiteAnnouncementRecord[];
}

export interface AdminSiteAnnouncementSnapshot extends SiteAnnouncementSnapshot {
  disabledAnnouncements: SiteAnnouncementRecord[];
  allAnnouncements: SiteAnnouncementRecord[];
}

export interface SiteAnnouncementInput {
  title: string;
  body: string;
  mode: SiteAnnouncementMode;
  priority: number;
  startsAtMs?: number;
  endsAtMs?: number;
  linkHref?: string;
  linkLabel?: string;
  colorTone?: SiteAnnouncementColorTone;
  enabled: boolean;
}

export type SiteAnnouncementMutationResult =
  | { kind: 'ok'; value: SiteAnnouncementRecord }
  | { kind: 'validation_error'; errors: string[] }
  | { kind: 'not_found' };

const SITE_ANNOUNCEMENT_PREFIX = 'site';
const VALID_MODES: SiteAnnouncementMode[] = ['dismissible', 'blocking', 'persistent'];
const VALID_COLOR_TONES: SiteAnnouncementColorTone[] = ['neutral', 'info', 'warning', 'critical'];

export async function buildSiteAnnouncementSnapshot(
  store: KeyValueStore<SiteAnnouncementRecord>,
  nowMs: number,
): Promise<SiteAnnouncementSnapshot> {
  const allAnnouncements = await listSiteAnnouncements(store);
  const enabledAnnouncements = allAnnouncements.filter((announcement) => announcement.enabled);

  return {
    calendarScope: 'site',
    currentTimeMs: nowMs,
    nextChangeAtMs: resolveNextAnnouncementChangeAtMs(enabledAnnouncements, nowMs),
    activeAnnouncements: sortSiteAnnouncements(allAnnouncements.filter((announcement) => isActiveAt(announcement, nowMs))),
    upcomingAnnouncements: sortSiteAnnouncements(allAnnouncements.filter((announcement) => isUpcomingAt(announcement, nowMs))),
    expiredAnnouncements: sortSiteAnnouncements(allAnnouncements.filter((announcement) => isExpiredAt(announcement, nowMs))),
  };
}

export async function buildAdminSiteAnnouncementSnapshot(
  store: KeyValueStore<SiteAnnouncementRecord>,
  nowMs: number,
): Promise<AdminSiteAnnouncementSnapshot> {
  const allAnnouncements = sortSiteAnnouncements(await listSiteAnnouncements(store));
  const enabledAnnouncements = allAnnouncements.filter((announcement) => announcement.enabled);

  return {
    calendarScope: 'site',
    currentTimeMs: nowMs,
    nextChangeAtMs: resolveNextAnnouncementChangeAtMs(enabledAnnouncements, nowMs),
    activeAnnouncements: allAnnouncements.filter((announcement) => isActiveAt(announcement, nowMs)),
    upcomingAnnouncements: allAnnouncements.filter((announcement) => isUpcomingAt(announcement, nowMs)),
    expiredAnnouncements: allAnnouncements.filter((announcement) => isExpiredAt(announcement, nowMs)),
    disabledAnnouncements: allAnnouncements.filter((announcement) => !announcement.enabled),
    allAnnouncements,
  };
}

export function siteAnnouncementKey(id: string): string {
  return `${SITE_ANNOUNCEMENT_PREFIX}/${id}`;
}

export function validateSiteAnnouncementInput(input: unknown):
  | { ok: true; value: SiteAnnouncementInput }
  | { ok: false; errors: string[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      errors: ['Announcement input must be an object.'],
    };
  }

  const record = input as Record<string, unknown>;
  const errors: string[] = [];
  const title = normalizeRequiredText(record.title, 'Title', errors);
  const body = normalizeRequiredText(record.body, 'Body', errors);
  const mode = normalizeMode(record.mode, errors);
  const priority = normalizePriority(record.priority, errors);
  const startsAtMs = normalizeOptionalTimestamp(record.startsAtMs, 'startsAtMs', errors);
  const endsAtMs = normalizeOptionalTimestamp(record.endsAtMs, 'endsAtMs', errors);
  const linkHref = normalizeOptionalLinkHref(record.linkHref, errors);
  const linkLabel = normalizeOptionalText(record.linkLabel);
  const colorTone = normalizeOptionalColorTone(record.colorTone, errors);
  const enabled = normalizeEnabled(record.enabled, errors);

  if (startsAtMs !== undefined && endsAtMs !== undefined && startsAtMs > endsAtMs) {
    errors.push('startsAtMs must be less than or equal to endsAtMs.');
  }

  if (!linkHref && linkLabel) {
    errors.push('linkLabel requires linkHref.');
  }

  if (errors.length > 0 || !title || !body || !mode || priority === undefined || enabled === undefined) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    value: {
      title,
      body,
      mode,
      priority,
      startsAtMs,
      endsAtMs,
      linkHref,
      linkLabel,
      colorTone,
      enabled,
    },
  };
}

export function createSiteAnnouncementRecord(
  id: string,
  input: SiteAnnouncementInput,
  nowMs: number,
  createdAtMs = nowMs,
): SiteAnnouncementRecord {
  return {
    id,
    scope: 'site',
    title: input.title,
    body: input.body,
    mode: input.mode,
    priority: input.priority,
    startsAtMs: input.startsAtMs,
    endsAtMs: input.endsAtMs,
    linkHref: input.linkHref,
    linkLabel: input.linkLabel,
    colorTone: input.colorTone,
    enabled: input.enabled,
    createdAtMs,
    updatedAtMs: nowMs,
  };
}

export async function getSiteAnnouncementRecord(
  store: KeyValueStore<SiteAnnouncementRecord>,
  id: string,
): Promise<SiteAnnouncementRecord | undefined> {
  const value = await store.get(siteAnnouncementKey(id));
  return isSiteAnnouncementRecord(value) ? value : undefined;
}

async function listSiteAnnouncements(
  store: KeyValueStore<SiteAnnouncementRecord>,
): Promise<SiteAnnouncementRecord[]> {
  const announcements: SiteAnnouncementRecord[] = [];

  for await (const entry of store.list(SITE_ANNOUNCEMENT_PREFIX)) {
    if (isSiteAnnouncementRecord(entry.value)) {
      announcements.push(entry.value);
    }
  }

  return announcements;
}

function isActiveAt(announcement: SiteAnnouncementRecord, nowMs: number): boolean {
  return announcement.enabled
    && (announcement.startsAtMs === undefined || announcement.startsAtMs <= nowMs)
    && (announcement.endsAtMs === undefined || announcement.endsAtMs >= nowMs);
}

function isUpcomingAt(announcement: SiteAnnouncementRecord, nowMs: number): boolean {
  return announcement.enabled
    && announcement.startsAtMs !== undefined
    && announcement.startsAtMs > nowMs;
}

function isExpiredAt(announcement: SiteAnnouncementRecord, nowMs: number): boolean {
  return announcement.enabled
    && announcement.endsAtMs !== undefined
    && announcement.endsAtMs < nowMs;
}

function resolveNextAnnouncementChangeAtMs(
  announcements: SiteAnnouncementRecord[],
  nowMs: number,
): number | undefined {
  let nextChangeAtMs: number | undefined;

  for (const announcement of announcements) {
    const candidates = [announcement.startsAtMs, announcement.endsAtMs];

    for (const candidate of candidates) {
      if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
        continue;
      }

      if (candidate < nowMs) {
        continue;
      }

      if (nextChangeAtMs === undefined || candidate < nextChangeAtMs) {
        nextChangeAtMs = candidate;
      }
    }
  }

  return nextChangeAtMs;
}

function sortSiteAnnouncements(announcements: SiteAnnouncementRecord[]): SiteAnnouncementRecord[] {
  return [...announcements].sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    const leftPersistentWeight = left.mode === 'persistent' ? 0 : 1;
    const rightPersistentWeight = right.mode === 'persistent' ? 0 : 1;

    if (leftPersistentWeight !== rightPersistentWeight) {
      return leftPersistentWeight - rightPersistentWeight;
    }

    const leftStart = left.startsAtMs ?? Number.MAX_SAFE_INTEGER;
    const rightStart = right.startsAtMs ?? Number.MAX_SAFE_INTEGER;

    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    return left.id.localeCompare(right.id);
  });
}

function isSiteAnnouncementRecord(value: unknown): value is SiteAnnouncementRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.scope === 'site'
    && typeof record.id === 'string'
    && typeof record.title === 'string'
    && typeof record.body === 'string'
    && VALID_MODES.includes(record.mode as SiteAnnouncementMode)
    && typeof record.priority === 'number'
    && Number.isFinite(record.priority)
    && (record.startsAtMs === undefined || (typeof record.startsAtMs === 'number' && Number.isFinite(record.startsAtMs)))
    && (record.endsAtMs === undefined || (typeof record.endsAtMs === 'number' && Number.isFinite(record.endsAtMs)))
    && (record.linkHref === undefined || typeof record.linkHref === 'string')
    && (record.linkLabel === undefined || typeof record.linkLabel === 'string')
    && (record.colorTone === undefined || VALID_COLOR_TONES.includes(record.colorTone as SiteAnnouncementColorTone))
    && typeof record.enabled === 'boolean'
    && typeof record.createdAtMs === 'number'
    && Number.isFinite(record.createdAtMs)
    && typeof record.updatedAtMs === 'number'
    && Number.isFinite(record.updatedAtMs);
}

function normalizeRequiredText(value: unknown, label: string, errors: string[]): string | undefined {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    errors.push(`${label} is required.`);
  }

  return normalized;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMode(value: unknown, errors: string[]): SiteAnnouncementMode | undefined {
  if (!VALID_MODES.includes(value as SiteAnnouncementMode)) {
    errors.push('Mode must be one of dismissible, blocking, or persistent.');
    return undefined;
  }

  return value as SiteAnnouncementMode;
}

function normalizePriority(value: unknown, errors: string[]): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push('Priority must be a finite number.');
    return undefined;
  }

  return value;
}

function normalizeOptionalTimestamp(value: unknown, label: string, errors: string[]): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number when provided.`);
    return undefined;
  }

  return value;
}

function normalizeOptionalLinkHref(value: unknown, errors: string[]): string | undefined {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return undefined;
  }

  const isRelativePath = normalized.startsWith('/') && !normalized.startsWith('//');
  const isHttpUrl = /^https?:\/\//i.test(normalized);

  if (!isRelativePath && !isHttpUrl) {
    errors.push('linkHref must be a relative path or an http/https URL.');
    return undefined;
  }

  return normalized;
}

function normalizeOptionalColorTone(value: unknown, errors: string[]): SiteAnnouncementColorTone | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (!VALID_COLOR_TONES.includes(value as SiteAnnouncementColorTone)) {
    errors.push('colorTone must be one of neutral, info, warning, or critical.');
    return undefined;
  }

  return value as SiteAnnouncementColorTone;
}

function normalizeEnabled(value: unknown, errors: string[]): boolean | undefined {
  if (typeof value !== 'boolean') {
    errors.push('enabled must be a boolean.');
    return undefined;
  }

  return value;
}