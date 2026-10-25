import { NETWORK } from "./constants.mjs";

// Preserve one *actual* sampled rising edge across a skipped QUIC datagram.
// The v1 wire still carries at most three genuine, monotonically sampled ticks.
// The current tick and immediately previous state always own slots 1 and 2.
const MAX_EDGE_AGE_TICKS = 4;
const ACTION_FLAGS = ["attack", "heavyAttack", "dodge", "kick", "jump", "dash"];

function actionMask(sample) {
  return ACTION_FLAGS.reduce((mask, name, index) =>
    mask | (sample[name] ? 1 << index : 0), 0);
}

export function createInputRedundancy() {
  const history = [];
  let pinned = null;
  return {
    push(sample) {
      const previous = history.at(-1);
      const elapsed = previous ? (sample.tick - previous.tick) >>> 0 : 1;
      // Never replay history across a reset, repeated tick or discontinuity.
      if (elapsed === 0 || elapsed > 0xff) {
        history.length = 0;
        pinned = null;
      }
      const prior = history.at(-1);
      const currentMask = actionMask(sample);
      const rising = currentMask & ~actionMask(prior || {});
      // Preserve the heavy edge even if another held input bit changes.
      // Priority stays with a more recent genuine sampled action edge.
      if (rising) pinned = { sample, activeMask: rising & (1 << 1) ? (1 << 1) : rising };
      // A cancelled/released hold cannot be reintroduced by the pinned slot.
      if (pinned && (
        ((sample.tick - pinned.sample.tick) >>> 0) > MAX_EDGE_AGE_TICKS
        || (currentMask & pinned.activeMask) !== pinned.activeMask
      )) pinned = null;

      history.push(sample);
      if (history.length > NETWORK.inputRedundancy) history.shift();
      const selected = [...history].reverse();
      if (selected.length === NETWORK.inputRedundancy && pinned
        && !selected.some(entry => entry.tick === pinned.sample.tick)) {
        selected[selected.length - 1] = pinned.sample;
      }
      return selected;
    },
  };
}
