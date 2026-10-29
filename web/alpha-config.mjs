// R0: validate the VPS-controlled WebTransport endpoint before opening a game.
// The trusted HTTPS page serves /game-config.json with the currently pinned,
// short-lived QUIC certificate SHA-256. Never use an arbitrary external URL.
export function parseAlphaConfig(raw, expectedHost = "game.open-trust-layer.org") {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TypeError("alpha configuration is unavailable");
  }
  if (typeof raw.serverUrl !== "string") throw new TypeError("alpha server URL is missing");
  const url = new URL(raw.serverUrl);
  if (url.protocol !== "https:" || url.hostname !== expectedHost
    || url.port !== "4433" || url.pathname !== "/game"
    || url.search || url.hash || url.username || url.password) {
    throw new TypeError("alpha server URL is not the trusted game endpoint");
  }
  if (typeof raw.certificateSha256 !== "string" || !/^[0-9a-f]{64}$/i.test(raw.certificateSha256)) {
    throw new TypeError("alpha certificate fingerprint must be 64 hexadecimal characters");
  }
  if (!Number.isInteger(raw.maxPlayers) || raw.maxPlayers < 2 || raw.maxPlayers > 8) {
    throw new TypeError("alpha player cap must be between 2 and 8");
  }
  if (raw.chatC1Enabled !== undefined && typeof raw.chatC1Enabled !== "boolean") {
    throw new TypeError("chat C1 rollout must be a boolean");
  }
  if (raw.instantLmbEnabled !== undefined && typeof raw.instantLmbEnabled !== "boolean") {
    throw new TypeError("instant LMB rollout must be a boolean");
  }
  // Operator-owned first-party release profile; keep original five clips as
  // default until Main enables art in the served, certificate-pinned config.
  if (raw.silverKnightRelitEnabled !== undefined && typeof raw.silverKnightRelitEnabled !== "boolean") {
    throw new TypeError("Silver Knight relit rollout must be a boolean");
  }
  return Object.freeze({
    serverUrl: url.href,
    certificateSha256: raw.certificateSha256.toLowerCase(),
    maxPlayers: raw.maxPlayers,
    ...(raw.chatC1Enabled === true ? {chatC1Enabled: true} : {}),
    ...(raw.instantLmbEnabled === true ? {instantLmbEnabled: true} : {}),
    ...(raw.silverKnightRelitEnabled === true ? {silverKnightRelitEnabled: true} : {}),
  });
}
export function alphaPlayPath(config) {
  return "/web/?" + new URLSearchParams({
    server: config.serverUrl,
    cert: config.certificateSha256,
    // The official Pre-Alpha 0.1 lobby always gives every human a Silver Knight.
    // Direct legacy Combat acceptance URLs retain their original pixel baseline.
    knights: "1",
    // Only a trusted operator-served release config can advertise the four
    // SHA-pinned source-relit locomotion atlases. Original Roll stays native;
    // unset/false fully restores the five immutable baseline Silver atlases.
    ...(config.silverKnightRelitEnabled === true ? {knightArt: "relit"} : {}),
    // Only a trusted, operator-served alpha config can advertise chat.
    // The Rust server separately requires MYASO_CHAT_C1_ENABLED=1.
    ...(config.chatC1Enabled === true ? {chatC1: "1"} : {}),
    ...(config.instantLmbEnabled === true ? {instantLmb: "1"} : {}),
  });
}
