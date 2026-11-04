import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_ACTION } from '../../../src/browser/combat-readability.mjs';
import { projectAuthoritativeCombat } from '../src/combat/authoritative-combat-view.mjs';
import { createAuthoritativeSnapshotView } from '../src/scene/authoritative-snapshot-view.mjs';

const actor = (action, hp = 100, stamina = 100, tick = 500) => ({
  netId: 2, x: 4140, y: 4105, serverTick: tick,
  action, hp, guard: 100, stamina
});

test('PlayCanvas projects only unchanged authoritative Rust HP, stamina and action', () => {
  const heavy = projectAuthoritativeCombat(actor(COMBAT_ACTION.heavyAttackActive, 54, 71));
  assert.deepEqual([heavy.hp, heavy.stamina, heavy.actionName],
    [54, 71, 'heavyAttackActive']);
  assert.equal(heavy.recoveryCue, null);
  const jump = projectAuthoritativeCombat(actor(COMBAT_ACTION.jumpAttackActive, 58, 74));
  assert.deepEqual([jump.hp, jump.stamina, jump.actionName],
    [58, 74, 'jumpAttackActive']);
  assert.equal(Object.isFrozen(heavy), true);
  assert.equal(Object.hasOwn(heavy, 'hitConfirmed'), false,
    'HP differences are not authenticated HIT receipts');
  assert.equal(Object.hasOwn(heavy, 'damage'), false,
    'PlayCanvas cannot manufacture 34/46/42 damage from local arithmetic');
});

test('M140 recovery tell belongs to Rust action 18 only; no local timing window or HIT', () => {
  const ready = projectAuthoritativeCombat(actor(COMBAT_ACTION.jumpAttackWindup));
  const active = projectAuthoritativeCombat(actor(COMBAT_ACTION.jumpAttackActive));
  const recover = projectAuthoritativeCombat(actor(COMBAT_ACTION.jumpAttackRecovery));
  const idle = projectAuthoritativeCombat(actor(COMBAT_ACTION.idle));
  assert.equal(ready.recoveryCue, null);
  assert.equal(active.recoveryCue, null);
  assert.equal(recover.recoveryCue, 'jump-attack-recovery');
  assert.equal(recover.inRecovery, true);
  assert.equal(idle.recoveryCue, null);
  assert.equal(Object.hasOwn(recover, 'punishAccepted'), false);
  assert.equal(Object.hasOwn(recover, 'recoveryDeadlineMs'), false);
});

test('missing and malformed Rust vitals fail closed; no client-created HP/stamina', () => {
  for (const state of [
    { ...actor(COMBAT_ACTION.idle), hp: undefined },
    { ...actor(COMBAT_ACTION.idle), stamina: NaN },
    { ...actor(COMBAT_ACTION.idle), hp: -2 },
    { ...actor(COMBAT_ACTION.idle), action: 99 },
    { ...actor(COMBAT_ACTION.idle), serverTick: -1 },
    { ...actor(COMBAT_ACTION.idle), serverTick: 0x100000000 },
    { ...actor(COMBAT_ACTION.idle), netId: 0 },
  ]) assert.equal(projectAuthoritativeCombat(state), null);
});

test('original snapshot-only updates present recovery, HIT-caused HP and stamina without producing an event', () => {
  const events = [];
  const view = createAuthoritativeSnapshotView({
    create(pose) { events.push(pose); return pose.netId; },
    update(_handle, pose) { events.push(pose); },
    remove() {}
  });
  const data = new Map([[2, actor(COMBAT_ACTION.jumpAttackWindup)]]);
  view.reconcile(data, 2);
  data.set(2, actor(COMBAT_ACTION.jumpAttackRecovery, 100, 74, 512));
  view.reconcile(data, 2);
  data.set(2, actor(COMBAT_ACTION.idle, 66, 77, 545));
  view.reconcile(data, 2);
  assert.equal(events[0].combat.recoveryCue, null);
  assert.equal(events[1].combat.recoveryCue, 'jump-attack-recovery');
  assert.equal(events[2].combat.hp, 66);
  assert.equal(events[2].combat.stamina, 77);
  assert.equal(events[2].combat.recoveryCue, null);
  assert.equal(data.get(2).hp, 66, 'original Rust state is never mutated');
  assert.equal(events.some(e => Object.hasOwn(e.combat, 'hitConfirmed')), false);
  view.clear();
});
