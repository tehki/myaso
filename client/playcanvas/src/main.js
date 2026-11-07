import * as pc from 'playcanvas';
import { buildGreyhavenBlockout } from './scene/greyhaven-blockout.js';
import './style.css';

const canvas = document.querySelector('#application');
const rendererStatus = document.querySelector('#renderer-status');
const runtimeStatus = document.querySelector('#runtime-status');
const visibilityStatus = document.querySelector('#visibility-status');
const fatal = document.querySelector('#fatal');
const combatPanel = document.querySelector('#combat-panel');
const combatStatus = document.querySelector('#combat-status');
const hitStatus = document.querySelector('#hit-status');
const chatStatus = document.querySelector('#chat-status');

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
    device.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);

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

    let devRustSession = null;
    let chatSession = null;
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
    const query = new URLSearchParams(window.location.search);
    if (import.meta.env.DEV && query.get('rust') === '1') {
      const combatRequested = query.get('combatInput') === '1';
      const hitRequested = combatRequested && query.get('privateHit') === '1';
      const chatRequested = query.get('chatC1') === '1';
      if (chatRequested) {
        chatStatus.hidden = false;
        chatStatus.textContent = 'Chat C1: waiting for original Rust QUIC';
        document.documentElement.dataset.chatC1 = 'connecting';
      }
      document.documentElement.dataset.rustSession = 'connecting';
      document.documentElement.dataset.combatInput = combatRequested ? 'connecting' : 'disabled';
      combatPanel.hidden = !combatRequested;
      runtimeStatus.textContent = 'Rust: checking local QUIC-only development configuration';
      try {
        const { connectDevRustActors } = await import('./network/dev-rust-session.js');
        devRustSession = await connectDevRustActors({
          app, pc, canvas, windowObj: window, documentObj: document,
          enableCombatInput: combatRequested,
          enablePrivateHit: hitRequested,
          onHitReceipt(receipt, presentation) {
            // Authenticated M147 receipt only; never infer from HP deltas or ACK.
            if (presentation?.kind === 'hit') hitStatus.textContent =
              `Rust HIT #${receipt.sequence}: ${presentation.text}`;
          },
          url: import.meta.env.VITE_MYASO_DEV_QUIC_URL,
          sha256: import.meta.env.VITE_MYASO_DEV_QUIC_SHA256,
          onStatus(message) {
            runtimeStatus.textContent = message;
            if (combatRequested && /Combat granted/.test(message))
              document.documentElement.dataset.combatInput = 'granted';
          },
          onCombatPose(combat) {
            // UI10 is a read-only consumer; no HIT inferred from HP changes.
            combatStatus.textContent = combat
              ? `Rust #${combat.netId} · HP ${combat.hp} · guard ${combat.guard} · stamina ${combat.stamina} · ${combat.actionName}`
                + (combat.recoveryCue ? ' · JUMP RECOVERY (render-only)' : '')
              : 'Combat: waiting for complete Rust World snapshot';
          }
        });
        document.documentElement.dataset.rustSession = 'connected';
        if (combatRequested && document.documentElement.dataset.combatInput !== 'granted')
          document.documentElement.dataset.combatInput = 'armed';
        window.addEventListener('beforeunload', () => {
          void chatSession?.close()?.catch(() => {});
          devRustSession?.close();
        }, { once: true });
        if (chatRequested) {
          try {
            await import('../../../web/local-chat.css');
            const { connectPlayCanvasChatC1 } =
              await import('./chat/original-rust-chat-c1.mjs');
            chatSession = await connectPlayCanvasChatC1({
              documentObj: document,
              stage: document.querySelector('#shell'),
              canvas,
              gameClient: devRustSession.client,
              onStatus(message) {
                chatStatus.textContent = message;
                if (/disconnected/.test(message)) {
                  document.documentElement.dataset.chatC1 = 'disconnected';
                }
              }
            });
            document.documentElement.dataset.chatC1 =
              chatSession?.ready ? 'connected' : 'unavailable';
          } catch {
            chatStatus.textContent = 'Chat C1 unavailable; Rust gameplay remains connected';
            document.documentElement.dataset.chatC1 = 'unavailable';
          }
        }
      } catch (error) {
        document.documentElement.dataset.rustSession = 'error';
        document.documentElement.dataset.combatInput = 'error';
        if (chatRequested) {
          document.documentElement.dataset.chatC1 = 'unavailable';
          chatStatus.textContent = 'Chat C1 requires a connected Rust QUIC session';
        }
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
