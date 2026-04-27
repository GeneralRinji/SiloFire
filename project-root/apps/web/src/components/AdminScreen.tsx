import { useState } from 'react';
import type {
  AdminSiteAnnouncementSnapshot,
  RuntimeAdminProjectHeartDetails,
  RuntimeAdminProjectHeartSummary,
  SiteAnnouncementInput,
  SiteAnnouncementMode,
  SiteAnnouncementRecord,
} from '../../../../packages/runtime-server/src';
import { ProjectStatePanes } from './ProjectStatePanes';

interface AdminGateScreenProps {
  errorText?: string;
  onBackHome: () => void;
  onUnlock: (password: string) => void;
}

export function AdminGateScreen({ errorText, onBackHome, onUnlock }: AdminGateScreenProps) {
  const [password, setPassword] = useState('');

  return (
    <main className="terminal-shell">
      <section className="terminal-screen terminal-screen--admin">
        <div className="terminal-block admin-screen__hero">
          <p className="terminal-path">silofire:/admin</p>
          <h1 className="terminal-title">Website Admin</h1>
          <p className="terminal-copy">Heart analytics and runtime inspection live here, separate from public project play.</p>
          <div className="admin-screen__actions">
            <button type="button" className="terminal-link terminal-link--muted" onClick={onBackHome}>return/home</button>
          </div>
        </div>

        <div className="terminal-block admin-screen__gate">
          <p className="terminal-label">Password Gate</p>
          <label className="admin-screen__field">
            <span className="terminal-copy">shared-password</span>
            <input
              type="password"
              className="admin-screen__input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && password.trim().length > 0) {
                  onUnlock(password.trim());
                }
              }}
            />
          </label>
          {errorText ? <p className="terminal-copy admin-screen__error">{errorText}</p> : null}
          <button type="button" className="splash-home__cta" onClick={() => onUnlock(password.trim())} disabled={password.trim().length === 0}>
            unlock/admin
          </button>
        </div>
      </section>
    </main>
  );
}

interface AdminOverviewScreenProps {
  isLoading?: boolean;
  projects: RuntimeAdminProjectHeartSummary[];
  siteAnnouncements?: AdminSiteAnnouncementSnapshot;
  onBackHome: () => void;
  onOpenProject: (projectId: string) => void;
  onSignOut: () => void;
  onCreateSiteAnnouncement: (input: SiteAnnouncementInput) => Promise<string[] | undefined>;
  onUpdateSiteAnnouncement: (announcementId: string, input: SiteAnnouncementInput) => Promise<string[] | undefined>;
  onDeleteSiteAnnouncement: (announcementId: string) => Promise<string[] | undefined>;
}

type SiteAnnouncementFormState = {
  title: string;
  body: string;
  mode: SiteAnnouncementMode;
  priority: string;
  startsAt: string;
  endsAt: string;
  linkHref: string;
  linkLabel: string;
  colorTone: '' | 'neutral' | 'info' | 'warning' | 'critical';
  enabled: boolean;
};

const DEFAULT_SITE_ANNOUNCEMENT_FORM_STATE: SiteAnnouncementFormState = {
  title: '',
  body: '',
  mode: 'dismissible',
  priority: '10',
  startsAt: '',
  endsAt: '',
  linkHref: '',
  linkLabel: '',
  colorTone: '',
  enabled: true,
};

