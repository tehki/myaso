// M220 forensic-only M158 timeline: action server ticks are globally shared
// sequence identifiers, unlike client-browser epoch clocks, which MUST NOT be
// subtracted across clients. Never infer that a DOM transition was displayed.
const find = (rows, action, after = -Infinity) => Array.isArray(rows)
  ? rows.find(x => x?.action === action && Number.isInteger(x.serverTick) && x.serverTick > after)
  : undefined;
export function summarizeM220KnockdownFocusTimeline({
  roller, firstVictim, secondVictim, firstId, secondId,
  knockdownAction, idleAction, strictHandoffPassed,
} = {}) {
  const own = x => x?.acceptance?.ownActionTransitions;
  const firstKD = find(own(firstVictim), knockdownAction);
  const secondKD = find(own(secondVictim), knockdownAction);
  const firstIdle = find(own(firstVictim), idleAction, firstKD?.serverTick);
  const secondIdle = find(own(secondVictim), idleAction, secondKD?.serverTick);
  const labels = Array.isArray(roller?.focusTransitions)
    ? roller.focusTransitions.map(e => e?.label).filter(x => typeof x === "string")
    : [];
  const firstLabel = "KNOCKDOWN #" + firstId;
  const secondLabel = "KNOCKDOWN #" + secondId;
  const i = labels.indexOf(firstLabel);
  const j = labels.indexOf(secondLabel, i + 1);
  const authoritativeGapTicks = firstIdle && secondIdle
    ? secondIdle.serverTick - firstIdle.serverTick : null;
  return Object.freeze({
    provenance: "shared-authoritative-tick-IDs; focus-labels-from-one-roller-browser",
    strictHandoffPassed: strictHandoffPassed === true,
    firstVictimId: firstId ?? null,
    secondVictimId: secondId ?? null,
    firstKnockdownTick: firstKD?.serverTick ?? null,
    secondKnockdownTick: secondKD?.serverTick ?? null,
    firstRecoveryTick: firstIdle?.serverTick ?? null,
    secondRecoveryTick: secondIdle?.serverTick ?? null,
    recoveryGapServerTicks: authoritativeGapTicks,
    focusFirstObserved: i >= 0,
    orderedSecondFocusObserved: j > i,
    actualFocusLabels: labels,
    note: "Missing second focus is a real missing DOM observation; no synthetic event or cross-browser epoch subtraction",
  });
}
