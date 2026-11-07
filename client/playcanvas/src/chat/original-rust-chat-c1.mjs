// Main0 Alpha 0.2: rehost the ORIGINAL authenticated Chat C1 UI and reliable
// QUIC bridge on PlayCanvas. No second protocol, sender authority, or input owner.
// Caller must already have passed the local DEV ?rust=1&chatC1=1 gate.
import { installLocalChat } from '../../../../src/browser/local-chat.mjs';
import { openLocalChatUiBridge } from '../../../../src/network/local-chat-ui-bridge.mjs';

export async function connectPlayCanvasChatC1({
  documentObj, stage, canvas, gameClient, onStatus = () => {},
  install = installLocalChat, openBridge = openLocalChatUiBridge,
} = {}) {
  // The chat stream may only be negotiated on an EXISTING authenticated
  // original-game WebTransport session; never open another transport.
  if (!gameClient || gameClient.transport?.kind !== 'webtransport'
    || gameClient.transport.closed || !documentObj?.createElement
    || !stage?.append || !canvas?.addEventListener) {
    onStatus('Chat C1 unavailable: original Rust QUIC and PlayCanvas UI required');
    return null;
  }
  let panel = null;
  let adapter = null;
  let closed = false;
  try {
    panel = install(documentObj, {
      online: true, stageElement: stage, canvasElement: canvas,
      includeStylesheet: false, // Bundled from the original web/local-chat.css.
    });
    if (!panel?.bindAdapter || !panel?.dispose || panel.root?.isConnected === false) {
      panel?.dispose?.();
      onStatus('Chat C1 unavailable: original chat panel could not mount');
      return null;
    }
    adapter = await openBridge(gameClient.transport, {
      onDisconnect() {
        if (closed) return;
        panel.bindAdapter(null);
        onStatus('Chat C1 disconnected; Rust gameplay remains connected');
      },
    });
    if (!adapter?.ready || panel.root?.isConnected === false) {
      await adapter?.close?.();
      panel.dispose();
      onStatus('Chat C1 unavailable: server did not grant a reliable stream');
      return null;
    }
    panel.bindAdapter(adapter);
    onStatus('Chat C1 connected to original Rust QUIC');
    return Object.freeze({
      panel,
      get ready() { return !closed && adapter.ready; },
      async close() {
        if (closed) return;
        closed = true;
        panel.bindAdapter(null);
        panel.dispose();
        // Retire ONLY the optional Chat C1 stream, never gameplay WebTransport.
        await adapter.close();
      },
    });
  } catch {
    // Optional Chat negotiation must not block authenticated Combat.
    closed = true;
    try { panel?.bindAdapter?.(null); panel?.dispose?.(); }
    finally {
      try { await adapter?.close?.(); } catch { /* Chat is already retired. */ }
    }
    onStatus('Chat C1 unavailable: original server rejected chat stream');
    return null;
  }
}
