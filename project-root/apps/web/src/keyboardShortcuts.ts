import type { ProjectedAction, ProjectedControl, ProjectionResult } from '../../../packages/projection/src';

export type ProjectedShortcutMatch =
  | { kind: 'action'; action: ProjectedAction }
  | { kind: 'control'; control: ProjectedControl };

export function findMatchingShortcut(
  page: ProjectionResult | undefined,
  pressedKey: string,
): ProjectedShortcutMatch | undefined {
  if (!page || page.kind !== 'page') {
    return undefined;
  }

  const normalizedPressedKey = normalizeShortcutKey(pressedKey);

  if (!normalizedPressedKey) {
    return undefined;
  }

  const action = page.actions.find((item) => normalizeShortcutKey(item.key) === normalizedPressedKey);

  if (action) {
    return { kind: 'action', action };
  }

  const control = page.controls.find((item) => normalizeShortcutKey(item.key) === normalizedPressedKey);

  if (control) {
    return { kind: 'control', control };
  }

  return undefined;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function normalizeShortcutKey(key: string | undefined): string | undefined {
  if (!key) {
    return undefined;
  }

  const normalized = key.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}