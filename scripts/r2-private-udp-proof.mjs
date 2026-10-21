// P0 First Playable: bounded, NON-production private UDP receive-and-ACK proof.
// This is a read-only network reachability diagnostic: it never changes routes,
// WireGuard, firewall rules or remote services. Production hosts are forbidden.
import dgram from "node:dgram";
import {randomBytes} from "node:crypto";
import {isIP} from "node:net";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

const PING = "MYASO_R2_V1_PING:";
const PONG = "MYASO_R2_V1_PONG:";
const TOKEN = /^[0-9a-f]{32}$/;
const PORT_MIN = 1024;
const LIFETIME_MS = 9500;

export function privateIPv4(value) {
  if (typeof value !== "string" || isIP(value) !== 4) return false;
  const p = value.split(".").map(Number);
  return p[0] === 10 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168);
}

export function config(env) {
  if (env.MYASO_R2_PRIVATE_PROBE_ONLY !== "1" ||
      env.MYASO_R2_STAGING_OWNER_ATTESTED !== "YES") {
    throw new Error("R2 private UDP probe requires an isolated owner-approved staging test");
  }
  const bind = env.MYASO_R2_UDP_BIND;
  const peer = env.MYASO_R2_UDP_PEER;
  if (!privateIPv4(bind) || !privateIPv4(peer) || bind === peer) {
    throw new Error("R2 UDP bind and peer must be distinct private IPv4 addresses");
  }
  const port = Number(env.MYASO_R2_UDP_PORT);
  if (!Number.isSafeInteger(port) || port < PORT_MIN || port > 65535 ||
      String(port) !== env.MYASO_R2_UDP_PORT) {
    throw new Error("R2 UDP port must be an explicit unprivileged integer");
  }
  return Object.freeze({bind, peer, port});
}

export function encodePing(token) {
  if (typeof token !== "string" || !TOKEN.test(token)) throw new TypeError("invalid probe token");
  return Buffer.from(PING + token, "ascii");
}
export function decodePing(bytes) {
  const value = Buffer.isBuffer(bytes) && bytes.length === PING.length + 32
    ? bytes.toString("ascii") : "";
  const token = value.startsWith(PING) ? value.slice(PING.length) : "";
  return TOKEN.test(token) ? token : null;
}
export function encodePong(token) {
  if (typeof token !== "string" || !TOKEN.test(token)) throw new TypeError("invalid probe token");
  return Buffer.from(PONG + token, "ascii");
}
export function decodePong(bytes) {
  const value = Buffer.isBuffer(bytes) && bytes.length === PONG.length + 32
    ? bytes.toString("ascii") : "";
  const token = value.startsWith(PONG) ? value.slice(PONG.length) : "";
  return TOKEN.test(token) ? token : null;
}

function bindSocket(socket, address, port) {
  return new Promise((accept, reject) => {
    const fail = error => { socket.off("listening", ready); reject(error); };
    const ready = () => { socket.off("error", fail); accept(); };
    socket.once("error", fail);
    socket.once("listening", ready);
    socket.bind(port, address);
  });
}

export async function run(mode, options, io = console) {
  if (mode !== "listen" && mode !== "probe") throw new TypeError("expected listen or probe mode");
  const socket = dgram.createSocket("udp4");
  let expired = false;
  const evidence = {kind:"MYASO_R2_PRIVATE_UDP_V1", mode, local: options.bind,
    peer:options.peer, port:options.port, packetsSent:0, packetsReceived:0,
    acknowledgements:0, routeProven:false};
  try {
    await bindSocket(socket, options.bind, mode === "listen" ? options.port : 0);
    const token = mode === "probe" ? randomBytes(16).toString("hex") : null;
    const begin = process.hrtime.bigint();
    const result = await new Promise((accept, reject) => {
      const timer = setTimeout(() => {expired=true; accept(false);}, LIFETIME_MS);
      const done = good => {expired=true; clearTimeout(timer); accept(good);};
      socket.on("error", error => { clearTimeout(timer); reject(error); });
      socket.on("message", (bytes, remote) => {
        if (remote.address !== options.peer) return;
        if (mode === "listen") {
          const incomingToken = decodePing(bytes);
          if (!incomingToken || remote.port < 1) return;
          evidence.packetsReceived++;
          socket.send(encodePong(incomingToken), remote.port, remote.address, error => {
            if (error) {clearTimeout(timer); reject(error); return;}
            evidence.packetsSent++;
            evidence.acknowledgements++;
            done(true);
          });
        } else if (remote.port === options.port && decodePong(bytes) === token) {
          evidence.packetsReceived++;
          evidence.acknowledgements++;
          evidence.roundTripMs = Number(process.hrtime.bigint() - begin) / 1e6;
          evidence.routeProven = true;
          done(true);
        }
      });
      if (mode === "probe") {
        const request = encodePing(token);
        const schedule = async () => {
          for (let i=0; i<3 && !expired; i++) {
            socket.send(request, options.port, options.peer, error => {
              if (error) io.error("MYASO_R2_PRIVATE_UDP_SEND_ERROR=" + error.code);
              else evidence.packetsSent++;
            });
            await new Promise(ok => setTimeout(ok, 850));
          }
        };
        void schedule().catch(reject);
      }
    });
    if (mode === "listen") evidence.oneWayReceiveConfirmed = result;
    evidence.result = result ? (mode === "listen" ? "PING_RECEIVED_ACK_SENT" : "ACK_RECEIVED") : "NO_VERIFIED_ACK";
    io.log("MYASO_R2_PRIVATE_UDP_EVIDENCE=" + JSON.stringify(evidence));
    return evidence;
  } finally {
    socket.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mode = process.argv[2]?.replace(/^--/, "");
    const results = await run(mode, config(process.env));
    if (results.result === "NO_VERIFIED_ACK") process.exitCode = 2;
  } catch (error) {
    console.error("MYASO_R2_PRIVATE_UDP_BLOCKED=" + error.message);
    process.exitCode = 1;
  }
}
