import * as pc from 'playcanvas';
import { buildGreyhavenBlockout } from './scene/greyhaven-blockout.js';
import './style.css';

const canvas = document.querySelector('#application');
const rendererStatus = document.querySelector('#renderer-status');
const runtimeStatus = document.querySelector('#runtime-status');
const visibilityStatus = document.querySelector('#visibility-status');
const fatal = document.querySelector('#fatal');

function rendererName(device) {
  const name = device?.constructor?.name ?? 'UnknownGraphicsDevice';
  if (/webgpu/i.test(name)) return 'WebGPU';
  if (/webgl/i.test(name)) return 'WebGL2';
  return `${name} — backend needs inspection`;
}

async function boot() {
  try {
    // PlayCanvas requests WebGPU first and automatically falls back to WebGL 2.
    const device = await pc.createGraphicsDevice(canvas, {
      deviceTypes: [pc.DEVICETYPE_WEBGPU]
    });
    device.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const options = new pc.AppOptions();
    options.graphicsDevice = device;
    options.componentSystems = [
      pc.RenderComponentSystem,
      pc.CameraComponentSystem,
      pc.LightComponentSystem
    ];

    const app = new pc.AppBase(canvas);
    app.init(options);
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener('resize', () => app.resizeCanvas());
    app.scene.ambientLight = new pc.Color(0.25, 0.27, 0.30);

    const scene = buildGreyhavenBlockout(app, pc);
    app.start();

    const backend = rendererName(device);
    rendererStatus.textContent = `Renderer: ${backend}`;
    document.documentElement.dataset.engineBooted = 'true';
    document.documentElement.dataset.renderer = backend;
    runtimeStatus.textContent = 'Rust session: intentionally disconnected (no production endpoint configured)';
    window.__MYASO_PLAYCANVAS__ = Object.freeze({
      app,
      device,
      scene,
      loadAuthoritativeClient: () => import('./rust-authoritative-client.js')
    });

    document.addEventListener('visibilitychange', () => {
      visibilityStatus.textContent = `Tab: ${document.hidden ? 'background' : 'visible'}`;
    });
  } catch (error) {
    console.error('[MYASO PlayCanvas] bootstrap failed', error);
    fatal.hidden = false;
    fatal.textContent = `PlayCanvas bootstrap failed: ${error?.message ?? String(error)}`;
    rendererStatus.textContent = 'Renderer: failed';
    document.documentElement.dataset.engineBooted = 'false';
    document.documentElement.dataset.renderer = 'failed';
  }
}

void boot();
