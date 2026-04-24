export function delayValueToMs(value: string): number {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'fast' || normalized === 'short') {
    return 250;
  }

  if (normalized === 'medium') {
    return 900;
  }

  if (normalized === 'slow' || normalized === 'long') {
    return 1600;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}