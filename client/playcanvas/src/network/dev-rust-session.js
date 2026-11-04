import { createPlayCanvasActorLayer } from '../scene/authoritative-actors.js';
import { parseSha256Hex, connectAuthoritativeClient } from '../rust-authoritative-client.js';
import { projectAuthoritativeCombat } from '../combat/authoritative-combat-view.mjs';
import { createOriginalRustCombatInput } from '../input/original-rust-combat-input.mjs';

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
  enableCombatInput = false, enablePrivateHit = false,
  canvas, windowObj, documentObj, onCombatPose, onHitReceipt,
  connect = connectAuthoritativeClient, createLayer = createPlayCanvasActorLayer,
  createCombatInput = createOriginalRustCombatInput }) {
  const config = validateLoopbackQuicConfig({ url, sha256 });
  const layer = createLayer(app, pc);
  let localId = null;
  let client = null;
  let seenSnapshots = 0;
  let stopped = false;
  let combatInput = null;
  if (enableCombatInput && (!canvas?.addEventListener ||
      !windowObj?.addEventListener || !documentObj?.addEventListener)) {
    layer.destroy();
    throw new TypeError('real UI10 canvas, window and document required');
  }

  const accept = (kind, result, state) => {
    if (stopped) return;
    seenSnapshots += 1;
    const own = client?.playerNetId ?? localId;
    const { count } = layer.reconcile(state, own);
    if (Number.isInteger(own) && state.has(own)) {
      // Only original Rust snapshots may update the Combat UI; no local HIT
      // inference from HP deltas or source0 typed transport ACKs.
      onCombatPose?.(projectAuthoritativeCombat(state.get(own)));
    }
    onStatus?.('QUIC ' + kind + ': ' + count + ' authoritative actors; tick ' + result.serverTick);
    if (combatInput) void combatInput.maybeBindActor();
  };

  try {
    client = await connect({
      ...config,
      // Never pass webSocketUrl: this is a strict QUIC-only dev connection.
      onSnapshot: (result, state) => accept('snapshot', result, state),
      onReliableSnapshot: (result, state) => accept('reliable snapshot', result, state),
      onProcessedAck(ack) {
        localId = ack.playerNetId;
        // The processed-input ACK alone is NOT an authenticated World actor:
        // ownership is established only after the matching original snapshot.
      },
      ...(enableCombatInput ? {
        onExperimentalGestureAck(bytes, lease) {
          if (!combatInput) {
            client?.close('typed ACK without a current PlayCanvas input owner');
            throw new Error('typed ACK before negotiated UI10 owner');
          }
          combatInput.receiveTypedAck(bytes, lease);
        },
      } : {}),
      onProtocolError(error) {
        onStatus?.('Rust protocol error: ' + (error?.message ?? 'unknown'));
      }
    });
    if (stopped || client.transport.kind !== 'webtransport') {
      client.close('invalid PlayCanvas read-only transport');
      throw new Error('PlayCanvas development actors require original QUIC WebTransport');
    }
    if (enableCombatInput) {
      combatInput = createCombatInput({
        canvas, windowObj, documentObj, getClient: () => client,
        enablePrivateHit, onHitReceipt, onStatus, onAcceptedPress() {
          // A physical trusted PRESS is input intent, not a World HIT.
          onStatus?.('Original Rust physical LMB accepted; awaiting World');
        },
      });
      // Do not invent a neutral input to claim a player ID. A real physical
      // v1 sample must first receive original ACK and matching snapshot.
      void combatInput.maybeBindActor();
    }
    if (!seenSnapshots) onStatus?.('QUIC connected: waiting for real Rust snapshots');
    return Object.freeze({
      client,
      layer,
      get combatInput() { return combatInput; },
      get snapshotCount() { return seenSnapshots; },
      close() {
        if (stopped) return;
        stopped = true;
        combatInput?.stop();
        client.close(enableCombatInput
          ? 'PlayCanvas original Rust Combat client closed'
          : 'PlayCanvas read-only client closed');
        layer.destroy();
      }
    });
  } catch (error) {
    stopped = true;
    combatInput?.stop();
    client?.close?.('PlayCanvas input integration failed closed');
    layer.destroy();
    throw error;
  }
}
