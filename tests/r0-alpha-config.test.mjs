import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseAlphaConfig, alphaPlayPath } from "../web/alpha-config.mjs";

test("Bing SEO: both public Myaso page heads have one unique, meaningful meta description", () => {
  const files = [
    ["alpha.html", /multiplayer alpha/i],
    ["index.html", /browser combat prototype/i],
  ];
  const descriptions = [];
  for (const [filename, relevance] of files) {
    const html = readFileSync(new URL("../web/" + filename, import.meta.url), "utf8");
    const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1];
    assert.ok(head, filename + " must have an HTML head");
    const matches = [...head.matchAll(/<meta\s+name="description"\s+content="([^"]+)"\s*\/?\s*>/gi)];
    assert.equal(matches.length, 1, filename + " must have exactly one description in head");
    const description = matches[0][1].trim();
    assert.ok(description.length >= 70 && description.length <= 160,
      filename + " description should fit search-result snippets");
    assert.match(description, relevance, filename + " must describe its actual page");
    assert.ok(!/[<>]/.test(description), filename + " description must contain plain text");
    descriptions.push(description);
  }
  assert.notEqual(descriptions[0], descriptions[1], "Pages need distinct descriptions");
});

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
  assert.match(bootstrap, /Multiplayer connection failed/);
  assert.match(bootstrap, /\/web\/alpha\.html/);
});
