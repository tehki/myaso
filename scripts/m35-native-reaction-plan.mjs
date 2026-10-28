import { NETWORK } from "../src/network/constants.mjs";

// Native QA only. Slow real W3C ingress cannot wait for the later Light
// snapshot: retained first-red wheel76ms arrived after original World contact.
// Use the already-supported authentic Heavy-charging cue when needed, while
// pacing fast ingress so it cannot arm Block before Parry125 opens.
export function planM35NativeReaction(wheelMs, clickHoldMs = 35) {
  if (!Number.isFinite(wheelMs) || wheelMs < 0 || wheelMs >= 400 || clickHoldMs !== 35) {
    throw new TypeError("current bounded native wheel calibration and original short click required");
  }
  const tickMs = 1000 / NETWORK.serverSimulationHz;
  return Object.freeze({
    allowHeavy: wheelMs > 2 * tickMs,
    lightReactionMs: Math.ceil(tickMs),
    heavyReactionMs: Math.ceil(Math.max(tickMs, clickHoldMs + 2 * tickMs - wheelMs)),
  });
}
