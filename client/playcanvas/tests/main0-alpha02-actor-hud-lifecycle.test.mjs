import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_ACTION } from '../../../src/browser/combat-readability.mjs';
import { connectDevRustActors } from '../src/network/dev-rust-session.js';

// Mocked adapter lifecycle CONTRACT, not genuine Rust/QUIC browser acceptance.
// Original Rust remains the exclusive actor, HP, stamina and action authority.
test('Main0 Alpha 0.2: lost Rust actor clears stale Combat HUD before a new server identity', async () => {
  const poses = [], layers = [], closeReasons = [];
  let callbacks, inputStopped = 0, binds = 0, inputPackets = 0;
  const client = {
    playerNetId: null,
    transport: { kind: 'webtransport', closed: false },
    sendInput() { inputPackets++; },
    close(reason) { closeReasons.push(reason); this.transport.closed = true; }
  };
  const dom = { addEventListener() {} };
  const session = await connectDevRustActors({
    app: {}, pc: {}, url: 'https://localhost:8443/game',
    sha256: 'ab'.repeat(32), enableCombatInput: true,
    canvas: dom, windowObj: dom, documentObj: dom,
    onCombatPose(pose) { poses.push(pose); },
    createLayer() {
      return {
        reconcile(state, own) {
          layers.push({ ids: [...state.keys()], own });
          return { count: state.size };
        },
        destroy() { layers.push({ destroyed: true }); }
      };
    },
    createCombatInput() {
      return {
        maybeBindActor() { binds++; return Promise.resolve(false); },
        stop() { inputStopped++; },
        receiveTypedAck() {}
      };
    },
    async connect(args) {
      callbacks = args;
      assert.equal(args.webSocketUrl, undefined);
      assert.equal(args.webTransportUrl, 'https://localhost:8443/game');
      return client;
    }
  });
  const actor = (id, hp, stamina, serverTick, action = COMBAT_ACTION.idle) => ({
    netId: id, x: 4110, y: 4160, hp, stamina, guard: 100,
    serverTick, action
  });
  const first = new Map([[5, actor(5, 100, 80, 12)]]);
  callbacks.onSnapshot({ serverTick: 12 }, first);
  assert.equal(poses.at(-1), null, 'snapshot alone cannot establish local identity');
  assert.equal(layers.at(-1).own, null);

  // Simulate an ACK from the ORIGINAL client and a matching Rust snapshot.
  client.playerNetId = 5;
  callbacks.onProcessedAck({ playerNetId: 5 });
  callbacks.onReliableSnapshot({ serverTick: 13 }, first);
  assert.equal(poses.at(-1).netId, 5);
  assert.equal(poses.at(-1).hp, 100);

  // Authoritative removal must not retain old HP, stamina or recovery.
  callbacks.onReliableSnapshot({ serverTick: 14 }, new Map());
  assert.equal(poses.at(-1), null);
  assert.deepEqual(layers.at(-1).ids, []);

  // Fresh original server identity is NOT locally inferred resurrection.
  client.playerNetId = 6;
  callbacks.onProcessedAck({ playerNetId: 6 });
  callbacks.onSnapshot({ serverTick: 15 }, new Map([[
    6, actor(6, 42, 31, 15, COMBAT_ACTION.jumpAttackRecovery)
  ]]));
  assert.equal(poses.at(-1).netId, 6);
  assert.equal(poses.at(-1).hp, 42);
  assert.equal(poses.at(-1).stamina, 31);
  assert.equal(poses.at(-1).recoveryCue, 'jump-attack-recovery');
  assert.equal(inputPackets, 0, 'adapter creates no fake neutral input');
  assert.ok(binds >= 4, 'all authoritative snapshot changes reach the input owner');

  const previousPoseCount = poses.length;
  session.close();
  assert.equal(inputStopped, 1);
  assert.deepEqual(closeReasons, ['PlayCanvas original Rust Combat client closed']);
  callbacks.onSnapshot({ serverTick: 16 }, first);
  assert.equal(poses.length, previousPoseCount, 'stale callbacks cannot revive HUD');
  assert.deepEqual(layers.at(-1), { destroyed: true });
});
