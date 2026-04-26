import type { RuntimeAdminProjectHeartDetails, RuntimeAdminProjectHeartSummary } from '../../../packages/runtime-server/src';

export type RuntimeAdminApiResult<TValue> =
  | { kind: 'ok'; value: TValue }
  | { kind: 'unauthorized' }
  | { kind: 'not_found' }
  | { kind: 'error' };

export async function listRuntimeAdminHeartOverview(password: string): Promise<RuntimeAdminApiResult<RuntimeAdminProjectHeartSummary[]>> {
  return fetchAdminJson<RuntimeAdminProjectHeartSummary[]>('/api/runtime-admin/hearts', password);
}

export async function getRuntimeAdminHeartProject(projectId: string, password: string): Promise<RuntimeAdminApiResult<RuntimeAdminProjectHeartDetails>> {
  return fetchAdminJson<RuntimeAdminProjectHeartDetails>(`/api/runtime-admin/hearts/${encodeURIComponent(projectId)}`, password);
}

export async function resetRuntimeAdminHeartProject(projectId: string, password: string): Promise<RuntimeAdminApiResult<{ ok: boolean }>> {
  return fetchAdminJson<{ ok: boolean }>(`/api/runtime-admin/hearts/${encodeURIComponent(projectId)}/reset`, password, {
    method: 'POST',
  });
}

async function fetchAdminJson<TValue>(
  url: string,
  password: string,
  init: RequestInit = {},
): Promise<RuntimeAdminApiResult<TValue>> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'x-silofire-admin-password': password,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    console.error(`Runtime admin request failed for ${url}.`, error);
    return { kind: 'error' };
  }

  if (response.status === 401) {
    return { kind: 'unauthorized' };
  }

  if (response.status === 404) {
    return { kind: 'not_found' };
  }

  if (!response.ok) {
    return { kind: 'error' };
  }

  return {
    kind: 'ok',
    value: await response.json() as TValue,
  };
}