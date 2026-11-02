import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';

// Chrome's Windows headless CLI exits successfully but emits no --dump-dom stdout
// in the supported desktop image. Windows browser acceptance is run separately
// through Playwright against real Chrome and Firefox; the dedicated CI job is Linux.
if (process.platform === 'win32') {
  process.stdout.write(
    'PLAYCANVAS_BROWSER_SMOKE_SKIPPED platform=win32 reason=use_Playwright_Chrome_Firefox_matrix\n'
  );
  process.exit(0);
}

const port = 4174;
const url = `http://127.0.0.1:${port}/`;
const chromeProfilePath = resolve(`.artifacts/chrome-profile-${process.pid}`);
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
  const chromeBin = process.env.CHROME_BIN || 'google-chrome';
  const screenshotPath = resolve('.artifacts/playcanvas-browser-smoke.png');
  mkdirSync(dirname(screenshotPath), { recursive: true });
  browser = spawn(chromeBin, [
    '--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${chromeProfilePath}`, '--disable-dev-shm-usage',
    '--disable-background-networking', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader',
    '--window-size=1280,720', '--virtual-time-budget=20000',
    `--screenshot=${screenshotPath}`, '--dump-dom', url
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';
  browser.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  browser.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const [code] = await once(browser, 'close');
  if (code !== 0) throw new Error(`Chrome exited ${code}: ${stderr.slice(-4000)}`);
  if (!stdout.trim()) throw new Error(`Chrome produced no DOM output. Check browser installation and stderr:\n${stderr.slice(-4000)}`);
  if (!stdout.includes('data-engine-booted="true"')) {
    throw new Error(`PlayCanvas did not boot in headless Chrome. DOM tail:\n${stdout.slice(-5000)}\nChrome stderr:\n${stderr.slice(-3000)}`);
  }
  if (!stdout.includes('data-red-lion-asset-loaded="true"')) {
    throw new Error(`Quaternius Red Lion asset assembly did not load. DOM tail:\n${stdout.slice(-5000)}\nChrome stderr:\n${stderr.slice(-3000)}`);
  }
  const match = stdout.match(/data-renderer="([^"]+)"/);
  if (!match || !['WebGPU', 'WebGL2'].includes(match[1])) {
    throw new Error(`Unexpected renderer marker: ${match?.[1] ?? 'missing'}`);
  }
  if (stdout.includes('PlayCanvas bootstrap failed')) {
    throw new Error('PlayCanvas bootstrap failure text found in DOM');
  }
  const screenshotBytes = statSync(screenshotPath).size;
  if (screenshotBytes < 1024) throw new Error(`Browser screenshot is unexpectedly small: ${screenshotBytes} bytes`);
  process.stdout.write(`PLAYCANVAS_BROWSER_SMOKE_PASS renderer=${match[1]} red_lion=quaternius_cc0 screenshot_bytes=${screenshotBytes} url=${url}\n`);
} finally {
  if (browser && browser.exitCode === null) browser.kill('SIGTERM');
  if (vite.exitCode === null) vite.kill('SIGTERM');
  await rm(chromeProfilePath, { recursive: true, force: true });
}
