import type { RuntimeHeartCount } from '../../../packages/runtime-server/src';

export async function setRuntimeHeart(projectId: string, nodeId: string, hearted: boolean): Promise<RuntimeHeartCount | undefined> {
  let response: Response;

  try {
    response = await fetch(`/api/runtime-heart/${encodeURIComponent(projectId)}/${encodeURIComponent(nodeId)}`, {
      method: hearted ? 'POST' : 'DELETE',
    });
  } catch (error) {
    console.error(`Runtime heart request failed for ${projectId}/${nodeId}.`, error);
    return undefined;
  }

  if (!response.ok) {
    return undefined;
  }

  return response.json() as Promise<RuntimeHeartCount>;
}