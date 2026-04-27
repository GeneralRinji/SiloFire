import { useState } from 'react';

import type { SiteAnnouncementRecord } from '../../../../packages/runtime-server/src';

interface SiteAnnouncementStackProps {
  announcements: SiteAnnouncementRecord[];
  variant?: 'top' | 'sidebar';
}

export function SiteAnnouncementStack({ announcements, variant = 'top' }: SiteAnnouncementStackProps) {
  const [dismissedAnnouncementKeys, setDismissedAnnouncementKeys] = useState<string[]>([]);

  const visibleAnnouncements = announcements.filter((announcement) => !dismissedAnnouncementKeys.includes(getDismissKey(announcement)));

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  function dismissAnnouncement(announcement: SiteAnnouncementRecord) {
    const dismissKey = getDismissKey(announcement);

    setDismissedAnnouncementKeys((current) => {
      if (current.includes(dismissKey)) {
        return current;
      }

      return [...current, dismissKey];
    });
  }

  return (
    <section className={`site-announcement-stack site-announcement-stack--${variant}`} aria-label="Site announcements">
      {visibleAnnouncements.map((announcement) => {
        const toneClassName = announcement.colorTone ? ` site-announcement-card--${announcement.colorTone}` : '';
        const modeClassName = ` site-announcement-card--${announcement.mode}`;

        return (
          <article
            key={announcement.id}
            className={`site-announcement-card${toneClassName}${modeClassName}`}
            data-mode={announcement.mode}
          >
            <div className="site-announcement-card__header">
              <p className="site-announcement-card__mode">{announcement.mode}</p>
              <div className="site-announcement-card__header-actions">
                <p className="site-announcement-card__priority">priority/{announcement.priority}</p>
                {announcement.mode === 'dismissible' ? (
                  <button
                    type="button"
                    className="site-announcement-card__dismiss"
                    aria-label={`Dismiss ${announcement.title}`}
                    onClick={() => dismissAnnouncement(announcement)}
                  >
                    x
                  </button>
                ) : null}
              </div>
            </div>
            <h2 className="site-announcement-card__title">{announcement.title}</h2>
            <p className="site-announcement-card__body">{announcement.body}</p>
            {announcement.linkHref ? (
              <p className="site-announcement-card__linkrow">
                <a className="site-announcement-card__link" href={announcement.linkHref}>
                  {announcement.linkLabel ?? announcement.linkHref}
                </a>
              </p>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function getDismissKey(announcement: SiteAnnouncementRecord): string {
  return `${announcement.id}:${announcement.updatedAtMs}`;
}