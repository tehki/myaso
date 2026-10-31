import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, join, resolve } from 'node:path';

const port = 4174;
const url = `http://127.0.0.1:${port}/`;
const vite = spawn(process.execPath, [
  resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
  '--port', String(port), '--strictPort'
], { stdio: 'ignore' });
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error('Vite did not become ready on 127.0.0.1:4174');
}

try {
  await waitForServer();
  const windowsChromeCandidates = process.platform === 'win32' ? [
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].filter(Boolean) : [];
  const chromeBin = process.env.CHROME_BIN || windowsChromeCandidates.find(existsSync) || (process.platform === 'win32' ? 'chrome.exe' : 'google-chrome');
  const screenshotPath = resolve('.artifacts/playcanvas-browser-smoke.png');
  mkdirSync(dirname(screenshotPath), { recursive: true });
  browser = spawn(chromeBin, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-background-networking', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader',
    '--window-size=1280,720', '--virtual-time-budget=8000',
    `--screenshot=${screenshotPath}`, '--dump-dom', url
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';
  browser.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  browser.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const [code] = await once(browser, 'close');
  if (code !== 0) throw new Error(`Chrome exited ${code}: ${stderr.slice(-4000)}`);
  if (!stdout.includes('data-engine-booted="true"')) {
    throw new Error(`PlayCanvas did not boot in headless Chrome. DOM tail:
${stdout.slice(-5000)}
Chrome stderr:
${stderr.slice(-3000)}`);
  }
  const match = stdout.match(/data-renderer="([^"]+)"/);
  if (!match || !['WebGPU', 'WebGL2'].includes(match[1])) {
    throw new Error(`Unexpected renderer marker: ${match?.[1] ?? 'missing'}`);
  }
  if (stdout.includes('PlayCanvas bootstrap failed')) {
    throw new Error('PlayCanvas bootstrap failure text found in DOM');
  }
  process.stdout.write(`PLAYCANVAS_BROWSER_SMOKE_PASS renderer=${match[1]} url=${url}
`);
} finally {
  if (browser && browser.exitCode === null) browser.kill('SIGTERM');
  if (vite.exitCode === null) vite.kill('SIGTERM');
}
