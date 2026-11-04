import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../../../src/combat/model.mjs';
import { CHAT_UI_LIMITS } from '../../../src/browser/local-chat.mjs';
import { preparePlayCanvasOriginalInput, ORIGINAL_PLAYCANVAS_INPUT_CONTRACT as controls }
  from '../src/input/original-input-contract.mjs';

test('PlayCanvas preparation is completely inert even with a connected-looking QUIC client', () => {
  const events = [];
  const canvas = { addEventListener(type) { events.push(type); } };
  const connectedLookingClient = {
    playerNetId: 17, transport: { kind: 'webtransport', experimentalGestureState: 'granted' },
    sendInput() { throw new Error('MUST NOT DISPATCH'); },
  };
  const before = { ...connectedLookingClient };
  const prepared = preparePlayCanvasOriginalInput({ canvas, session: connectedLookingClient });
  assert.equal(prepared.state, 'HOLD_CORE8_GENUINE_SESSIONS');
  assert.equal(prepared.active, false);
  assert.equal(prepared.contract, controls);
  assert.deepEqual(events, [], 'no pointer, wheel, key, focus, or Chat listener installed');
  assert.equal('attach' in prepared, false);
  assert.equal('activate' in prepared, false);
  assert.equal('sendInput' in prepared, false);
  assert.equal('negotiateInstantLmb' in prepared, false);
  assert.deepEqual(connectedLookingClient, before, 'never touch the Core8 read-only client');
  assert.equal(Object.isFrozen(prepared), true);
});

test('PlayCanvas contract preserves original physical controls without changing source timing', () => {
  assert.deepEqual(controls.movement.keys, ['KeyW', 'KeyA', 'KeyS', 'KeyD']);
  assert.ok(controls.lmb.gestures.includes('RMB-held physical mousedown/mouseup'));
  assert.ok(controls.lmb.gestures.includes('pointercancel'));
  assert.equal(controls.lmb.lightWindupMs, COMBAT.attack.windupMs);
  assert.equal(controls.lmb.heavyReadyMs, COMBAT.heavyAttack.windupMs);
  assert.ok(controls.rmb.gestures.includes('short RMB kick'));
  assert.ok(controls.rmb.gestures.includes('RMB held run'));
  assert.ok(controls.space.gestures.includes('trusted Space keyup'));
  assert.ok(controls.space.gestures.includes('Space+LMB jump attack'));
  assert.equal(controls.space.jumpCost, COMBAT.jump.staminaCost);
  assert.equal(controls.space.jumpAttackAdditionalCost, COMBAT.jumpAttack.staminaCost);
  assert.equal(controls.wheel.parryWindowMs, COMBAT.block.parryWindowMs);
  assert.equal(controls.wheel.shortBlockMs, COMBAT.block.shortBlockMs);
  assert.equal(controls.chatC1.maxUtf8Bytes, CHAT_UI_LIMITS.bytes);
  assert.ok(controls.chatC1.gestures.includes('one Enter send and close'));
  assert.match(controls.session.activation, /^HOLD:/);
  assert.throws(() => preparePlayCanvasOriginalInput({}), /canvas/);
});

test('current PlayCanvas boot exposes HOLD only, no gameplay owner even with rust=1', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /preparePlayCanvasOriginalInput\(\{ canvas \}\)/);
  assert.match(src, /dataset\.playcanvasInputs = 'hold-core8'/);
  assert.doesNotMatch(src, /\.sendInput\(/);
  assert.doesNotMatch(src, /negotiateInstantLmb\(/);
  assert.doesNotMatch(src, /\.activate\(/);
});
