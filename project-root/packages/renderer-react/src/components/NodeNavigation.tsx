import type { ProjectedPage } from '../../../projection/src';
import { AreaNavigation } from './AreaNavigation';
import { GateNavigation } from './GateNavigation';
import { PathNavigation } from './PathNavigation';
import type { ProjectedAction, ProjectedControl } from '../../../projection/src';

interface NodeNavigationProps {
  page: ProjectedPage;
  onAction?: (action: ProjectedAction) => void;
  onControl?: (control: ProjectedControl) => void;
  baseDelayMs?: number;
  pageStartTimeMs?: number;
}

export function NodeNavigation({ page, onAction, onControl, baseDelayMs = 0, pageStartTimeMs }: NodeNavigationProps) {
  if (page.nodeKind === 'area') {
    return <AreaNavigation actions={page.actions} labels={page.areaNavigationLabels} onAction={onAction} baseDelayMs={baseDelayMs} pageStartTimeMs={pageStartTimeMs} />;
  }

  if (page.nodeKind === 'path') {
    return <PathNavigation controls={page.controls} onControl={onControl} baseDelayMs={baseDelayMs} pageStartTimeMs={pageStartTimeMs} />;
  }

  return <GateNavigation actions={page.actions} controls={page.controls} labels={page.gateNavigationLabels} onAction={onAction} onControl={onControl} baseDelayMs={baseDelayMs} pageStartTimeMs={pageStartTimeMs} />;
}