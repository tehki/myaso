// M144 ORIGINAL v1 diagnostics only: preserve real action-bearing 30Hz input
// samples and a bounded immediate idle context. Pure observer; never sends,
// changes, delays or invents a gameplay packet or a Combat decision.
const MAX_RECORDS = 32;
const IDLE_CONTEXT = 2;
export function appendM144InputSample(history, sample) {
  if (!Array.isArray(history)) throw new TypeError("input history must be an array");
  const action = sample.attack === true || sample.jump === true || sample.heavyAttack === true;
  if (!action) {
    const lastActionIndex = history.findLastIndex(
      value => value.attack === true || value.jump === true || value.heavyAttack === true
    );
    const idleTail = history.length - lastActionIndex - 1;
    if (idleTail >= IDLE_CONTEXT) {
      // Before any action, retain only the two most RECENT idle samples.
      // After a real action, preserve its first two successive idle records,
      // never age the action out by appending unlimited unrelated idle ticks.
      if (lastActionIndex < 0) history.shift();
      else return;
    }
  }
  history.push(Object.freeze({
    clientTick: sample.clientTick,
    epochMs: sample.epochMs,
    attack: Boolean(sample.attack),
    jump: Boolean(sample.jump),
    heavyAttack: Boolean(sample.heavyAttack),
  }));
  if (history.length > MAX_RECORDS) history.splice(0, history.length - MAX_RECORDS);
}
