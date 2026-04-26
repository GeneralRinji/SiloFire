import type { RuntimeAmbientNpcSnapshot } from '../runtimeAmbient';

interface ProjectStatePanesProps {
  activeClock?: {
    nodeId?: string;
    calendarId?: string;
    phase?: string;
    nowLabel?: string;
    nextPhaseLabel?: string;
    source?: string;
  };
  activeWeather?: {
    kind?: string;
    intensity?: string;
    patternId?: string;
    stepId?: string;
    regionId?: string;
    source?: string;
  };
  activeAmbientNpcs?: RuntimeAmbientNpcSnapshot[];
  sessionNpcStateById?: Record<string, {
    location?: string;
    behavior?: string;
  }>;
  sessionObjectStateById?: Record<string, Record<string, string | number | boolean>>;
  selectedNodeId?: string;
}

export function ProjectStatePanes({
  activeClock,
  activeWeather,
  activeAmbientNpcs,
  sessionNpcStateById,
  sessionObjectStateById,
  selectedNodeId,
}: ProjectStatePanesProps) {
  const ambientNpcsHere = activeAmbientNpcs?.filter((npc) => selectedNodeId !== undefined && npc.nodeId === selectedNodeId) ?? [];
  const ambientNpcById: Record<string, RuntimeAmbientNpcSnapshot> = Object.fromEntries((activeAmbientNpcs ?? []).map((npc) => [npc.id, npc]));
  const objectDebugIds = Object.keys(sessionObjectStateById ?? {}).sort((left, right) => left.localeCompare(right));
  const ambientDebugNpcIds = Array.from(new Set([
    ...Object.keys(ambientNpcById),
    ...Object.keys(sessionNpcStateById ?? {}),
  ])).sort((left, right) => {
    const leftName = ambientNpcById[left]?.displayName ?? left;
    const rightName = ambientNpcById[right]?.displayName ?? right;
    return leftName.localeCompare(rightName);
  });

  return (
    <>
      {activeClock?.phase ? (
        <section className="terminal-block">
          <p className="terminal-label">Time</p>
          <p className="terminal-copy terminal-copy--strong">phase/{activeClock.phase}</p>
          {activeClock.nodeId ? <p className="terminal-copy">selected-node/{activeClock.nodeId}</p> : null}
          {activeClock.calendarId ? <p className="terminal-copy">calendar/{activeClock.calendarId}</p> : null}
          {activeClock.nowLabel ? <p className="terminal-copy">server-now/{activeClock.nowLabel}</p> : null}
          {activeClock.nextPhaseLabel ? <p className="terminal-copy">next-phase/{activeClock.nextPhaseLabel}</p> : null}
          {activeClock.source ? <p className="terminal-copy">server-source/{activeClock.source}</p> : null}
        </section>
      ) : null}

      {activeWeather?.kind || activeWeather?.patternId ? (
        <section className="terminal-block">
          <p className="terminal-label">Weather</p>
          <p className="terminal-copy terminal-copy--strong">kind/{activeWeather.kind ?? 'unknown'}</p>
          {activeWeather.intensity ? <p className="terminal-copy">intensity/{activeWeather.intensity}</p> : null}
          {activeWeather.regionId ? <p className="terminal-copy">assigned-region/{activeWeather.regionId}</p> : null}
          {activeWeather.patternId ? <p className="terminal-copy">pattern-id/{activeWeather.patternId}</p> : null}
          {activeWeather.stepId ? <p className="terminal-copy">step-id/{activeWeather.stepId}</p> : null}
          {activeWeather.source ? <p className="terminal-copy">server-source/{activeWeather.source}</p> : null}
        </section>
      ) : null}

      {ambientDebugNpcIds.length > 0 ? (
        <section className="terminal-block">
          <p className="terminal-label">Ambient</p>
          {selectedNodeId ? (
            <>
              <p className="terminal-copy terminal-copy--strong">here/{ambientNpcsHere.length > 0 ? ambientNpcsHere.map((npc) => npc.displayName ?? npc.id).join(', ') : 'none'}</p>
              <p className="terminal-copy">selected-node/{selectedNodeId}</p>
            </>
          ) : null}
          <ul className="terminal-list terminal-list--presence">
            {ambientDebugNpcIds.map((npcId) => {
              const npc = ambientNpcById[npcId];
              const sessionNpcState = sessionNpcStateById?.[npcId];
              const isHere = selectedNodeId !== undefined && npc?.nodeId === selectedNodeId;
              const locationLabel = npc?.nodeId
                ? `live-node/${npc.nodeId}`
                : npc
                  ? `live-route/${npc.previousNodeId ?? 'unknown'} -> ${npc.nextNodeId ?? 'unknown'}`
                  : 'live-snapshot/pending';

              return (
                <li key={npcId} className="terminal-list__item terminal-list__item--presence">
                  <p className="terminal-copy terminal-copy--strong">
                    {npc?.displayName ?? npcId}
                    {isHere ? ' [here]' : ''}
                  </p>
                  <p className="terminal-copy">{locationLabel}</p>
                  <p className="terminal-copy">server-session-location/{sessionNpcState?.location ?? 'none'}</p>
                  <p className="terminal-copy">
                    {npc?.behavior
                      ? `live-movement-state/${npc.behavior}`
                      : `server-session-behavior/${sessionNpcState?.behavior ?? 'none'}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {objectDebugIds.length > 0 ? (
        <section className="terminal-block">
          <p className="terminal-label">Objects</p>
          <ul className="terminal-list terminal-list--presence">
            {objectDebugIds.map((objectId) => {
              const objectState = sessionObjectStateById?.[objectId] ?? {};
              const fieldEntries = Object.entries(objectState);

              return (
                <li key={objectId} className="terminal-list__item terminal-list__item--presence">
                  <p className="terminal-copy terminal-copy--strong">{objectId}</p>
                  {fieldEntries.map(([fieldName, fieldValue]) => (
                    <p key={fieldName} className="terminal-copy">
                      {fieldName}/{String(fieldValue)}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}