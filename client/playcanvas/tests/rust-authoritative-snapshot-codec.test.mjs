import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quantizeEntity, buildEntityDelta, encodeSnapshot
} from '../../../src/network/snapshot-codec.mjs';
import { applySnapshotPacketInPlace } from '../../../src/browser/snapshot-store.mjs';
import { createAuthoritativeSnapshotView } from '../src/scene/authoritative-snapshot-view.mjs';

test('real original Rust snapshot wire format drives a read-only PlayCanvas actor view', () => {
  const state = new Map();
  const events = [];
  const actorView = createAuthoritativeSnapshotView({
    create(pose) { events.push(['create', pose]); return { netId: pose.netId }; },
    update(handle, pose) { events.push(['update', handle.netId, pose]); },
    remove(handle) { events.push(['remove', handle.netId]); }
  });
  const first = quantizeEntity({
    netId: 42, x: 4110, y: 4160, facing: 1.2,
    hp: 100, guard: 90, stamina: 82, action: 'idle'
  });
  const full = encodeSnapshot({
    sequence: 1, serverTick: 100, full: true,
    records: [buildEntityDelta(first)]
  });
  const fullResult = applySnapshotPacketInPlace(state, full);
  assert.equal(fullResult.full, true);
  assert.equal(fullResult.created, 1);
  assert.equal(state.get(42).netId, 42);
  assert.ok(Math.abs(state.get(42).x - 4110) <= 2);
  assert.deepEqual(actorView.reconcile(state, 42), { count: 1 });
  assert.equal(events[0][1].isOwn, true);
  assert.equal(events[0][1].serverTick, 100);

  const second = quantizeEntity({
    netId: 42, x: 4122, y: 4170, facing: 1.2,
    hp: 92, guard: 87, stamina: 75, action: 'attack_recovery'
  });
  const delta = encodeSnapshot({
    sequence: 2, baselineSequence: 1, serverTick: 101,
    records: [buildEntityDelta(second, first)]
  });
  const result = applySnapshotPacketInPlace(state, delta);
  assert.equal(result.full, false);
  assert.equal(result.updated, 1);
  actorView.reconcile(state, 42);
  assert.equal(events[1][0], 'update');
  assert.equal(events[1][2].action, 3);
  assert.equal(state.get(42).hp, 92);

  // A full Rust snapshot with zero records removes the actor; PlayCanvas
  // must not retain a locally invented position or player entity.
  applySnapshotPacketInPlace(state, encodeSnapshot({
    sequence: 3, serverTick: 102, full: true, records: []
  }));
  actorView.reconcile(state, 42);
  assert.deepEqual(events.at(-1), ['remove', 42]);
  assert.equal(actorView.count, 0);
});
