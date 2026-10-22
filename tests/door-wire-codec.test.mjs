import assert from "node:assert/strict";
import test from "node:test";
import {
  DOOR_PORTAL, DOOR_ZONE, DOOR_WIRE,
  encodeDoorRequest, decodeDoorRequest, encodeZoneEntered, decodeZoneEntered,
} from "../src/network/door-wire-codec.mjs";
import { readFileSync } from "node:fs";

const requestBytes = [1, 5, 1, 1, 4, 3, 2, 1, 8, 7, 6, 5];
const acceptedBytes = [1, 6, 1, 2, 4, 3, 2, 1, 13, 12, 11, 10,
  2, 2, 1, 1, 24, 6, 128, 7, 5, 4, 3, 2];

test("door request byte fixture matches native Rust and omits source/destination/fighter", () => {
  const request = { portalId: DOOR_PORTAL.RED_LION_ENTER,
    requestNonce: 0x01020304, expectedEpoch: 0x05060708 };
  const actual = encodeDoorRequest(request);
  assert.deepEqual(Array.from(new Uint8Array(actual)), requestBytes);
  assert.deepEqual(decodeDoorRequest(actual), request);
  assert.deepEqual(decodeDoorRequest(new Uint8Array(actual)), request);
  assert.equal(DOOR_WIRE.requestBytes, 12);
  assert.equal(DOOR_WIRE.manifestVersion, 1);
});

test("zone ACK byte fixture matches Rust and validates authoritative zone/quantization", () => {
  const accepted = { zoneId: DOOR_ZONE.RED_LION_INN,
    requestNonce: 0x01020304, fighterId: 0x0a0b0c0d,
    serverTick: 0x01010202, spawnX: 390, spawnY: 480, zoneEpoch: 0x02030405 };
  const actual = encodeZoneEntered(accepted);
  assert.deepEqual(Array.from(new Uint8Array(actual)), acceptedBytes);
  assert.deepEqual(decodeZoneEntered(actual), accepted);
  assert.deepEqual(decodeZoneEntered(new Uint8Array(actual)), accepted);
});

test("malformed requests fail closed, including extra trailing bytes", () => {
  assert.throws(() => encodeDoorRequest({ portalId: 99, requestNonce: 1, expectedEpoch: 0 }), /portal/);
  assert.throws(() => encodeDoorRequest({ portalId: 1, requestNonce: -1, expectedEpoch: 0 }), /uint32/);
  assert.throws(() => encodeDoorRequest({ portalId: 1, requestNonce: 1, expectedEpoch: Number.NaN }), /uint32/);
  for (const [at, value] of [[0, 2], [1, 4], [2, 9], [3, 0]]) {
    const packet = Uint8Array.from(requestBytes);
    packet[at] = value;
    assert.throws(() => decodeDoorRequest(packet));
  }
  assert.throws(() => decodeDoorRequest(requestBytes), /typed array/);
  assert.throws(() => decodeDoorRequest(new Uint8Array(11)), /length/);
  assert.throws(() => decodeDoorRequest(new Uint8Array([...requestBytes, 0])), /length/);
});

test("ACK cannot have forged zone, missing fighter, epoch zero, or impossible spawn", () => {
  for (const [at, value] of [[0, 2], [1, 1], [2, 0], [3, 77]]) {
    const packet = Uint8Array.from(acceptedBytes);
    packet[at] = value;
    assert.throws(() => decodeZoneEntered(packet));
  }
  const noId = Uint8Array.from(acceptedBytes);
  noId.fill(0, 8, 12);
  assert.throws(() => decodeZoneEntered(noId), /fighterId/);
  const noEpoch = Uint8Array.from(acceptedBytes);
  noEpoch.fill(0, 20, 24);
  assert.throws(() => decodeZoneEntered(noEpoch), /zoneEpoch/);
  const impossible = Uint8Array.from(acceptedBytes);
  impossible[16] = 255;
  impossible[17] = 255;
  assert.throws(() => decodeZoneEntered(impossible), /position/);
  assert.throws(() => encodeZoneEntered({ zoneId: DOOR_ZONE.RED_LION_INN,
    requestNonce: 1, fighterId: 1, serverTick: 1, spawnX: Number.NaN, spawnY: 480, zoneEpoch: 1 }), /position/);
  assert.throws(() => decodeZoneEntered(new Uint8Array(23)), /length/);
});

test("door wire is disconnected from live main server and browser prediction", () => {
  const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const server = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  assert.doesNotMatch(game, /door-wire-codec|encodeDoorRequest|decodeZoneEntered/);
  assert.doesNotMatch(server, /door_wire|decode_door_request|encode_zone_entered/);
  const zone = readFileSync(new URL("../server/src/zone.rs", import.meta.url), "utf8");
  assert.match(zone, /moonvale-overworld/);
  assert.match(zone, /red-lion-inn/);
});
