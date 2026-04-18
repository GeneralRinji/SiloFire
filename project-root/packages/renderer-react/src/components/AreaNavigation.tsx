import { useLayoutEffect, useState } from 'react';

import type { ProjectedAction, ProjectedAreaNavigationLabels } from '../../../projection/src';
import { ActionList } from './ActionList';
import { getActionListFirstVisibleDelay, getRemainingDelayMs, normalizeNavigationTitle } from './timedText';

interface AreaNavigationProps {
  actions: ProjectedAction[];
  labels?: ProjectedAreaNavigationLabels;
  onAction?: (action: ProjectedAction) => void;
  baseDelayMs?: number;
  pageStartTimeMs?: number;
}

export function AreaNavigation({ actions, labels, onAction, baseDelayMs = 0, pageStartTimeMs }: AreaNavigationProps) {
  const poiActions = actions.filter((action) => action.kind === 'poi');
  const choiceActions = actions.filter((action) => action.kind === 'choice');
  const exitActions = actions.filter((action) => action.kind === 'exit');
  const poiTitle = normalizeNavigationTitle(labels?.pois ?? 'Points Of Interest');
  const choicesTitle = normalizeNavigationTitle(labels?.choices ?? 'Choices');
  const exitsTitle = normalizeNavigationTitle(labels?.exits ?? 'Exits');
  const showSectionHeader =
    (poiActions.length > 0 && Boolean(poiTitle)) ||
    (choiceActions.length > 0 && Boolean(choicesTitle)) ||
    (exitActions.length > 0 && Boolean(exitsTitle));
  const firstVisibleDelayMs = Math.min(
    poiActions.length > 0 ? getActionListFirstVisibleDelay(poiTitle, poiActions.map((action) => action.label), baseDelayMs) : Number.POSITIVE_INFINITY,
    choiceActions.length > 0 ? getActionListFirstVisibleDelay(choicesTitle, choiceActions.map((action) => action.label), baseDelayMs) : Number.POSITIVE_INFINITY,
    exitActions.length > 0 ? getActionListFirstVisibleDelay(exitsTitle, exitActions.map((action) => action.label), baseDelayMs) : Number.POSITIVE_INFINITY,
  );
  const [navigationVisible, setNavigationVisible] = useState(() => getRemainingDelayMs(firstVisibleDelayMs, pageStartTimeMs) <= 0 || !Number.isFinite(firstVisibleDelayMs));

  useLayoutEffect(() => {
    const remainingDelayMs = getRemainingDelayMs(firstVisibleDelayMs, pageStartTimeMs);

    if (!Number.isFinite(firstVisibleDelayMs) || remainingDelayMs <= 0) {
      setNavigationVisible(true);
      return;
    }

    setNavigationVisible(false);

    const timer = setTimeout(() => setNavigationVisible(true), remainingDelayMs);
    return () => clearTimeout(timer);
  }, [firstVisibleDelayMs, pageStartTimeMs]);

  if (poiActions.length === 0 && choiceActions.length === 0 && exitActions.length === 0) {
    return null;
  }

  if (!navigationVisible) {
    return null;
  }

  return (
    <section className="panel-stack__section">
      {showSectionHeader ? (
        <header className="section-header">
          <span className="section-header__rule" aria-hidden="true" />
          <h2>Area Navigation</h2>
        </header>
      ) : null}

      <div className="navigation-grid">
        <ActionList
          title={poiTitle}
          baseDelayMs={baseDelayMs}
          pageStartTimeMs={pageStartTimeMs}
          items={poiActions.map((action) => ({
            id: action.id,
            label: action.label,
            keyLabel: action.keyLabel,
            onSelect: onAction ? () => onAction(action) : undefined,
          }))}
        />

        <ActionList
          title={choicesTitle}
          baseDelayMs={baseDelayMs}
          pageStartTimeMs={pageStartTimeMs}
          items={choiceActions.map((action) => ({
            id: action.id,
            label: action.label,
            keyLabel: action.keyLabel,
            onSelect: onAction ? () => onAction(action) : undefined,
          }))}
        />

        <ActionList
          title={exitsTitle}
          baseDelayMs={baseDelayMs}
          pageStartTimeMs={pageStartTimeMs}
          items={exitActions.map((action) => ({
            id: action.id,
            label: action.label,
            keyLabel: action.keyLabel,
            meta: action.meta ?? (exitsTitle ? action.targetId : undefined),
            onSelect: onAction ? () => onAction(action) : undefined,
          }))}
        />
      </div>
    </section>
  );
}