import { parseAlphaConfig } from "../../web/alpha-config.mjs";

const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
const disabled = Object.freeze({enabled:false});

// Release intent comes from the first-party pinned configuration. A URL
// requests that profile; it cannot authorize a server capability or a hit.
export async function resolveInstantLmbProfile(location, fetchConfig = globalThis.fetch) {
  if (!location) return disabled;
  const params = new URLSearchParams(location.search);
  if (params.has("gestureLab") || params.has("jumpCombatReview") || params.has("hitDeliveryLab")) return disabled;
  let server;
  try { server = new URL(params.get("server")); } catch { return disabled; }
  if (location.protocol === "http:" && loopback.has(location.hostname)
      && params.get("instantLmbPreview") === "1" && !params.has("instantLmb")
      && server.protocol === "https:" && loopback.has(server.hostname)
      && server.pathname === "/game" && !server.username && !server.password
      && !server.search && !server.hash) {
    return Object.freeze({enabled:true,kind:"preview"});
  }
  if (location.protocol !== "https:" || location.hostname !== "game.open-trust-layer.org"
      || params.get("instantLmb") !== "1" || params.has("instantLmbPreview")
      || typeof fetchConfig !== "function") return disabled;
  try {
    const response = await fetchConfig("/game-config.json", {
      cache:"no-store",credentials:"same-origin",signal:AbortSignal.timeout(3000),
    });
    if (!response?.ok) return disabled;
    const config = parseAlphaConfig(await response.json());
    if (config.instantLmbEnabled !== true || params.get("server") !== config.serverUrl
        || params.get("cert")?.toLowerCase() !== config.certificateSha256) return disabled;
    return Object.freeze({enabled:true,kind:"release"});
  } catch { return disabled; }
}
