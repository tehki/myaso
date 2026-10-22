// Small browser-only lifecycle fence for the original v1 WebTransport client.
// An unload may fire while connectAuthoritativeClient() is still awaiting
// admission. Retire that connection as soon as it resolves, never let an
// already-departed page retain a newly admitted server seat.
// This object does not authenticate, allocate, or mutate any World actor.
export function createPagehideTransportFence() {
  let departed = false;
  let boundClient = null;
  let closeIssued = false;
  function closeIfNeeded() {
    if (!departed || !boundClient || closeIssued) return;
    closeIssued = true;
    boundClient.close("pagehide");
  }
  return Object.freeze({
    depart() {
      departed = true;
      closeIfNeeded();
    },
    bind(client) {
      if (boundClient) throw new Error("pagehide transport fence already bound");
      if (!client || typeof client.close !== "function")
        throw new TypeError("connected WebTransport client with close() required");
      boundClient = client;
      closeIfNeeded();
      return !departed;
    },
    get departed() { return departed; },
  });
}