export function AdminOverviewScreen({
  isLoading,
  projects,
  siteAnnouncements,
  onBackHome,
  onOpenProject,
  onSignOut,
  onCreateSiteAnnouncement,
  onUpdateSiteAnnouncement,
  onDeleteSiteAnnouncement,
}: AdminOverviewScreenProps) {
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | undefined>();
  const [formState, setFormState] = useState<SiteAnnouncementFormState>(DEFAULT_SITE_ANNOUNCEMENT_FORM_STATE);
  const [formErrorText, setFormErrorText] = useState<string | undefined>();
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const calendarAnnouncements = siteAnnouncements?.allAnnouncements ?? [];

  const groupedAnnouncements = [
    { label: 'Active', announcements: siteAnnouncements?.activeAnnouncements ?? [] },
    { label: 'Upcoming', announcements: siteAnnouncements?.upcomingAnnouncements ?? [] },
    { label: 'Expired', announcements: siteAnnouncements?.expiredAnnouncements ?? [] },
    { label: 'Disabled', announcements: siteAnnouncements?.disabledAnnouncements ?? [] },
  ];

  function beginEdit(announcement: SiteAnnouncementRecord): void {
    setEditingAnnouncementId(announcement.id);
    setFormErrorText(undefined);
    setFormState({
      title: announcement.title,
      body: announcement.body,
      mode: announcement.mode,
      priority: String(announcement.priority),
      startsAt: formatMsForDatetimeLocal(announcement.startsAtMs),
      endsAt: formatMsForDatetimeLocal(announcement.endsAtMs),
      linkHref: announcement.linkHref ?? '',
      linkLabel: announcement.linkLabel ?? '',
      colorTone: announcement.colorTone ?? '',
      enabled: announcement.enabled,
    });
  }

  function resetForm(): void {
    setEditingAnnouncementId(undefined);
    setFormErrorText(undefined);
    setFormState(DEFAULT_SITE_ANNOUNCEMENT_FORM_STATE);
  }

  async function handleSubmit(): Promise<void> {
    const parsedInput = parseSiteAnnouncementFormState(formState);

    if (!parsedInput.ok) {
      setFormErrorText(parsedInput.errorText);
      return;
    }

    setIsSavingAnnouncement(true);
    const errors = editingAnnouncementId
      ? await onUpdateSiteAnnouncement(editingAnnouncementId, parsedInput.value)
      : await onCreateSiteAnnouncement(parsedInput.value);
    setIsSavingAnnouncement(false);

    if (errors && errors.length > 0) {
      setFormErrorText(errors.join(' '));
      return;
    }

    resetForm();
  }

  async function handleDelete(announcementId: string): Promise<void> {
    const errors = await onDeleteSiteAnnouncement(announcementId);

    if (errors && errors.length > 0) {
      setFormErrorText(errors.join(' '));
      return;
    }

    if (editingAnnouncementId === announcementId) {
      resetForm();
    }
  }

  return (
    <main className="terminal-shell">
      <section className="terminal-screen terminal-screen--admin">
        <div className="terminal-block admin-screen__hero">
          <p className="terminal-path">silofire:/admin/hearts</p>
          <h1 className="terminal-title">Heart Analytics</h1>
          <p className="terminal-copy">Projects ranked by total hearts across all tracked nodes.</p>
          <div className="admin-screen__actions">
            <button type="button" className="terminal-link terminal-link--muted" onClick={onBackHome}>return/home</button>
            <button type="button" className="terminal-link terminal-link--muted" onClick={onSignOut}>sign/out</button>
          </div>
        </div>

        <div className="terminal-block admin-screen__list">
          <p className="terminal-label">Projects Ranked</p>
          {isLoading ? <p className="terminal-copy">Loading analytics…</p> : null}
          <ul className="terminal-list admin-screen__project-list">
            {projects.map((project, index) => (
              <li key={project.projectId} className="terminal-list__item terminal-list__item--project admin-screen__project-item">
                <div>
                  <p className="terminal-list__title">{index + 1}. {project.title}</p>
                  <p className="terminal-copy">project/{project.projectId}</p>
                </div>
                <div className="admin-screen__project-metrics">
                  <p className="terminal-copy terminal-copy--strong">hearts/{project.totalHearts}</p>
                  <p className="terminal-copy">nodes/{project.nodeCount}</p>
                  <button type="button" className="terminal-link" onClick={() => onOpenProject(project.projectId)}>
                    inspect/project
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="terminal-block admin-screen__detail-block">
          <p className="terminal-label">Site Announcements</p>
          <p className="terminal-copy">server-time/{siteAnnouncements?.currentTimeMs ? new Date(siteAnnouncements.currentTimeMs).toLocaleString() : 'unavailable'}</p>
          <p className="terminal-copy">calendar-scope/{siteAnnouncements?.calendarScope ?? 'site'}</p>
          <div className="admin-screen__announcement-editor">
            <label className="admin-screen__field">
              <span className="terminal-copy">title</span>
              <input className="admin-screen__input" value={formState.title} onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="admin-screen__field">
              <span className="terminal-copy">body</span>
              <textarea className="admin-screen__input admin-screen__textarea" value={formState.body} onChange={(event) => setFormState((current) => ({ ...current, body: event.target.value }))} />
            </label>
            <div className="admin-screen__announcement-grid">
              <label className="admin-screen__field">
                <span className="terminal-copy">mode</span>
                <select className="admin-screen__input" value={formState.mode} onChange={(event) => setFormState((current) => ({ ...current, mode: event.target.value as SiteAnnouncementMode }))}>
                  <option value="dismissible">dismissible</option>
                  <option value="blocking">blocking</option>
                  <option value="persistent">persistent</option>
                </select>
              </label>
              <label className="admin-screen__field">
                <span className="terminal-copy">priority</span>
                <input className="admin-screen__input" type="number" value={formState.priority} onChange={(event) => setFormState((current) => ({ ...current, priority: event.target.value }))} />
              </label>
              <label className="admin-screen__field">
                <span className="terminal-copy">starts-at</span>
                <input className="admin-screen__input" type="datetime-local" value={formState.startsAt} onChange={(event) => setFormState((current) => ({ ...current, startsAt: event.target.value }))} />
              </label>
              <label className="admin-screen__field">
                <span className="terminal-copy">ends-at</span>
                <input className="admin-screen__input" type="datetime-local" value={formState.endsAt} onChange={(event) => setFormState((current) => ({ ...current, endsAt: event.target.value }))} />
              </label>
              <label className="admin-screen__field">
                <span className="terminal-copy">link-href</span>
                <input
                  className="admin-screen__input"
                  placeholder="optional: /status or https://status.example.com"
                  value={formState.linkHref}
                  onChange={(event) => setFormState((current) => ({ ...current, linkHref: event.target.value }))}
                />
              </label>
              <label className="admin-screen__field">
                <span className="terminal-copy">link-label</span>
                <input
                  className="admin-screen__input"
                  placeholder="optional when link-href is set"
                  value={formState.linkLabel}
                  onChange={(event) => setFormState((current) => ({ ...current, linkLabel: event.target.value }))}
                />
              </label>
              <label className="admin-screen__field">
                <span className="terminal-copy">color-tone</span>
                <select className="admin-screen__input" value={formState.colorTone} onChange={(event) => setFormState((current) => ({ ...current, colorTone: event.target.value as SiteAnnouncementFormState['colorTone'] }))}>
                  <option value="">default</option>
                  <option value="neutral">neutral</option>
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="critical">critical</option>
                </select>
              </label>
              <label className="admin-screen__field admin-screen__checkbox-field">
                <span className="terminal-copy">enabled</span>
                <input type="checkbox" checked={formState.enabled} onChange={(event) => setFormState((current) => ({ ...current, enabled: event.target.checked }))} />
              </label>
            </div>
            {formErrorText ? <p className="terminal-copy admin-screen__error">{formErrorText}</p> : null}
            <div className="admin-screen__actions">
              <button type="button" className="splash-home__cta" disabled={isSavingAnnouncement} onClick={() => { void handleSubmit(); }}>
                {editingAnnouncementId ? 'update/announcement' : 'create/announcement'}
              </button>
              {editingAnnouncementId ? (
                <button type="button" className="terminal-link terminal-link--muted" onClick={resetForm}>
                  cancel/edit
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="terminal-block admin-screen__detail-block">
          <p className="terminal-label">Announcement Calendar</p>
          <SiteAnnouncementCalendar announcements={calendarAnnouncements} currentTimeMs={siteAnnouncements?.currentTimeMs} />
        </div>

        <div className="terminal-block admin-screen__detail-block">
          <p className="terminal-label">Announcement Timeline</p>
          {groupedAnnouncements.map((group) => (
            <div key={group.label} className="admin-screen__announcement-group">
              <p className="terminal-copy terminal-copy--strong">{group.label}</p>
              {group.announcements.length === 0 ? <p className="terminal-copy">No announcements.</p> : null}
              <ul className="terminal-list admin-screen__announcement-list">
                {group.announcements.map((announcement) => (
                  <li key={announcement.id} className="terminal-list__item admin-screen__announcement-item">
                    <div>
                      <p className="terminal-list__title">{announcement.title}</p>
                      <p className="terminal-copy">mode/{announcement.mode} priority/{announcement.priority} enabled/{announcement.enabled ? 'true' : 'false'}</p>
                      <p className="terminal-copy">starts/{formatAnnouncementTime(announcement.startsAtMs)} ends/{formatAnnouncementTime(announcement.endsAtMs)}</p>
                    </div>
                    <div className="admin-screen__actions">
                      <button type="button" className="terminal-link" onClick={() => beginEdit(announcement)}>edit</button>
                      <button type="button" className="terminal-link terminal-link--muted" onClick={() => { void handleDelete(announcement.id); }}>delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

interface SiteAnnouncementCalendarProps {
  announcements: SiteAnnouncementRecord[];
  currentTimeMs?: number;
}

type AnnouncementCalendarDay = {
  key: string;
  dayOfMonth: number;
  startMs: number;
  endMs: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

type AnnouncementCalendarMonth = {
  key: string;
  title: string;
  startMs: number;
  endMs: number;
  days: AnnouncementCalendarDay[];
  visibleAnnouncements: SiteAnnouncementRecord[];
};

const ANNOUNCEMENT_CALENDAR_VISIBLE_MONTH_COUNT = 2;
const CALENDAR_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CALENDAR_WEEKDAY_LABELS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function SiteAnnouncementCalendar({ announcements, currentTimeMs }: SiteAnnouncementCalendarProps) {
  const effectiveCurrentTimeMs = currentTimeMs ?? Date.now();
  const currentMonthStartMs = startOfMonthMs(effectiveCurrentTimeMs);
  const [calendarCursorMonthMs, setCalendarCursorMonthMs] = useState<number>(currentMonthStartMs);
  const months = buildVisibleAnnouncementCalendarMonths(
    announcements,
    calendarCursorMonthMs,
    ANNOUNCEMENT_CALENDAR_VISIBLE_MONTH_COUNT,
    effectiveCurrentTimeMs,
  );
  const firstVisibleMonth = months[0];
  const lastVisibleMonth = months[months.length - 1];

  return (
    <div className="admin-screen__announcement-calendar">
      <div className="admin-screen__announcement-calendar-summary">
        <p className="terminal-copy">view/month-grid</p>
        <p className="terminal-copy">current-day/{formatCalendarHeadlineDate(effectiveCurrentTimeMs)}</p>
        <p className="terminal-copy">months-visible/{months.length}</p>
        <p className="terminal-copy">range/{firstVisibleMonth?.title ?? 'none'} -&gt; {lastVisibleMonth?.title ?? 'none'}</p>
      </div>
      <div className="admin-screen__announcement-calendar-nav">
        <button
          type="button"
          className="terminal-link terminal-link--muted"
          onClick={() => setCalendarCursorMonthMs((current) => addMonthsMs(current, -1))}
        >
          calendar/prev-month
        </button>
        <button
          type="button"
          className="terminal-link terminal-link--muted"
          onClick={() => setCalendarCursorMonthMs(currentMonthStartMs)}
        >
          calendar/current-month
        </button>
        <button
          type="button"
          className="terminal-link"
          onClick={() => setCalendarCursorMonthMs((current) => addMonthsMs(current, 1))}
        >
          calendar/next-month
        </button>
      </div>
      {months.length === 0 ? <p className="terminal-copy">No month coverage available.</p> : null}
      <div className="admin-screen__announcement-calendar-months">
        {months.map((month) => (
          <section key={month.key} className="admin-screen__announcement-calendar-month">
            <div className="admin-screen__announcement-calendar-month-header">
              <p className="terminal-copy terminal-copy--strong">{month.title}</p>
              <p className="terminal-copy">announcements/{month.visibleAnnouncements.length}</p>
            </div>
            <div className="admin-screen__announcement-calendar-month-grid">
              {CALENDAR_WEEKDAY_LABELS.map((weekdayLabel) => (
                <div key={`${month.key}-${weekdayLabel}`} className="admin-screen__announcement-calendar-weekday">
                  {weekdayLabel}
                </div>
              ))}
              {month.days.map((day) => {
                const dayAnnouncements = month.visibleAnnouncements.filter((announcement) => announcementOverlapsWindow(announcement, day.startMs, day.endMs));
                const hiddenAnnouncementCount = Math.max(0, dayAnnouncements.length - 3);

                return (
                  <div
                    key={day.key}
                    className={[
                      'admin-screen__announcement-calendar-day',
                      day.isCurrentMonth ? '' : 'admin-screen__announcement-calendar-day--outside',
                      day.isToday ? 'admin-screen__announcement-calendar-day--today' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="admin-screen__announcement-calendar-day-number">{day.dayOfMonth}</span>
                    <div className="admin-screen__announcement-calendar-markers">
                      {dayAnnouncements.slice(0, 3).map((announcement) => (
                        <span
                          key={`${day.key}-${announcement.id}`}
                          className={[
                            'admin-screen__announcement-calendar-marker',
                            `admin-screen__announcement-calendar-marker--${announcement.colorTone ?? 'default'}`,
                            announcement.enabled ? '' : 'admin-screen__announcement-calendar-marker--disabled',
                          ].filter(Boolean).join(' ')}
                          title={`${announcement.title}: ${formatAnnouncementTime(announcement.startsAtMs)} -> ${formatAnnouncementTime(announcement.endsAtMs)}`}
                        />
                      ))}
                      {hiddenAnnouncementCount > 0 ? <span className="admin-screen__announcement-calendar-marker-count">+{hiddenAnnouncementCount}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {month.visibleAnnouncements.length > 0 ? (
              <ul className="terminal-list admin-screen__announcement-calendar-legend">
                {month.visibleAnnouncements.map((announcement) => (
                  <li key={`${month.key}-${announcement.id}`} className="terminal-list__item admin-screen__announcement-calendar-legend-item">
                    <span
                      className={[
                        'admin-screen__announcement-calendar-legend-swatch',
                        `admin-screen__announcement-calendar-legend-swatch--${announcement.colorTone ?? 'default'}`,
                        announcement.enabled ? '' : 'admin-screen__announcement-calendar-legend-swatch--disabled',
                      ].filter(Boolean).join(' ')}
                    />
                    <div>
                      <p className="terminal-list__title">{announcement.title}</p>
                      <p className="terminal-copy">status/{resolveAnnouncementCalendarStatus(announcement, effectiveCurrentTimeMs)} mode/{announcement.mode}</p>
                      <p className="terminal-copy">starts/{formatAnnouncementTime(announcement.startsAtMs)} ends/{formatAnnouncementTime(announcement.endsAtMs)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="terminal-copy">No announcements touch this month.</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function buildVisibleAnnouncementCalendarMonths(
  announcements: SiteAnnouncementRecord[],
  startMonthStartMs: number,
  monthCount: number,
  currentTimeMs: number,
): AnnouncementCalendarMonth[] {
  return Array.from({ length: monthCount }, (_, index) => {
    const monthStartMs = addMonthsMs(startMonthStartMs, index);
    const monthEndMs = addMonthsMs(monthStartMs, 1);
    const visibleAnnouncements = announcements
      .filter((announcement) => announcementOverlapsWindow(announcement, monthStartMs, monthEndMs))
      .sort(compareAnnouncementsForCalendar);

    return {
      key: `${monthStartMs}`,
      title: formatCalendarMonthTitle(monthStartMs),
      startMs: monthStartMs,
      endMs: monthEndMs,
      days: buildAnnouncementMonthDays(monthStartMs, currentTimeMs),
      visibleAnnouncements,
    };
  });
}

function buildAnnouncementMonthDays(monthStartMs: number, currentTimeMs: number): AnnouncementCalendarDay[] {
  const firstDisplayedDayStartMs = startOfWeekMs(monthStartMs);
  const nextMonthStartMs = addMonthsMs(monthStartMs, 1);

  return Array.from({ length: 42 }, (_, index) => {
    const startMs = addDaysMs(firstDisplayedDayStartMs, index);
    const date = new Date(startMs);
    const endMs = addDaysMs(startMs, 1);

    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      dayOfMonth: date.getDate(),
      startMs,
      endMs,
      isCurrentMonth: startMs >= monthStartMs && startMs < nextMonthStartMs,
      isToday: startMs <= currentTimeMs && currentTimeMs < endMs,
    };
  });
}

function compareAnnouncementsForCalendar(left: SiteAnnouncementRecord, right: SiteAnnouncementRecord): number {
  const leftStart = left.startsAtMs ?? left.createdAtMs;
  const rightStart = right.startsAtMs ?? right.createdAtMs;

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return right.priority - left.priority;
}

function resolveAnnouncementCalendarStatus(announcement: SiteAnnouncementRecord, currentTimeMs: number): string {
  if (!announcement.enabled) {
    return 'disabled';
  }

  if (typeof announcement.startsAtMs === 'number' && announcement.startsAtMs > currentTimeMs) {
    return 'upcoming';
  }

  if (typeof announcement.endsAtMs === 'number' && announcement.endsAtMs <= currentTimeMs) {
    return 'expired';
  }

  if (typeof announcement.startsAtMs !== 'number' && typeof announcement.endsAtMs !== 'number') {
    return 'always-on';
  }

  return 'active';
}

function announcementOverlapsWindow(announcement: SiteAnnouncementRecord, windowStartMs: number, windowEndMs: number): boolean {
  const announcementStartMs = announcement.startsAtMs ?? Number.NEGATIVE_INFINITY;
  const announcementEndMs = announcement.endsAtMs ?? Number.POSITIVE_INFINITY;
  return announcementStartMs < windowEndMs && announcementEndMs > windowStartMs;
}

function startOfWeekMs(value: number): number {
  const startMs = startOfDayMs(value);
  const date = new Date(startMs);
  return addDaysMs(startMs, -date.getDay());
}

function startOfMonthMs(value: number): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function startOfDayMs(value: number): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function addDaysMs(value: number, days: number): number {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function addMonthsMs(value: number, months: number): number {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months, 1);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function formatCalendarMonthTitle(value: number): string {
  const date = new Date(value);
  return `${CALENDAR_MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatCalendarHeadlineDate(value: number): string {
  const date = new Date(value);
  return `${CALENDAR_MONTH_LABELS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatAnnouncementTime(value: number | undefined): string {
  return typeof value === 'number' ? new Date(value).toLocaleString() : 'none';
}

function formatMsForDatetimeLocal(value: number | undefined): string {
  if (typeof value !== 'number') {
    return '';
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseSiteAnnouncementFormState(formState: SiteAnnouncementFormState):
  | { ok: true; value: SiteAnnouncementInput }
  | { ok: false; errorText: string } {
  const priority = Number(formState.priority);

  if (!Number.isFinite(priority)) {
    return { ok: false, errorText: 'Priority must be a number.' };
  }

  const startsAtMs = parseDatetimeLocal(formState.startsAt);
  const endsAtMs = parseDatetimeLocal(formState.endsAt);

  if (formState.startsAt && startsAtMs === undefined) {
    return { ok: false, errorText: 'Start time is invalid.' };
  }

  if (formState.endsAt && endsAtMs === undefined) {
    return { ok: false, errorText: 'End time is invalid.' };
  }

  const linkHref = normalizeOptionalAnnouncementField(formState.linkHref);
  const linkLabel = normalizeOptionalAnnouncementField(formState.linkLabel);

  return {
    ok: true,
    value: {
      title: formState.title,
      body: formState.body,
      mode: formState.mode,
      priority,
      startsAtMs,
      endsAtMs,
      linkHref,
      linkLabel,
      colorTone: formState.colorTone || undefined,
      enabled: formState.enabled,
    },
  };
}

function parseDatetimeLocal(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeOptionalAnnouncementField(value: string): string | undefined {
  const normalized = value.trim();

  if (!normalized || normalized.toLowerCase() === 'none') {
    return undefined;
  }

  return normalized;
}

interface AdminProjectScreenProps {
  isLoading?: boolean;
  project?: RuntimeAdminProjectHeartDetails;
  onBackOverview: () => void;
  onOpenNode: (nodeId: string) => void;
  onResetHearts: () => void;
  onSignOut: () => void;
}

export function AdminProjectScreen({ isLoading, project, onBackOverview, onOpenNode, onResetHearts, onSignOut }: AdminProjectScreenProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(project?.activeClock?.nodeId ?? project?.nodes[0]?.nodeId ?? project?.nodeList[0]?.nodeId);

  const selectedNode = project?.nodeList.find((node) => node.nodeId === selectedNodeId)
    ?? project?.nodes.find((node) => node.nodeId === selectedNodeId);

  function handleOpenNode(nodeId: string): void {
    setSelectedNodeId(nodeId);
    onOpenNode(nodeId);
  }

  function getProjectNodeHref(nodeId: string): string {
    return `/projects/${encodeURIComponent(project?.projectId ?? 'project')}/nodes/${encodeURIComponent(nodeId)}`;
  }

  return (
    <main className="terminal-shell terminal-shell--project terminal-shell--admin-layout">
      <aside className="terminal-sidebar">
        <section className="terminal-block">
          <p className="terminal-path">silofire:/admin/hearts/{project?.projectId ?? 'project'}</p>
          <h1 className="terminal-title">{project?.title ?? 'Project Analytics'}</h1>
          <p className="terminal-copy">Website-level analytics and state inspection with links into the real project pages.</p>
          <div className="terminal-block__actions">
            <button type="button" className="terminal-link terminal-link--muted" onClick={onBackOverview}>back/overview</button>
            <button type="button" className="terminal-link terminal-link--muted" onClick={onSignOut}>sign/out</button>
            <button type="button" className="terminal-link terminal-link--muted" onClick={onResetHearts}>reset/hearts</button>
          </div>
          {project ? <p className="terminal-copy terminal-copy--strong">total-hearts/{project.totalHearts}</p> : null}
        </section>

        {project ? (
          <section className="terminal-block">
            <p className="terminal-label">Node Heart Counts</p>
            <ul className="terminal-list terminal-list--presence admin-screen__metric-list">
              {project.nodes.map((node) => (
                <li key={node.nodeId} className="terminal-list__item terminal-list__item--presence">
                  <p className="terminal-copy terminal-copy--strong">{node.label}</p>
                  <p className="terminal-copy">node/{node.nodeId}</p>
                  <p className="terminal-copy">hearts/{node.heartCount}</p>
                  <a
                    href={getProjectNodeHref(node.nodeId)}
                    className={selectedNodeId === node.nodeId ? 'terminal-link terminal-link--active' : 'terminal-link'}
                    onClick={(event) => {
                      event.preventDefault();
                      handleOpenNode(node.nodeId);
                    }}
                  >
                    open/node
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>

      <section className="terminal-stage admin-screen__stage">
        <section className="terminal-screen terminal-screen--admin-stage">
          <div className="terminal-block admin-screen__detail-block">
            <p className="terminal-label">Selected Node</p>
            {selectedNode ? <p className="terminal-copy terminal-copy--strong">{selectedNode.label}</p> : null}
            {selectedNodeId ? <p className="terminal-copy">node/{selectedNodeId}</p> : null}
            {selectedNodeId ? <p className="terminal-copy">route/projects/{project?.projectId ?? 'project'}/nodes/{selectedNodeId}</p> : null}
          </div>

          <div className="terminal-block admin-screen__detail-block">
            <p className="terminal-label">Current Node List</p>
            {isLoading ? <p className="terminal-copy">Loading project analytics…</p> : null}
            {project ? (
              <ul className="terminal-list admin-screen__node-list">
                {project.nodeList.map((node) => (
                  <li key={node.nodeId} className="terminal-list__item admin-screen__node-item">
                    <p className="terminal-copy terminal-copy--strong">{node.label}</p>
                    <p className="terminal-copy">node/{node.nodeId}</p>
                    <a
                      href={getProjectNodeHref(node.nodeId)}
                      className={selectedNodeId === node.nodeId ? 'terminal-link terminal-link--active' : 'terminal-link'}
                      onClick={(event) => {
                        event.preventDefault();
                        handleOpenNode(node.nodeId);
                      }}
                    >
                      open/node
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {project ? (
            <div className="admin-screen__state-grid">
              <ProjectStatePanes
                activeClock={project.activeClock ? {
                  nodeId: project.activeClock.nodeId,
                  calendarId: getOptionalStringValue(project.activeClock, 'calendarId'),
                  phase: project.activeClock.phase,
                  nowLabel: typeof project.activeClock.nowMs === 'number' ? new Date(project.activeClock.nowMs).toLocaleString() : undefined,
                  nextPhaseLabel: typeof getOptionalNumberValue(project.activeClock, 'nextPhaseInMs') === 'number'
                    ? `${Math.round((getOptionalNumberValue(project.activeClock, 'nextPhaseInMs') ?? 0) / 1000)}s`
                    : undefined,
                  source: project.activeClock.source,
                } : undefined}
                activeWeather={project.activeWeather ? {
                  kind: project.activeWeather.kind,
                  intensity: project.activeWeather.intensity,
                  patternId: project.activeWeather.patternId,
                  stepId: project.activeWeather.stepId,
                  regionId: project.activeWeather.regionId,
                  source: project.activeWeather.source,
                } : undefined}
                activeAmbientNpcs={project.activeAmbient?.npcs}
                sessionNpcStateById={project.sessionNpcStateById}
                sessionObjectStateById={project.sessionObjectStateById}
                objectFieldDetailsById={project.objectFieldDetailsById}
                selectedNodeId={selectedNodeId}
              />
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function getOptionalStringValue(record: object, key: string): string | undefined {
  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function getOptionalNumberValue(record: object, key: string): number | undefined {
  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : undefined;
}