import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD9_VISUAL_ORIGIN, VISUAL_WORLD9_SCALE,
  projectAuthoritativePosition, createAuthoritativeSnapshotView
} from '../src/scene/authoritative-snapshot-view.mjs';
import { validateLoopbackQuicConfig, connectDevRustActors } from '../src/network/dev-rust-session.js';

test('World9 projection consumes unchanged authored map coordinates', () => {
  assert.deepEqual(WORLD9_VISUAL_ORIGIN, { x: 4140, y: 4105 });
  assert.equal(VISUAL_WORLD9_SCALE, 0.025);
  assert.deepEqual(projectAuthoritativePosition(4365, 3965), { x: 5.625, y: 0, z: -3.5 });
  const smith = projectAuthoritativePosition(3801, 3931);
  assert.equal(smith.x, -8.475);
  assert.ok(Math.abs(smith.z + 4.35) < 1e-10);
  for (const xy of [[NaN, 1], [1, Infinity], [-1, 2], [8193, 1], [0, -2]]) {
    assert.equal(projectAuthoritativePosition(...xy), null);
  }
});

test('snapshot view copies Rust state; authoritative removals and own id are reflected', () => {
  const events = [];
  const view = createAuthoritativeSnapshotView({
    create(pose) { events.push(['create', pose]); return { id: pose.netId }; },
    update(handle, pose) { events.push(['update', handle.id, pose]); },
    remove(handle) { events.push(['remove', handle.id]); }
  });
  const state = new Map([[17, { netId: 17, x: 4110, y: 4160, facing: 1,
    hp: 86, stamina: 63, action: 16, serverTick: 32 }]]);
  assert.deepEqual(view.reconcile(state, null), { count: 1 });
  assert.equal(events[0][1].position.x, -.75);
  assert.equal(events[0][1].isOwn, false);
  state.get(17).x = 4120;
  assert.deepEqual(view.reconcile(state, 17), { count: 1 });
  assert.equal(events[1][2].isOwn, true);
  assert.equal(events[1][2].hp, 86);
  assert.equal(state.get(17).x, 4120, 'rendering must not mutate Rust state');
  state.clear();
  assert.deepEqual(view.reconcile(state, 17), { count: 0 });
  assert.deepEqual(events.at(-1), ['remove', 17]);
  view.clear();
  assert.equal(view.count, 0);
});

test('invalid/out-of-map actor coordinates are never displayed as Greyhaven authority', () => {
  const created = [];
  const view = createAuthoritativeSnapshotView({
    create(p) { created.push(p.netId); return p.netId; },
    update() {},
    remove() {}
  });
  const entities = new Map([
    [1, { netId: 1, x: 500, y: 500 }],
    [2, { netId: 2, x: NaN, y: 4000 }],
    [3, { netId: 3, x: 99999, y: 3900 }],
    [4, { netId: 8, x: 4000, y: 3900 }]
  ]);
  view.reconcile(entities);
  assert.deepEqual(created, [1]);
});

test('QUIC dev configuration rejects production hosts, missing certificate pins and WebSocket', () => {
  const sha256 = 'ab'.repeat(32);
  const c = validateLoopbackQuicConfig({ url: 'https://127.0.0.1:8443/game', sha256 });
  assert.equal(c.webTransportUrl, 'https://127.0.0.1:8443/game');
  assert.equal(c.webTransportOptions.serverCertificateHashes[0].value.byteLength, 32);
  for (const url of [
    'https://game.open-trust-layer.org:4433/game',
    'https://127.0.0.1:8443/something-else',
    'wss://127.0.0.1:8443/game',
    'https://localhost/game',
    'https://user@localhost:8443/game',
    'https://127.0.0.1:8443/game?token=not-allowed'
  ]) assert.throws(() => validateLoopbackQuicConfig({ url, sha256 }));
  assert.throws(() => validateLoopbackQuicConfig({ url: 'https://localhost:8443/game', sha256: '' }));
});

test('integration consumes original authoritative callback signatures and never sends input', async () => {
  const statuses = [];
  const changes = [];
  let connectionArgs;
  let closeReason;
  const layer = {
    reconcile(state, own) {
      changes.push({ ids: [...state.keys()], own });
      return { count: state.size };
    },
    destroy() { changes.push({ destroyed: true }); }
  };
  const session = await connectDevRustActors({
    app: {}, pc: {}, url: 'https://localhost:8443/game', sha256: 'ae'.repeat(32),
    createLayer() { return layer; },
    onStatus(msg) { statuses.push(msg); },
    async connect(args) {
      connectionArgs = args;
      assert.equal(args.webSocketUrl, undefined, 'never allow WebSocket fallback');
      assert.equal(args.webTransportUrl, 'https://localhost:8443/game');
      assert.equal(typeof args.onSnapshot, 'function');
      assert.equal(typeof args.onReliableSnapshot, 'function');
      assert.equal(args.sendInput, undefined);
      return {
        playerNetId: 12, transport: { kind: 'webtransport' },
        close(reason) { closeReason = reason; }
      };
    }
  });
  assert.equal(session.snapshotCount, 0);
  assert.match(statuses[0], /waiting for real Rust snapshots/);
  const state = new Map([[12, { netId: 12, x: 4110, y: 4160 }]]);
  connectionArgs.onSnapshot({ serverTick: 90, full: true }, state);
  assert.deepEqual(changes[0], { ids: [12], own: 12 });
  assert.equal(session.snapshotCount, 1);
  state.set(13, { netId: 13, x: 4200, y: 4150 });
  connectionArgs.onReliableSnapshot({ serverTick: 91, full: false }, state, {});
  assert.deepEqual(changes[1], { ids: [12, 13], own: 12 });
  assert.equal(session.snapshotCount, 2);
  assert.match(statuses.at(-1), /reliable snapshot: 2 authoritative actors/);
  session.close();
  assert.equal(closeReason, 'PlayCanvas read-only client closed');
  assert.ok(changes.some(x => x.destroyed));
  connectionArgs.onSnapshot({ serverTick: 92 }, state);
  assert.equal(session.snapshotCount, 2, 'closed client ignores post-close snapshots');
});

test('non-QUIC development connection destroys provisional actors', async () => {
  let destroyed = 0;
  await assert.rejects(() => connectDevRustActors({
    app: {}, pc: {}, url: 'https://127.0.0.1:4433/game', sha256: 'ab'.repeat(32),
    createLayer: () => ({ destroy() { destroyed++; } }),
    connect: async () => ({ transport: { kind: 'websocket' }, close() {} })
  }), /QUIC WebTransport/);
  assert.equal(destroyed, 1);
});
