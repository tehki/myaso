// LW-1 loopback NPC pilot on the existing reliable stream; never on combat datagrams.
// These packet types are separate from the frozen v1 input/snapshot/kill-event payloads.
export const NPC_WIRE = Object.freeze({
  request: 5, response: 6, roster: 7, state: 8, maxTextBytes: 240,
});
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function encodeNpcRequest(npcId, text) {
  if (!Number.isInteger(npcId) || npcId < 1 || npcId > 255) throw new TypeError("invalid NPC identifier");
  if (typeof text !== "string" || !text.trim() || /[\x00-\x1f\x7f]/.test(text)) {
    throw new TypeError("NPC message must be nonempty single-line text");
  }
  const utf8 = encoder.encode(text.trim());
  if (utf8.length > NPC_WIRE.maxTextBytes) throw new RangeError("NPC message exceeds 240 UTF-8 bytes");
  const payload = new Uint8Array(6 + utf8.length);
  payload.set([1, NPC_WIRE.request, npcId, 0, utf8.length & 0xff, utf8.length >>> 8]);
  payload.set(utf8, 6);
  return payload;
}

export function decodeNpcResponse(bytes) {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (payload.length < 6 || payload[0] !== 1 || payload[1] !== NPC_WIRE.response) {
    throw new TypeError("invalid NPC response header");
  }
  const length = payload[4] | (payload[5] << 8);
  if (length > 512 || length !== payload.length - 6 || !payload[2] || payload[3] > 1) {
    throw new TypeError("invalid NPC response body");
  }
  return Object.freeze({ id: payload[2], denied: payload[3] === 1, text: decoder.decode(payload.subarray(6)) });
}

export function decodeNpcRoster(bytes) {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (payload.length < 4 || payload.length > 512 || payload[0] !== 1
      || payload[1] !== NPC_WIRE.roster || payload[2] > 5 || payload[3] !== 0) {
    throw new TypeError("invalid NPC roster");
  }
  const roster = [];
  let cursor = 4;
  const seen = new Set();
  const next = () => {
    if (cursor >= payload.length) throw new TypeError("truncated NPC roster");
    return payload[cursor++];
  };
  for (let i = 0; i < payload[2]; i++) {
    const id = next();
    const x = next() | (next() << 8);
    const y = next() | (next() << 8);
    const nameLength = next();
    if (cursor + nameLength > payload.length || nameLength === 0 || nameLength > 40) throw new TypeError("invalid NPC name");
    const name = decoder.decode(payload.subarray(cursor, cursor + nameLength));
    cursor += nameLength;
    const roleLength = next();
    if (cursor + roleLength > payload.length || roleLength === 0 || roleLength > 40 || seen.has(id) || !id) {
      throw new TypeError("invalid NPC occupation or identifier");
    }
    const role = decoder.decode(payload.subarray(cursor, cursor + roleLength));
    cursor += roleLength;
    seen.add(id);
    roster.push(Object.freeze({ id, x, y, name, role }));
  }
  if (cursor !== payload.length) throw new TypeError("unexpected NPC roster suffix");
  return Object.freeze(roster);
}

export function decodeNpcState(bytes) {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (payload.length < 8 || payload[0] !== 1 || payload[1] !== NPC_WIRE.state
      || payload[2] !== 5 || payload[3] !== 0 || payload.length !== 8 + payload[2] * 6) {
    throw new TypeError("invalid NPC state header or length");
  }
  const tick = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(4, true);
  const states = [];
  const ids = new Set();
  for (let i = 0; i < payload[2]; i++) {
    const index = 8 + i * 6;
    const id = payload[index];
    const x = payload[index + 1] | (payload[index + 2] << 8);
    const y = payload[index + 3] | (payload[index + 4] << 8);
    const activity = payload[index + 5];
    if (!id || id > 5 || ids.has(id) || x > 8192 || y > 8192 || activity > 2) {
      throw new TypeError("invalid NPC state value or duplicate NPC identifier");
    }
    ids.add(id);
    states.push(Object.freeze({ id, x, y, activity }));
  }
  return Object.freeze({ tick, states: Object.freeze(states) });
}
