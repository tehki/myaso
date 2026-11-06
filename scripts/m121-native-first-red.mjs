// Main0 native QA only. Classify a failed physical Light result using
// observations already made by the genuine browser and original Rust World.
// No input is sent, no authoritativeness inferred, and no pass gate is relaxed.
export function summarizeM121NativeFirstRed({
  actorId, physicalPointers, worldActions, senderSamples, expectedLightHoldMs = 40,
} = {}) {
  if (!Number.isSafeInteger(actorId) || actorId < 1
      || !Array.isArray(physicalPointers) || !Array.isArray(worldActions)
      || !Array.isArray(senderSamples)
      || !Number.isFinite(expectedLightHoldMs) || expectedLightHoldMs <= 0) {
    throw new TypeError("M121 first-RED requires actor-bound genuine browser and Rust observations");
  }
  const pointers = physicalPointers.filter(event =>
    event?.button === 0 && event?.trusted === true
    && ["pointerdown", "pointerup"].includes(event.type)
    && Number.isFinite(event.epochMs));
  const downs = pointers.filter(event => event.type === "pointerdown");
  const ups = pointers.filter(event => event.type === "pointerup");
  const down = downs.at(-1);
  const up = ups.find(event => down && event.epochMs >= down.epochMs
    && event.pointerId === down.pointerId);
  const actualHoldMs = up && down ? up.epochMs - down.epochMs : null;
  const actions = worldActions.filter(x => Number.isInteger(x?.action))
    .map(x => ({action:x.action,serverTick:Number.isInteger(x.serverTick)?x.serverTick:null}));
  const sentLightReleaseTicks = senderSamples
    .filter(x => x?.attack === true && x?.heavyAttack === false && Number.isInteger(x.clientTick))
    .map(x => x.clientTick);
  const sentHeavyTicks = senderSamples
    .filter(x => x?.attack === true && x?.heavyAttack === true && Number.isInteger(x.clientTick))
    .map(x => x.clientTick);
  const heavyWorld = actions.some(x => [9, 10, 11, 24, 25, 26].includes(x.action));
  const lightWorld = actions.some(x => [1, 2, 3, 21, 22, 23].includes(x.action));
  return Object.freeze({
    actorId, expectedLightHoldMs, actualHoldMs,
    nativeHoldOverRequested: actualHoldMs !== null && actualHoldMs > expectedLightHoldMs,
    nativeHoldAtLeast135Ms: actualHoldMs !== null && actualHoldMs >= 135,
    physicalDowns:downs.length, physicalUps:ups.length,
    sentLightReleaseTicks, sentHeavyTicks,
    heavyWorldObserved:heavyWorld, lightWorldObserved:lightWorld,
    worldActions:actions,
    verdict: !down || !up ? "INCOMPLETE_PHYSICAL_POINTER"
      : heavyWorld ? "ORIGINAL_WORLD_HEAVY_DURING_LIGHT_TRIAL"
      : "LIGHT_DAMAGE_OR_GEOMETRY_UNPROVEN",
    // Heavy during a Light trial is an actual first-RED, not an infrastructure
    // waiver. This classification must never satisfy Light34 acceptance.
    pass:false,
  });
}
