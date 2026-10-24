// Graphics 3B P0 source-only isolation gate. This does NOT replace native
// Rust/WebTransport Chrome+Firefox two/four-player or exact-head Combat QA.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { alphaPlayPath, parseAlphaConfig } from "../web/alpha-config.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const cfg = {
  serverUrl: "https://game.open-trust-layer.org:4433/game",
  certificateSha256: "a".repeat(64),
  maxPlayers: 4,
};

test("P0 server-backed Combat page has its original 960x540 arena, not an Alpha world entrypoint", () => {
  const page = read("../web/index.html");
  const bootstrap = read("../web/bootstrap.mjs");
  const arena = read("../web/online-game.mjs");
  assert.match(page, /<canvas id="arena" width="960" height="540"/);
  assert.match(page, /src="\.\/bootstrap\.mjs"/);
  assert.match(bootstrap, /params\.has\("server"\)/);
  assert.match(bootstrap, /await import\("\.\/online-game\.mjs"\)/);
  assert.match(arena, /const arenaLayer = createArenaLayer\(\);/);
  assert.match(arena, /ctx\.drawImage\(arenaLayer, 0, 0\);/);
});

test("P0 authoritative arena imports Silver presentation without Graphics 3B/3C Alpha architecture modules", () => {
  const arena = read("../web/online-game.mjs");
  // All current static imports are single-line import declarations.
  const imports = arena.split("\n").filter(line => /^import\s/.test(line));
  assert.ok(imports.some(line => line.includes('"./knight-sprites.mjs"')),
    "authentic Silver presentation must remain reachable");
  assert.ok(imports.some(line => line.includes('"../src/browser/arena-viewport.mjs"')),
    "original arena projection must remain reachable");
  for (const line of imports) {
    assert.doesNotMatch(line, /greyhaven|red-lion|blacksmith|world9|architecture|terrain|buildings/i,
      "P1 architecture/terrain must not be imported into P0 Combat");
  }
  assert.doesNotMatch(arena, /import\s*\(\s*["'][^"']*(?:greyhaven|red-lion|blacksmith|world9)[^"']*["']\s*\)/i,
    "P1 world must not enter through a dynamic arena import");
});

test("trusted Silver multiplayer lobby never opts into buildings, city, optional terrain, or item transactions", () => {
  for (const enabled of [undefined, false, true]) {
    const input = { ...cfg };
    if (enabled !== undefined) input.silverKnightRelitEnabled = enabled;
    const url = new URL(alphaPlayPath(parseAlphaConfig(input)), "https://game.open-trust-layer.org");
    assert.equal(url.pathname, "/web/");
    assert.equal(url.searchParams.get("knights"), "1");
    assert.equal(url.searchParams.get("knightArt"), enabled === true ? "relit" : null);
    for (const flag of ["arenaLite", "world", "redlion", "greyhaven", "blacksmith", "terrain", "sword"]) {
      assert.equal(url.searchParams.has(flag), false, flag + " must not become a P0 dependency");
    }
  }
});
