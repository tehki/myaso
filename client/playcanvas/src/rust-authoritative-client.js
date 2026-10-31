// Reuse the already-qualified browser protocol implementation. Do not fork
// packet codecs, transport semantics, identity, combat or Chat C1 for PlayCanvas.
export { connectAuthoritativeClient } from '../../../web/authoritative-client.mjs';
export { connectGameTransport } from '../../../web/network-transport.mjs';
