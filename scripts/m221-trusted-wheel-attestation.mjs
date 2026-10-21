// M221 accepts one trusted native Firefox event per test-only challenge.
// A real DOM event is NOT proof the server accepted Block; HP/guard gates own that.
export function createM221TrustedWheelRegistry({ timeoutMs = 750 } = {}) {
  if (!(timeoutMs > 0 && timeoutMs <= 5000)) throw new TypeError("bounded timeout required");
  let serial = 0;
  const outstanding = new Map();
  function issue() {
    const token = "wheel-" + (++serial);
    let resolve, reject;
    let timer = null;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    outstanding.set(token, { resolve });
    return {
      token,
      wait() {
        if (timer === null) timer = setTimeout(() => {
          outstanding.delete(token);
          reject(new Error("M221 trusted Firefox wheel event not observed"));
        }, timeoutMs);
        return promise;
      },
      close() {
        outstanding.delete(token);
        if (timer !== null) clearTimeout(timer);
      },
    };
  }
  function receive(packet) {
    if (typeof packet?.token !== "string" || packet.trusted !== true
      || !(packet.deltaY > 0) || !Number.isFinite(packet.deltaY)) return false;
    const entry = outstanding.get(packet.token);
    if (!entry) return false;
    if (packet.eventEpochMs !== undefined && !Number.isFinite(packet.eventEpochMs)) return false;
    outstanding.delete(packet.token);
    entry.resolve({ trusted: true, deltaY: packet.deltaY,
      ...(packet.eventEpochMs !== undefined ? { eventEpochMs: packet.eventEpochMs } : {}) });
    return true;
  }
  return Object.freeze({ issue, receive });
}
