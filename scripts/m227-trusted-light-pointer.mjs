// M227: acceptance-only observation of a genuine browser pointerdown.
// Receipt is not authoritative combat success; the M144 server, vitals and
// recovery-focus assertions still decide acceptance. No synthetic input.
export function createM227TrustedLightRegistry({ timeoutMs = 600 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 1500) {
    throw new TypeError("M227 requires bounded real-pointer receipt timeout");
  }
  let serial = 0;
  const pending = new Map();
  function issue() {
    const token = "m227-light-" + (++serial);
    let resolve, reject, timer = null;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    pending.set(token, { resolve });
    return Object.freeze({
      token,
      wait() {
        if (timer === null) timer = setTimeout(() => {
          pending.delete(token);
          reject(new Error("M227 trusted light pointerdown was not observed"));
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
      || packet.type !== "pointerdown" || packet.button !== 0) return false;
    const entry = pending.get(packet.token);
    if (!entry) return false;
    pending.delete(packet.token);
    entry.resolve(Object.freeze({ trusted: true, type: "pointerdown", button: 0 }));
    return true;
  }
  return Object.freeze({ issue, receive });
}
