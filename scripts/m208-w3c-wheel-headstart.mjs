import { planM203W3cPointerPause } from "./m203-w3c-wheel-ack.mjs";

// M208: start exactly one genuine Firefox W3C wheel. An unusually slow driver
// response must not indefinitely postpone the ONE genuine Chrome LMB until the
// unchanged 240ms short block expires. Bound only the *harness wait for ACK*;
// neither client receives a synthetic input or altered game action.
export async function dispatchM208WheelLedW3cExchange({
  sendWheel, sendAttack, sleep, now = () => performance.now(),
  maxWheelHeadStartMs = 65, nominalPointerPauseMs = 40,
}) {
  if (![sendWheel, sendAttack, sleep, now].every(value => typeof value === "function")
    || !Number.isFinite(maxWheelHeadStartMs) || maxWheelHeadStartMs < 0
    || maxWheelHeadStartMs > 150
    || !Number.isFinite(nominalPointerPauseMs)
    || nominalPointerPauseMs < 0 || nominalPointerPauseMs > 1000) {
    throw new RangeError("M208 needs bounded genuine W3C dispatch callbacks");
  }
  const started = now();
  let wheelAckMs = null;
  // Start Firefox wheel *before* the attacker command; never send a second
  // wheel or attack when ACK is late. Wheel failures remain fatal.
  const wheelPromise = Promise.resolve().then(sendWheel).then(() => {
    wheelAckMs = Math.max(0, now() - started);
  });
  const acknowledgedBeforeDispatch = await Promise.race([
    wheelPromise.then(() => true),
    sleep(maxWheelHeadStartMs).then(() => false),
  ]);
  const pointerPauseMs = acknowledgedBeforeDispatch
    ? planM203W3cPointerPause({
      wheelCommandMs: wheelAckMs,
      nominalPointerPauseMs,
    })
    : 0;
  const chromeDispatchMs = Math.max(0, now() - started);
  // At most 65ms head start is allowed under high Firefox ACK latency.
  // The actual game outcome is separately checked by the authoritative
  // guard/no-parry/no-HP test, not inferred from promise completion.
  await Promise.all([wheelPromise, Promise.resolve().then(() => sendAttack(pointerPauseMs))]);
  return {
    wheelAckBeforeAttack: acknowledgedBeforeDispatch,
    wheelAckMs: Number(wheelAckMs.toFixed(1)),
    chromeDispatchMs: Number(chromeDispatchMs.toFixed(1)),
    pointerPauseMs,
    maxWheelHeadStartMs,
  };
}
