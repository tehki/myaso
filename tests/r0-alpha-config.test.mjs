import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseAlphaConfig, alphaPlayPath } from "../web/alpha-config.mjs";

const trusted = {
  serverUrl: "https://game.open-trust-layer.org:4433/game",
  certificateSha256: "a".repeat(64),
  maxPlayers: 8,
};
test("R0 strictly validates the public game endpoint and pins a short-lived QUIC certificate", () => {
  const parsed = parseAlphaConfig(trusted);
  assert.equal(parsed.serverUrl, trusted.serverUrl);
  assert.equal(parsed.certificateSha256, trusted.certificateSha256);
  assert.equal(parsed.maxPlayers, 8);
  const path = alphaPlayPath(parsed);
  assert.equal(new URL(path, "https://game.open-trust-layer.org").searchParams.get("server"), trusted.serverUrl);
  assert.equal(new URL(path, "https://game.open-trust-layer.org").searchParams.get("cert"), trusted.certificateSha256);
});
test("R0 refuses insecure, cross-origin, wrong-port and malformed server configs", () => {
  for (const serverUrl of [
    "http://game.open-trust-layer.org:4433/game", "https://evil.example:4433/game",
    "https://game.open-trust-layer.org:443/game",
    "https://game.open-trust-layer.org:4433/other",
    "https://admin:pass@game.open-trust-layer.org:4433/game",
    "https://game.open-trust-layer.org:4433/game?x=1",
  ]) assert.throws(() => parseAlphaConfig({ ...trusted, serverUrl }));
  for (const certificateSha256 of ["", "ABC", "x".repeat(64)]) {
    assert.throws(() => parseAlphaConfig({ ...trusted, certificateSha256 }));
  }
  for (const maxPlayers of [1, 9, null, "8", 2.5]) {
    assert.throws(() => parseAlphaConfig({ ...trusted, maxPlayers }));
  }
});
test("R0 launcher offers a real online route; existing local practice remains separate", () => {
  const alpha = readFileSync(new URL("../web/alpha.html", import.meta.url), "utf8");
  const launcher = readFileSync(new URL("../web/alpha.mjs", import.meta.url), "utf8");
  const bootstrap = readFileSync(new URL("../web/bootstrap.mjs", import.meta.url), "utf8");
  assert.match(alpha, /JOIN MULTIPLAYER/);
  assert.match(alpha, /LOCAL PRACTICE/);
  assert.match(launcher, /game-config\.json/);
  assert.match(launcher, /typeof WebTransport !== "function"/);
  assert.match(launcher, /alphaPlayPath\(config\)/);
  assert.match(bootstrap, /params\.has\("server"\)/);
});
