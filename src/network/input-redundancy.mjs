import { NETWORK } from "./constants.mjs";

// Preserve one actual sampled rising edge or committed LMB release across a skipped datagram.
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
      // A sampled dual-bit hold -> one action bit is the genuine classified
      // light/heavy LMB release. Neutral samples must not erase that release;
      // unlike a held input, it no longer requires its button to remain down.
      const committedRelease = prior?.attack && prior.heavyAttack
        && Boolean(sample.attack) !== Boolean(sample.heavyAttack);
      // Priority stays with a more recent genuine sampled action edge.
      if (committedRelease) pinned = { sample, committed: true };
      else if (rising) pinned = { sample, activeMask: rising & (1 << 1) ? (1 << 1) : rising };
      // A cancelled hold cannot be reintroduced. A 3->0 blur/cancel never
      // creates a committed release; reset/reconnect clears both forms.
      if (pinned && (
        ((sample.tick - pinned.sample.tick) >>> 0) > MAX_EDGE_AGE_TICKS
        || (!pinned.committed && (currentMask & pinned.activeMask) !== pinned.activeMask)
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
