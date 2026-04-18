import { useLayoutEffect, useState } from 'react';

import { renderInlineRichText } from './renderRichText';
import { getRemainingDelayMs, parseTimedText } from './timedText';

type ActionLike = {
  id: string;
  label: string;
  keyLabel?: string;
  meta?: string;
  onSelect?: () => void;
};

interface ActionListProps {
  title?: string;
  items: ActionLike[];
  emptyText?: string;
  baseDelayMs?: number;
  pageStartTimeMs?: number;
}

export function ActionList({ title, items, emptyText, baseDelayMs = 0, pageStartTimeMs }: ActionListProps) {
  if (items.length === 0 && !emptyText) {
    return null;
  }

  const timedTitle = title ? parseTimedText(title) : undefined;
  const titleDelayMs = timedTitle?.hasExplicitDelay ? baseDelayMs + timedTitle.delayMs : 0;
  const timedItems = items.map((item) => {
    const timedLabel = parseTimedText(item.label);

    return {
      item,
      timedLabel,
      delayMs: timedLabel.hasExplicitDelay ? baseDelayMs + timedLabel.delayMs : 0,
    };
  });
  const visibilityKey = JSON.stringify({
    title,
    baseDelayMs,
    items: timedItems.map(({ item, timedLabel, delayMs }) => ({ id: item.id, label: timedLabel.text, delayMs })),
  });
  const [titleVisible, setTitleVisible] = useState(() => !timedTitle || getRemainingDelayMs(titleDelayMs, pageStartTimeMs) <= 0);
  const [visibleItemIds, setVisibleItemIds] = useState<Set<string>>(
    () => new Set(timedItems.filter(({ delayMs }) => getRemainingDelayMs(delayMs, pageStartTimeMs) <= 0).map(({ item }) => item.id)),
  );

  useLayoutEffect(() => {
    const remainingTitleDelayMs = timedTitle ? getRemainingDelayMs(titleDelayMs, pageStartTimeMs) : 0;
    const nextVisibleItemIds = new Set(
      timedItems.filter(({ delayMs }) => getRemainingDelayMs(delayMs, pageStartTimeMs) <= 0).map(({ item }) => item.id),
    );

    setTitleVisible(!timedTitle || remainingTitleDelayMs <= 0);
    setVisibleItemIds(nextVisibleItemIds);

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    if (timedTitle && remainingTitleDelayMs > 0) {
      timers.push(setTimeout(() => setTitleVisible(true), remainingTitleDelayMs));
    }

    timedItems.forEach(({ item, delayMs }) => {
      const remainingDelayMs = getRemainingDelayMs(delayMs, pageStartTimeMs);

      if (remainingDelayMs <= 0) {
        setVisibleItemIds((current) => {
          if (current.has(item.id)) {
            return current;
          }

          const next = new Set(current);
          next.add(item.id);
          return next;
        });
        return;
      }

      timers.push(
        setTimeout(() => {
          setVisibleItemIds((current) => {
            const next = new Set(current);
            next.add(item.id);
            return next;
          });
        }, remainingDelayMs),
      );
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [visibilityKey]);

  if (title && !titleVisible) {
    return null;
  }

  const visibleItems = timedItems.filter(({ item }) => visibleItemIds.has(item.id));

  if (visibleItems.length === 0 && items.length > 0 && !emptyText) {
    return null;
  }

  return (
    <section className="panel-stack__section">
      {title ? (
        <header className="section-header">
          <span className="section-header__rule" aria-hidden="true" />
          <h2>{renderInlineRichText(timedTitle?.text ?? title, 'action-list-title')}</h2>
        </header>
      ) : null}

      {items.length === 0 ? <p className="empty-copy">{emptyText}</p> : null}

      {visibleItems.length > 0 ? (
        <ul className="action-list">
          {visibleItems.map(({ item, timedLabel }) => (
            <li key={item.id} className="action-list__item">
              {item.onSelect ? (
                <button type="button" className="action-list__button" onClick={item.onSelect}>
                  <span className="action-list__main">
                    {item.keyLabel ? <span className="action-list__key">{item.keyLabel}</span> : null}
                    <span className="action-list__label">{renderInlineRichText(timedLabel.text, `action-${item.id}`)}</span>
                  </span>
                </button>
              ) : (
                <div className="action-list__main">
                  {item.keyLabel ? <span className="action-list__key">{item.keyLabel}</span> : null}
                  <span className="action-list__label">{renderInlineRichText(timedLabel.text, `action-${item.id}`)}</span>
                </div>
              )}
              {item.meta ? <span className="action-list__meta">{item.meta}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export type { ActionLike };