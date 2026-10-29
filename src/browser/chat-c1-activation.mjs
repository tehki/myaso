// C1B: explicit, loopback-only preview. No production/chat mock switch.
// The approved Core bridge opens opt-in reliable streams on the existing
// authenticated WebTransport game session; it never owns combat datagrams.
import { installLocalChat } from "./local-chat.mjs";
import { openLocalChatUiBridge } from "../network/local-chat-ui-bridge.mjs";
import { parseAlphaConfig } from "../../web/alpha-config.mjs";

export function isChatC1PreviewEligible(location) {
  if (!location || location.protocol !== "http:") return false;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return false;
  const params = new URLSearchParams(location.search);
  return params.has("server") && params.get("chatC1Preview") === "1";
}

export function isChatC1ReleaseEligible(location) {
  if (!location || location.protocol !== "https:"
    || location.hostname !== "game.open-trust-layer.org") return false;
  const params = new URLSearchParams(location.search);
  return params.has("server") && params.has("cert")
    && params.get("chatC1") === "1" && !params.has("chatC1Preview");
}

export function isChatC1Eligible(location) {
  return isChatC1PreviewEligible(location) || isChatC1ReleaseEligible(location);
}

// The public URL parameter alone is NEVER rollout authority. The same-origin,
// operator-served pinned config must affirm chat on this exact TLS endpoint.
// No chat panel or transport attempt is created if the public flag is absent.
export async function isTrustedChatC1ReleaseConfigured(location, fetchConfig = globalThis.fetch) {
  if (!isChatC1ReleaseEligible(location)) return false;
  try {
    if (typeof fetchConfig !== "function") return false;
    const response = await fetchConfig("/game-config.json", {
      cache: "no-store", credentials: "same-origin",
    });
    if (!response?.ok) return false;
    const config = parseAlphaConfig(await response.json());
    const params = new URLSearchParams(location.search);
    return config.chatC1Enabled === true
      && params.get("server") === config.serverUrl
      && params.get("cert")?.toLowerCase() === config.certificateSha256;
  } catch {
    return false;
  }
}

export async function activateChatC1Preview({
  doc, location, gameClient, openBridge = openLocalChatUiBridge,
  fetchConfig = globalThis.fetch,
} = {}) {
  if (!isChatC1Eligible(location)) return null;
  if (isChatC1ReleaseEligible(location)
      && !(await isTrustedChatC1ReleaseConfigured(location, fetchConfig))) return null;
  const panel = installLocalChat(doc, { online: true });
  if (!panel || gameClient?.transport?.kind !== "webtransport") return null;
  try {
    const adapter = await openBridge(gameClient.transport, {
      onDisconnect() { panel.bindAdapter(null); },
    });
    if (panel.root.isConnected === false) {
      await adapter.close();
      return null;
    }
    if (!adapter?.ready) {
      await adapter?.close?.();
      return null;
    }
    panel.bindAdapter(adapter);
    doc.defaultView?.addEventListener?.("pagehide", () => {
      panel.bindAdapter(null);
      void adapter.close();
    }, { once: true });
    return adapter;
  } catch {
    // Combat must remain fully active if optional chat negotiation fails.
    panel.bindAdapter(null);
    panel.status.textContent = "Local chat unavailable — gameplay remains connected.";
    return null;
  }
}
