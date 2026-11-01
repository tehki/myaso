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
    const device = await pc.createGraphicsDevice(canvas, {
      deviceTypes: [pc.DEVICETYPE_WEBGPU]
    });
    // Cap high-DPI render targets in the preview to control fill-rate and shadows.
    device.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

    const options = new pc.AppOptions();
    options.graphicsDevice = device;
    options.componentSystems = [
      pc.RenderComponentSystem,
      pc.CameraComponentSystem,
      pc.LightComponentSystem
    ];
    options.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler];

    const app = new pc.AppBase(canvas);
    app.init(options);
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener('resize', () => app.resizeCanvas());
    app.scene.ambientLight = new pc.Color(0.25, 0.27, 0.30);

    const scene = await buildGreyhavenBlockout(app, pc);
    app.start();

    const backend = rendererName(device);
    rendererStatus.textContent = `Renderer: ${backend}`;
    document.documentElement.dataset.engineBooted = 'true';
    document.documentElement.dataset.renderer = backend;
    document.documentElement.dataset.redLionAssetLoaded = scene.redLionAsset?.loaded ? 'true' : 'false';
    document.documentElement.dataset.redLionAssetSource = scene.redLionAsset?.source ?? 'diagnostic-proxy';
    document.documentElement.dataset.blacksmithAssetLoaded = scene.blacksmithAsset?.loaded ? 'true' : 'false';
    document.documentElement.dataset.greyhavenLook = scene.lightingLook;
    document.documentElement.dataset.greyhavenDuskSmoke = scene.duskSmokeActive ? 'true' : 'false';
    document.documentElement.dataset.greyhavenSmokeWisps = String(scene.duskSmokeWispCount);

    let devRustSession = null;
    runtimeStatus.textContent = 'Rust session: intentionally disconnected (visual-only preview)';
    document.documentElement.dataset.rustSession = 'disconnected';

    window.__MYASO_PLAYCANVAS__ = Object.freeze({
      app,
      device,
      scene,
      loadAuthoritativeClient: () => import('./rust-authoritative-client.js'),
      get devRustSession() { return devRustSession; }
    });

    // Deliberately separate from the PlayCanvas Editor's hosted Launch:
    // only local Vite DEV plus explicit ?rust=1 can enter the QUIC code path.
    // Neither production builds nor the default preview initiates a connection.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('rust') === '1') {
      document.documentElement.dataset.rustSession = 'connecting';
      runtimeStatus.textContent = 'Rust: checking local QUIC-only development configuration';
      try {
        const { connectDevRustActors } = await import('./network/dev-rust-session.js');
        devRustSession = await connectDevRustActors({
          app,
          pc,
          url: import.meta.env.VITE_MYASO_DEV_QUIC_URL,
          sha256: import.meta.env.VITE_MYASO_DEV_QUIC_SHA256,
          onStatus(message) {
            runtimeStatus.textContent = message;
          }
        });
        document.documentElement.dataset.rustSession = 'connected';
        window.addEventListener('beforeunload', () => devRustSession?.close(), { once: true });
      } catch (error) {
        document.documentElement.dataset.rustSession = 'error';
        runtimeStatus.textContent = `Local Rust session unavailable: ${error.message}`;
        console.warn('[MYASO PlayCanvas] opt-in local QUIC connection unavailable:', error.message);
      }
    }

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
