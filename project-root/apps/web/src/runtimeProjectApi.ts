import type { ContentProjectRecord } from '../../../packages/content';

export async function listRuntimeProjects(): Promise<ContentProjectRecord[]> {
  const response = await fetch('/api/runtime-projects');

  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<ContentProjectRecord[]>;
}
