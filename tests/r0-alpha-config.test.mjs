import "./world-sword-pointer.test.mjs";
import "./alpha-practice-link.test.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  assert.match(bootstrap, /Multiplayer connection failed/);
  assert.match(bootstrap, /\/web\/alpha\.html/);
});

function withTempStage(callback) {
  const temp = mkdtempSync(join(tmpdir(), "myaso-r0-stage-config-"));
  const stage = join(temp, "staged-public");
  const live = join(temp, "live-public");
  mkdirSync(join(stage, "web"), { recursive: true });
  mkdirSync(live);
  writeFileSync(join(stage, "web", "alpha.html"), "<!doctype html>");
  writeFileSync(join(live, "game-config.json"), "LIVE_UNCHANGED");
  try { callback({ temp, stage, live }); }
  finally { rmSync(temp, { recursive: true, force: true }); }
}

function generateStageCert(temp, days) {
  const cert = join(temp, "cert.pem");
  const key = join(temp, "key.pem");
  execFileSync("openssl", ["req", "-new", "-x509", "-nodes", "-days", String(days),
    "-sha256", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256",
    "-subj", "/CN=game.open-trust-layer.org",
    "-addext", "subjectAltName=DNS:game.open-trust-layer.org",
    "-keyout", key, "-out", cert], { stdio: "ignore" });
  return cert;
}

test("R2 stage pre-seeds an inactive release with actual sha256 certificate pin, preserving live config", () => {
  withTempStage(({ temp, stage, live }) => {
    const cert = generateStageCert(temp, 10);
    const helper = new URL("../ops/alpha/write-staged-config.sh", import.meta.url).pathname;
    execFileSync("bash", [helper, stage, cert], { stdio: "pipe" });
    const config = JSON.parse(readFileSync(join(stage, "game-config.json"), "utf8"));
    const der = execFileSync("openssl", ["x509", "-in", cert, "-outform", "DER"]);
    const expected = createHash("sha256").update(der).digest("hex");
    assert.equal(config.certificateSha256, expected);
    assert.deepEqual(parseAlphaConfig(config), config);
    assert.equal(statSync(join(stage, "game-config.json")).mode & 0o777, 0o644);
    assert.equal(readFileSync(join(live, "game-config.json"), "utf8"), "LIVE_UNCHANGED");
  });
});

test("R2 stage skips missing or soon-expiring TLS certificates instead of inventing a pin", () => {
  withTempStage(({ temp, stage }) => {
    const helper = new URL("../ops/alpha/write-staged-config.sh", import.meta.url).pathname;
    execFileSync("bash", [helper, stage, join(temp, "absent.pem")], { stdio: "pipe" });
    assert.equal(existsSync(join(stage, "game-config.json")), false);
    const cert = generateStageCert(temp, 1);
    execFileSync("bash", [helper, stage, cert], { stdio: "pipe" });
    assert.equal(existsSync(join(stage, "game-config.json")), false);
  });
});

test("R2 installer invokes inactive config preseed only at --stage; --activate retains certificate generation", () => {
  const script = readFileSync(new URL("../ops/alpha/install-vps.sh", import.meta.url), "utf8");
  const stage = script.slice(script.indexOf('if [[ "$mode" == --stage ]]'), script.indexOf("exit 0", script.indexOf('if [[ "$mode" == --stage ]]')));
  assert.match(stage, /write-staged-config\.sh/);
  assert.match(stage, /"\$release\/public"/);
  assert.doesNotMatch(stage, /systemctl|ufw|caddy reload|rotate-cert\.sh/);
  const activate = script.slice(script.indexOf("previous_release="));
  assert.match(activate, /rotate-cert\.sh/);
  assert.match(activate, /systemctl is-active/);
});
