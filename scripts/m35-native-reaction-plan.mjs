import { NETWORK } from "../src/network/constants.mjs";

// Native QA only. Calibration is neither a lower nor an upper bound on the
// next W3C delivery. Observe the earliest authentic current short-click cue;
// require original World Light and Parry separately after the real exchange.
export function planM35NativeReaction(wheelMs, clickHoldMs = 35) {
  if (!Number.isFinite(wheelMs) || wheelMs < 0 || wheelMs >= 400 || clickHoldMs !== 35) {
    throw new TypeError("current bounded native wheel calibration and original short click required");
  }
  const tickMs = 1000 / NETWORK.serverSimulationHz;
  return Object.freeze({
    allowHeavy: true,
    lightReactionMs: Math.ceil(tickMs),
  });
}
