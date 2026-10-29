// Native QA only. Move observation ahead of the same-session W3C action queue;
// the receipt is a rendered cue, never input or authoritative Parry evidence.
import { randomUUID } from "node:crypto";
import { readM41ScalarWorldCue, summarizeM41CueTimeout } from "./m41-native-observed-parry.mjs";

export function createM35CueRegistry() {
  const pending = new Map();
  return {
    issue(baseline, actorId, {allowHeavy = false} = {}) {
      if (!Number.isInteger(baseline) || baseline < 0 || !Number.isSafeInteger(actorId) || actorId < 1) {
        throw new TypeError("M35 requires a current actor-bound event baseline");
      }
      const token = randomUUID();
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      const timer = setTimeout(() => {
        pending.delete(token);
        resolve(null);
      }, 1500);
      pending.set(token, { baseline, actorId, allowHeavy, resolve });
      return {
        token, wait: () => promise,
        close() { clearTimeout(timer); pending.delete(token); resolve(null); },
      };
    },
    receive(packet) {
      const entry = pending.get(packet?.token);
      if (!entry) return false;
      const cue = packet.cue;
      if (cue !== null && (cue?.actorId !== entry.actorId
          || !Number.isInteger(cue.eventIndex) || cue.eventIndex < entry.baseline
          || cue.eventCount !== cue.eventIndex + 1
          || !Number.isFinite(cue.t) || cue.t < 0
          || !(cue.text === "Attack committed - your windup is readable."
            || (entry.allowHeavy === true && cue.text === "Heavy strike committed - the long windup is readable."))
          || cue.latestText !== cue.text)) return false;
      pending.delete(packet.token);
      entry.resolve(cue);
      return true;
    },
  };
}

export function m35PrearmedCueScript() {
  return "const observe = " + readM41ScalarWorldCue.toString() + ";"
    + "const summarize = " + summarizeM41CueTimeout.toString() + ";"
    + `
      const [token, baseline, actorId, timeoutMs, allowHeavy] = arguments;
      const arena = document.querySelector('#arena');
      const target = document.querySelector('#event-text');
      const channel = window.__MYASO_M35_CUE_CHANNEL__;
      if (!arena || !target || window.__MYASO_M35_CUE_WATCH__
          || channel?.readyState !== WebSocket.OPEN) return false;
      delete window.__MYASO_M41_LAST_TIMEOUT__;
      let poll, deadline, started, finished = false, attemptBaseline = baseline;
      const mutationObserver = new MutationObserver(() => check());
      const close = () => {
        finished = true;
        clearInterval(poll); clearTimeout(deadline);
        mutationObserver.disconnect();
        arena.removeEventListener('pointerdown', begin, true);
        delete window.__MYASO_M35_CUE_WATCH__;
      };
      const finish = cue => {
        if (finished) return;
        if (!cue) window.__MYASO_M41_LAST_TIMEOUT__ = summarize(
          window.__MYASO_M30_UI__, baseline, actorId, performance.now() - started);
        close();
        // Opened and verified before the physical click. Per-event fetch
        // added ~90ms to the preserved native late-HIT first red. This
        // read-only receipt is never a game input or authoritative outcome.
        if (channel.readyState === WebSocket.OPEN) channel.send(JSON.stringify({token, cue}));
      };
      const check = () => {
        if (finished || started === undefined) return;
        const cue = observe(window.__MYASO_M30_UI__, attemptBaseline, actorId, allowHeavy);
        if (cue) finish({ ...cue, observationLagMs: Math.max(0,
          performance.now() - window.__MYASO_M30_UI__.startedAt - cue.t) });
        else if (performance.now() - started >= timeoutMs) finish(null);
      };
      function begin(event) {
        if (!event.isTrusted || event.button !== 0) return;
        arena.removeEventListener('pointerdown', begin, true);
        clearTimeout(deadline);
        attemptBaseline = Math.max(baseline, window.__MYASO_M30_UI__?.events?.length ?? baseline);
        started = performance.now();
        poll = setInterval(check, 4);
        check();
      }
      window.__MYASO_M35_CUE_WATCH__ = {close};
      mutationObserver.observe(target, {childList: true, subtree: true, characterData: true});
      arena.addEventListener('pointerdown', begin, true);
      deadline = setTimeout(close, 1500);
      return true;
    `;
}
