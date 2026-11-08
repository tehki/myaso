// Nonrelease QA: an original QUIC gesture may receive more than one ACK
// after an authenticated same-lease retransmission. A second ACK is NOT a
// second gameplay terminal. Never hide a second first-settled gesture, RELEASE,
// wrong gesture identity, or foreign/malformed status.
import assert from "node:assert/strict";

export function requireUniqueSpaceCancel(receipts) {
  assert.ok(Array.isArray(receipts), "Space-CANCEL requires genuine ACK observations");
  const source0 = receipts.filter(r => r?.source === 0);
  const presses = source0.filter(r => r.action === 1 && r.status === 1 && r.alreadySettled === false);
  assert.equal(presses.length, 1, "one accepted original physical LMB PRESS");
  const press = presses[0];
  const terminals = source0.filter(r => r.action === 3 || r.action === 4);
  assert.ok(terminals.length > 0, "genuine Space-CANCEL terminal must be observed");
  assert.equal(terminals.some(r => r.action === 3), false,
    "Space after LMB must never generate a typed RELEASE, including retries");
  const original = terminals.filter(r => r.alreadySettled === false);
  assert.deepEqual(original.map(r => r.action), [4],
    "one first-settled authenticated CANCEL, never a second terminal");
  const cancel = original[0];
  assert.ok(cancel.status === 1 || cancel.status === 2,
    "original CANCEL requires accepted or server-duplicate status");
  assert.ok(terminals.some(r => r.status === 1),
    "a genuine accepted CANCEL receipt must be observed");
  assert.equal(cancel.gestureId, press.gestureId,
    "CANCEL must retain authenticated physical LMB gesture identity");
  assert.notEqual(cancel.sequence, press.sequence,
    "CANCEL must have its own transport sequence");
  for (const receipt of terminals.filter(r => r.alreadySettled === true)) {
    assert.equal(receipt.gestureId, cancel.gestureId,
      "settled CANCEL retry must retain the original gesture");
    assert.equal(receipt.sequence, cancel.sequence,
      "settled CANCEL retry must retain the original sequence");
    assert.ok(receipt.status === 1 || receipt.status === 2,
      "settled CANCEL retries require legal authenticated ACK status");
  }
  for (const receipt of source0.filter(r => r.action === 1 && r !== press)) {
    assert.equal(receipt.alreadySettled, true,
      "second physical PRESS cannot masquerade as a retried ACK");
    assert.equal(receipt.gestureId, press.gestureId);
    assert.equal(receipt.sequence, press.sequence);
    assert.ok(receipt.status === 1 || receipt.status === 2);
  }
  return { press, cancel, duplicateTerminalAcks: terminals.length - 1 };
}
