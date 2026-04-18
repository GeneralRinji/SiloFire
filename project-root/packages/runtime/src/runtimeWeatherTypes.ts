export interface RuntimeWeatherSnapshot {
  patternId?: string;
  stepId?: string;
  kind?: string;
  intensity?: string;
  statusText: string[];
  regionId?: string;
  visibleInRecentLog?: boolean;
  nowMs?: number;
  source?: string;
}