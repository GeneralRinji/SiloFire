import type {
  AdminSiteAnnouncementSnapshot,
  RuntimeAdminProjectHeartDetails,
  RuntimeAdminProjectHeartSummary,
  SiteAnnouncementInput,
  SiteAnnouncementRecord,
} from '../../../packages/runtime-server/src';

export type RuntimeAdminApiResult<TValue> =
  | { kind: 'ok'; value: TValue }
  | { kind: 'unauthorized' }
  | { kind: 'not_found' }
  | { kind: 'validation_error'; errors: string[] }
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

export async function resetRuntimeAdminJukeboxProject(projectId: string, password: string): Promise<RuntimeAdminApiResult<{ ok: boolean }>> {
  return fetchAdminJson<{ ok: boolean }>(`/api/runtime-admin/jukeboxes/${encodeURIComponent(projectId)}/reset`, password, {
    method: 'POST',
  });
}

export async function listRuntimeAdminSiteAnnouncements(password: string): Promise<RuntimeAdminApiResult<AdminSiteAnnouncementSnapshot>> {
  return fetchAdminJson<AdminSiteAnnouncementSnapshot>('/api/runtime-admin/site-announcements', password);
}

export async function createRuntimeAdminSiteAnnouncement(
  password: string,
  input: SiteAnnouncementInput,
): Promise<RuntimeAdminApiResult<SiteAnnouncementRecord>> {
  return fetchAdminJson<SiteAnnouncementRecord>('/api/runtime-admin/site-announcements', password, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function updateRuntimeAdminSiteAnnouncement(
  announcementId: string,
  password: string,
  input: SiteAnnouncementInput,
): Promise<RuntimeAdminApiResult<SiteAnnouncementRecord>> {
  return fetchAdminJson<SiteAnnouncementRecord>(`/api/runtime-admin/site-announcements/${encodeURIComponent(announcementId)}`, password, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteRuntimeAdminSiteAnnouncement(
  announcementId: string,
  password: string,
): Promise<RuntimeAdminApiResult<{ ok: boolean }>> {
  return fetchAdminJson<{ ok: boolean }>(`/api/runtime-admin/site-announcements/${encodeURIComponent(announcementId)}`, password, {
    method: 'DELETE',
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

  if (response.status === 400) {
    try {
      const payload = await response.json() as { errors?: unknown };
      return {
        kind: 'validation_error',
        errors: Array.isArray(payload.errors)
          ? payload.errors.filter((value): value is string => typeof value === 'string')
          : ['Validation failed.'],
      };
    } catch (error) {
      console.error(`Runtime admin validation payload parsing failed for ${url}.`, error);
      return {
        kind: 'validation_error',
        errors: ['Validation failed.'],
      };
    }
  }

  if (!response.ok) {
    return { kind: 'error' };
  }

  return {
    kind: 'ok',
    value: await response.json() as TValue,
  };
}