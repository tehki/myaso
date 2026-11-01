import { createPlayCanvasActorLayer } from '../scene/authoritative-actors.js';
import { parseSha256Hex, connectAuthoritativeClient } from '../rust-authoritative-client.js';

// Explicitly NON-PRODUCTION: no public hosts, no WebSocket fallback, and no
// production cert/QUIC endpoint. A loopback test forward may be used.
export function validateLoopbackQuicConfig({ url, sha256 }) {
  if (typeof url !== 'string' || !url) throw new Error('local QUIC URL is required');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
      || !parsed.port || parsed.pathname !== '/game' || parsed.search || parsed.hash
      || parsed.username || parsed.password) {
    throw new Error('only an explicit https://localhost:PORT/game loopback test server is allowed');
  }
  return Object.freeze({
    webTransportUrl: parsed.href,
    webTransportOptions: Object.freeze({
      serverCertificateHashes: [{ algorithm: 'sha-256', value: parseSha256Hex(sha256) }]
    })
  });
}

export async function connectDevRustActors({ app, pc, url, sha256, onStatus,
  connect = connectAuthoritativeClient, createLayer = createPlayCanvasActorLayer }) {
  const config = validateLoopbackQuicConfig({ url, sha256 });
  const layer = createLayer(app, pc);
  let localId = null;
  let client = null;
  let seenSnapshots = 0;
  let stopped = false;

  const accept = (kind, result, state) => {
    if (stopped) return;
    seenSnapshots += 1;
    const own = client?.playerNetId ?? localId;
    const { count } = layer.reconcile(state, own);
    onStatus?.('QUIC ' + kind + ': ' + count + ' authoritative actors; tick ' + result.serverTick);
  };

  try {
    client = await connect({
      ...config,
      // Never pass webSocketUrl: this is a strict QUIC-only dev connection.
      onSnapshot: (result, state) => accept('snapshot', result, state),
      onReliableSnapshot: (result, state) => accept('reliable snapshot', result, state),
      onProcessedAck(ack) {
        localId = ack.playerNetId;
      },
      onProtocolError(error) {
        onStatus?.('Rust protocol error: ' + (error?.message ?? 'unknown'));
      }
    });
    if (stopped || client.transport.kind !== 'webtransport') {
      client.close('invalid PlayCanvas read-only transport');
      throw new Error('PlayCanvas development actors require original QUIC WebTransport');
    }
    if (!seenSnapshots) onStatus?.('QUIC connected: waiting for real Rust snapshots');
    return Object.freeze({
      client,
      layer,
      get snapshotCount() { return seenSnapshots; },
      close() {
        if (stopped) return;
        stopped = true;
        client.close('PlayCanvas read-only client closed');
        layer.destroy();
      }
    });
  } catch (error) {
    stopped = true;
    layer.destroy();
    throw error;
  }
}
