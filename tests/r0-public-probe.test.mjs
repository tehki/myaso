import test from 'node:test';
import assert from 'node:assert/strict';
import { HOST, EXPECTED_IPV4, checkDns, checkAlphaConfig, checkResponse } from '../scripts/probe-r0-public.mjs';

const valid = {
  serverUrl: `https://${HOST}:4433/game`,
  certificateSha256: 'a'.repeat(64),
  maxPlayers: 8,
};

test('requires exclusively the approved IPv4 destination', () => {
  assert.equal(checkDns([EXPECTED_IPV4]), true);
  assert.equal(checkDns([]), false);
  assert.equal(checkDns([EXPECTED_IPV4, '192.0.2.1']), false);
  assert.equal(checkDns(['192.0.2.1']), false);
});

test('requires pinned QUIC URL, certificate fingerprint, bounded admission', () => {
  assert.equal(checkAlphaConfig(valid), true);
  assert.equal(checkAlphaConfig({ ...valid, serverUrl: 'https://example.com/game' }), false);
  assert.equal(checkAlphaConfig({ ...valid, certificateSha256: 'short' }), false);
  assert.equal(checkAlphaConfig({ ...valid, maxPlayers: 512 }), false);
  assert.equal(checkAlphaConfig({ ...valid, maxPlayers: 0 }), false);
  assert.equal(checkAlphaConfig(null), false);
});

test('fails closed on auth, redirect or missing asset', () => {
  for (const status of [0, 301, 302, 401, 403, 404, 500]) {
    assert.equal(checkResponse('/web/alpha.html', status, ''), false);
    assert.equal(checkResponse('/game-config.json', status, '{}'), false);
  }
});

test('checks JSON content without accepting malformed or unrelated paths', () => {
  assert.equal(checkResponse('/web/alpha.html', 200, '<html>ok</html>'), true);
  assert.equal(checkResponse('/game-config.json', 200, JSON.stringify(valid)), true);
  assert.equal(checkResponse('/game-config.json', 200, 'invalid json'), false);
  assert.equal(checkResponse('/game-config.json', 200, JSON.stringify({})), false);
  assert.equal(checkResponse('/admin', 200, JSON.stringify(valid)), false);
});
