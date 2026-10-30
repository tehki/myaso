// M227: acceptance-only observation of a genuine browser pointerdown.
// Receipt is not authoritative combat success; the M144 server, vitals and
// recovery-focus assertions still decide acceptance. No synthetic input.
export function createM227TrustedLightRegistry({ timeoutMs = 600 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 1500) {
    throw new TypeError("M227 requires bounded real-pointer receipt timeout");
  }
  let serial = 0;
  const pending = new Map();
  function issue({ type = "pointerdown" } = {}) {
    if (type !== "pointerdown" && type !== "pointerup") {
      throw new TypeError("M227 requires one genuine left-button pointer event type");
    }
    const token = "m227-light-" + (++serial);
    let resolve, reject, timer = null;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    pending.set(token, { resolve, type });
    return Object.freeze({
      token,
      wait() {
        if (timer === null) timer = setTimeout(() => {
          pending.delete(token);
          reject(new Error(`M227 trusted light ${type} was not observed`));
        }, timeoutMs);
        return promise;
      },
      close() {
        pending.delete(token);
        if (timer !== null) clearTimeout(timer);
      },
    });
  }
  function receive(packet) {
    if (typeof packet?.token !== "string" || packet.trusted !== true
      || (packet.type !== "pointerdown" && packet.type !== "pointerup")
      || packet.button !== 0) return false;
    if (packet.epochMs !== undefined && (!Number.isSafeInteger(packet.epochMs) || packet.epochMs < 1)) return false;
    const entry = pending.get(packet.token);
    if (!entry || entry.type !== packet.type) return false;
    pending.delete(packet.token);
    entry.resolve(Object.freeze({ trusted: true, type: packet.type, button: 0,
      ...(packet.epochMs === undefined ? {} : { epochMs: packet.epochMs }) }));
    return true;
  }
  return Object.freeze({ issue, receive });
}

// Native fixture scheduling only. The final genuine input timestamps and
// original World phase/HP assertions still decide acceptance independently.
export async function waitForM227TrustedLead(receipt, leadMs, {sleep, now=Date.now}={}) {
  if (receipt?.trusted !== true || !["pointerdown","pointerup"].includes(receipt.type)
      || receipt.button !== 0 || !Number.isSafeInteger(receipt.epochMs) || receipt.epochMs < 1
      || !Number.isFinite(leadMs) || leadMs < 0 || leadMs > 200
      || typeof sleep !== "function" || typeof now !== "function") {
    throw new TypeError("genuine timestamped native onset and bounded lead required");
  }
  const ageMs=now()-receipt.epochMs;
  if (!Number.isFinite(ageMs) || ageMs < -5 || ageMs > 600) throw new Error("native onset clock is stale or in the future");
  const remainingMs=Math.max(0,leadMs-Math.max(0,ageMs));
  if(remainingMs>0)await sleep(remainingMs);
  return {ageMs,remainingMs};
}
