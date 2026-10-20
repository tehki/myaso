// LW-1 loopback NPC pilot on the existing reliable stream; never on combat datagrams.
// These packet types are separate from the frozen v1 input/snapshot/kill-event payloads.
export const NPC_WIRE = Object.freeze({
  request: 5, response: 6, roster: 7, state: 8, supplies: 9, obstacles: 10, worksites: 11, maxTextBytes: 240,
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

const SUPPLY_EVENT_ACTOR = Object.freeze({ 1: 5, 2: 5, 3: 4, 4: 4, 5: 2 });

export function decodeNpcSupplies(bytes) {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (payload.length !== 22 || payload[0] !== 1 || payload[1] !== NPC_WIRE.supplies
      || payload[2] !== 0 || payload[3] !== 0) {
    throw new TypeError("invalid NPC supply packet");
  }
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const tick = view.getUint32(4, true);
  const sequence = view.getUint32(8, true);
  const stocks = Array.from(payload.subarray(12, 20));
  const [wellWater, tomasWater, yardWater, depotFood, elaraFood, stallFood, forgeIron, forgeNails] = stocks;
  if (wellWater + tomasWater + yardWater !== 8
    || depotFood + elaraFood + stallFood !== 8
    || forgeIron + forgeNails !== 6
    || (sequence === 0 && (payload[20] !== 0 || payload[21] !== 0))
    || (sequence !== 0 && SUPPLY_EVENT_ACTOR[payload[21]] !== payload[20])) {
    throw new TypeError("NPC supplies violate conservation or event provenance");
  }
  return Object.freeze({
    tick, sequence,
    stocks: Object.freeze({
      wellWater, tomasWater, yardWater, depotFood, elaraFood, stallFood, forgeIron, forgeNails,
    }),
    lastActor: payload[20],
    lastOperation: payload[21],
  });
}

export function decodeNpcObstacles(bytes) {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (payload.length < 4 || payload[0] !== 1 || payload[1] !== NPC_WIRE.obstacles
      || payload[2] !== 3 || payload[3] !== 0 || payload.length !== 4 + payload[2] * 8) {
    throw new TypeError("invalid pilot NPC obstacle geometry");
  }
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const boxes = [];
  for (let i = 0; i < payload[2]; i++) {
    const offset = 4 + i * 8;
    const [x, y, width, height] = [0, 2, 4, 6].map((relative) => view.getUint16(offset + relative, true));
    if (width === 0 || height === 0 || width > 100 || height > 100
      || x < 60 || y < 30 || x + width > 460 || y + height > 320) {
      throw new TypeError("invalid pilot NPC obstacle bounds");
    }
    boxes.push(Object.freeze({ x, y, width, height }));
  }
  return Object.freeze(boxes);
}


// LW-1K: immutable server-owned loopback worksite anchors. Not loot or
// gameplay collision. Authoritative server uses the same fixed site IDs.
const PILOT_SITES = Object.freeze([
  [1, 5, 340, 255, "Well"],
  [2, 5, 270, 220, "Work yard"],
  [3, 4, 395, 150, "Supply depot"],
  [4, 4, 315, 110, "Market"],
  [5, 2, 210, 65, "Forge"],
]);

export function decodeNpcWorksites(bytes) {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (payload.length !== 34 || payload[0] !== 1 || payload[1] !== NPC_WIRE.worksites
      || payload[2] !== PILOT_SITES.length || payload[3] !== 0) {
    throw new TypeError("invalid NPC pilot worksite header");
  }
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const sites = PILOT_SITES.map(([id, actor, x, y, name], i) => {
    const offset = 4 + i * 6;
    if (payload[offset] !== id || payload[offset + 1] !== actor
      || view.getUint16(offset + 2, true) !== x
      || view.getUint16(offset + 4, true) !== y) {
      throw new TypeError("invalid NPC pilot worksite registry");
    }
    return Object.freeze({ id, actor, x, y, name });
  });
  return Object.freeze(sites);
}
