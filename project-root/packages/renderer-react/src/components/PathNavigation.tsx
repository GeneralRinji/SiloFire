import { useLayoutEffect, useState } from 'react';

import type { ProjectedControl } from '../../../projection/src';
import { ActionList } from './ActionList';
import { getActionListFirstVisibleDelay, getRemainingDelayMs } from './timedText';

interface PathNavigationProps {
  controls: ProjectedControl[];
  onControl?: (control: ProjectedControl) => void;
  baseDelayMs?: number;
  pageStartTimeMs?: number;
}

export function PathNavigation({ controls, onControl, baseDelayMs = 0, pageStartTimeMs }: PathNavigationProps) {
  const firstVisibleDelayMs = getActionListFirstVisibleDelay('Traversal Controls', controls.map((control) => control.label), baseDelayMs);
  const [navigationVisible, setNavigationVisible] = useState(() => getRemainingDelayMs(firstVisibleDelayMs, pageStartTimeMs) <= 0);

  useLayoutEffect(() => {
    const remainingDelayMs = getRemainingDelayMs(firstVisibleDelayMs, pageStartTimeMs);

    if (remainingDelayMs <= 0) {
      setNavigationVisible(true);
      return;
    }

    setNavigationVisible(false);

    const timer = setTimeout(() => setNavigationVisible(true), remainingDelayMs);
    return () => clearTimeout(timer);
  }, [firstVisibleDelayMs, pageStartTimeMs]);

  if (controls.length === 0) {
    return null;
  }

  if (!navigationVisible) {
    return null;
  }

  return (
    <section className="panel-stack__section">
      <header className="section-header">
        <span className="section-header__rule" aria-hidden="true" />
        <h2>Path Navigation</h2>
      </header>

      <ActionList
        title="Traversal Controls"
        baseDelayMs={baseDelayMs}
        pageStartTimeMs={pageStartTimeMs}
        items={controls.map((control) => ({
          id: control.id,
          label: control.label,
          keyLabel: control.keyLabel,
          meta: control.kind,
          onSelect: onControl ? () => onControl(control) : undefined,
        }))}
      />
    </section>
  );
}