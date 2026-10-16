#!/usr/bin/env node
// Read-only, fail-closed public HTTPS preflight for myaso R0 alpha.
// Not a gameplay, UDP/QUIC, performance or deployment qualification.
import { resolve4 } from 'node:dns/promises';
import { request } from 'node:https';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';

export const HOST = 'game.open-trust-layer.org';
export const EXPECTED_IPV4 = '168.113.210.63';
const TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 4096;

export function checkDns(addresses) {
  return Array.isArray(addresses) && addresses.length > 0 &&
    addresses.every((address) => address === EXPECTED_IPV4);
}

export function checkAlphaConfig(config) {
  return config !== null && typeof config === 'object' && !Array.isArray(config) &&
    config.serverUrl === `https://${HOST}:4433/game` &&
    typeof config.certificateSha256 === 'string' &&
    /^[a-fA-F0-9]{64}$/.test(config.certificateSha256) &&
    Number.isInteger(config.maxPlayers) && config.maxPlayers >= 1 && config.maxPlayers <= 8;
}

export function checkResponse(path, status, body) {
  if (status !== 200) return false;
  if (path === '/web/alpha.html') return true;
  if (path !== '/game-config.json' || typeof body !== 'string') return false;
  try {
    return checkAlphaConfig(JSON.parse(body));
  } catch {
    return false;
  }
}

function fetchPublic(path) {
  return new Promise((resolvePromise, reject) => {
    const req = request({
      hostname: HOST,
      port: 443,
      path,
      method: 'GET',
      family: 4,
      // Pin the DNS-verified address while preserving hostname/SNI.
      lookup: (_name, _options, callback) => callback(null, EXPECTED_IPV4, 4),
      timeout: TIMEOUT_MS,
      headers: { Accept: path.endsWith('.json') ? 'application/json' : 'text/html' },
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status !== 200 || path !== '/game-config.json') {
        res.resume();
        resolvePromise({ status, body: '' });
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          req.destroy(Object.assign(new Error('Response limit exceeded'), { code: 'RESPONSE_LIMIT' }));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolvePromise({ status, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('Timeout'), { code: 'TIMEOUT' })));
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const report = {
    host: HOST,
    dns: { ok: false },
    html: { ok: false },
    config: { ok: false },
    ready: false,
    note: 'HTTPS-only preflight; UDP/4433, browser multiplayer, backups and VPS resources not verified',
  };
  try {
    const addresses = await resolve4(HOST);
    report.dns = { ok: checkDns(addresses), ipv4: addresses };
  } catch (error) {
    report.dns.error = error?.code ?? 'RESOLUTION_ERROR';
  }
  if (report.dns.ok) {
    for (const [key, path] of [['html', '/web/alpha.html'], ['config', '/game-config.json']]) {
      try {
        const { status, body } = await fetchPublic(path);
        report[key] = { ok: checkResponse(path, status, body), status };
      } catch (error) {
        report[key] = { ok: false, error: error?.code ?? 'REQUEST_ERROR' };
      }
    }
  }
  report.ready = report.dns.ok && report.html.ok && report.config.ok;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ready) process.exitCode = 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
