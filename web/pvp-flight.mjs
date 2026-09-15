import { NETWORK } from "../src/network/constants.mjs";
import { connectAuthoritativeClient, parseSha256Hex } from "./authoritative-client.mjs";

const params = new URLSearchParams(location.search);
const server = params.get("server");
const cert = params.get("cert");
const durationMs = clamp(Number(params.get("duration") ?? 7000), 3000, 12000);
const scenario = params.get("scenario") ?? "damage";
if (!new Set(["damage", "parry", "dodge"]).has(scenario)) throw new Error(`unsupported PvP scenario: ${scenario}`);
const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d", { alpha: false });
const status = document.querySelector("#status");

window.__MYASO_PVP_RESULT__ = null;
window.__MYASO_PVP_ERROR__ = null;
if (!server) fail(new Error("PvP flight requires ?server=https://host:port/game"));

let client = null;
let clientTick = 1;
let sentInputs = 0;
let snapshots = 0;
let acknowledgements = 0;
let maxAuthoritativeEntities = 0;
let peerNetId = null;
let peerSeenAt = null;
let firstDamageAt = null;
let successAt = null;
let minOwnHp = 100;
let minPeerHp = 100;
let ownDamageTransitions = 0;
let peerDamageTransitions = 0;
let previousOwnHp = 100;
let previousPeerHp = 100;
let minOwnGuard = 100;
let minPeerGuard = 100;
let ownBlockSeen = false;
let peerBlockSeen = false;
let ownStunnedSeen = false;
let peerStunnedSeen = false;
let firstParryAt = null;
let parryWindupSeenAt = null;
let parryBlockArmed = false;
let parryReactionMs = null;
let ownDodgeSeen = false;
let peerDodgeSeen = false;
let dodgeWindupSeenAt = null;
let dodgeTriggered = false;
let dodgeReactionMs = null;
let dodgeOverlapSeen = false;
let dodgeOverlapDistance = null;
let dodgeOverlapArcDelta = null;
let firstDodgeEvadeAt = null;
let lastFrameAt = 0;
let frameCount = 0;
const frameDeltas = [];
let inputTimer = null;
let animationFrame = 0;
let finished = false;
const startedAt = performance.now();

try {
  const webTransportOptions = cert
    ? { serverCertificateHashes: [{ algorithm: "sha-256", value: parseSha256Hex(cert) }] }
    : undefined;
  client = await connectAuthoritativeClient({
    webTransportUrl: server,
    webTransportOptions,
    onProtocolError(error) { fail(error); },
    onSnapshot(_result, state) {
      snapshots += 1;
      observeState(state);
    },
    onReliableSnapshot(_result, state) {
      observeState(state);
    },
    onAck() {
      acknowledgements += 1;
      observeState(client.state);
    },
  });
  status.textContent = "connected; waiting for opponent";
  inputTimer = setInterval(sendCombatInput, 1000 / NETWORK.inputSendHz);
  animationFrame = requestAnimationFrame(render);
  setTimeout(() => finish(), durationMs);
} catch (error) {
  fail(error);
}
function observeState(state) {
  maxAuthoritativeEntities = Math.max(maxAuthoritativeEntities, state.size);
  const ownId = client?.playerNetId;
  if (!ownId) return;
  const own = state.get(ownId);
  const peer = [...state.values()].find((entity) => entity.netId !== ownId);
  if (!own || !peer) return;

  if (peerNetId === null) {
    peerNetId = peer.netId;
    peerSeenAt = performance.now();
    previousOwnHp = own.hp;
    previousPeerHp = peer.hp;
    status.textContent = `combat: #${ownId} vs #${peerNetId}`;
  }

  if (own.hp < previousOwnHp) ownDamageTransitions += 1;
  if (peer.hp < previousPeerHp) peerDamageTransitions += 1;
  previousOwnHp = own.hp;
  previousPeerHp = peer.hp;
  minOwnHp = Math.min(minOwnHp, own.hp);
  minPeerHp = Math.min(minPeerHp, peer.hp);
  minOwnGuard = Math.min(minOwnGuard, own.guard);
  minPeerGuard = Math.min(minPeerGuard, peer.guard);
  ownBlockSeen ||= own.action === 6;
  peerBlockSeen ||= peer.action === 6;
  ownStunnedSeen ||= own.action === 7;
  peerStunnedSeen ||= peer.action === 7;
  ownDodgeSeen ||= own.action === 4;
  peerDodgeSeen ||= peer.action === 4;

  if (firstDamageAt === null && (minOwnHp < 100 || minPeerHp < 100)) {
    firstDamageAt = performance.now();
  }
  const attackerIsOwn = ownId < peer.netId;
  const attacker = attackerIsOwn ? own : peer;
  const defender = attackerIsOwn ? peer : own;
  const attackerStunned = attackerIsOwn ? ownStunnedSeen : peerStunnedSeen;
  const defenderBlockSeen = attackerIsOwn ? peerBlockSeen : ownBlockSeen;
  const defenderHp = attackerIsOwn ? minPeerHp : minOwnHp;
  const defenderGuard = attackerIsOwn ? minPeerGuard : minOwnGuard;
  if (firstParryAt === null && attackerStunned && defenderBlockSeen && defenderHp === 100 && defenderGuard === 100) {
    firstParryAt = performance.now();
  }
  if (scenario === "dodge" && attacker.action === 2 && defender.action === 4) {
    const dx = defender.x - attacker.x;
    const dy = defender.y - attacker.y;
    const distance = Math.hypot(dx, dy);
    const arcDelta = Math.abs(normalizeAngle(Math.atan2(dy, dx) - attacker.facing));
    if (distance <= 94 && arcDelta <= Math.PI * 0.39 && defender.hp === 100) {
      dodgeOverlapSeen = true;
      dodgeOverlapDistance = distance;
      dodgeOverlapArcDelta = arcDelta;
      if (firstDodgeEvadeAt === null) firstDodgeEvadeAt = performance.now();
    }
  }
  const scenarioSucceeded = scenario === "parry"
    ? firstParryAt !== null
    : scenario === "dodge"
      ? firstDodgeEvadeAt !== null
      : minOwnHp < 100 && minPeerHp < 100;
  if (successAt === null && scenarioSucceeded) successAt = performance.now();
  if (successAt !== null && performance.now() - successAt >= 500) finish();
}

function sendCombatInput() {
  if (finished || !client) return;
  const ownId = client.playerNetId;
  const own = ownId ? client.state.get(ownId) : null;
  const peer = ownId ? [...client.state.values()].find((entity) => entity.netId !== ownId) : null;
  let moveX = 0;
  let moveY = 0;
  let facing = own?.facing ?? 0;
  let attack = false;
  let dodge = false;
  let block = false;

  if (own && peer) {
    const dx = peer.x - own.x;
    const dy = peer.y - own.y;
    const distance = Math.hypot(dx, dy);
    facing = Math.atan2(dy, dx);

    if (scenario === "parry" || scenario === "dodge") {
      const isAttacker = ownId < peer.netId;
      if (distance > 68 && distance > 0.001) {
        moveX = dx / distance;
        moveY = dy / distance;
      }
      if (isAttacker) {
        attack = distance <= 74 && own.action === 0 && sentInputs % 24 === 0;
      } else if (scenario === "parry") {
        if (peer.action === 1) {
          if (parryWindupSeenAt === null) parryWindupSeenAt = performance.now();
          if (!parryBlockArmed && performance.now() - parryWindupSeenAt >= 35) {
            parryBlockArmed = true;
            parryReactionMs = performance.now() - parryWindupSeenAt;
          }
        }
        block = parryBlockArmed && (peer.action === 1 || peer.action === 2);
        if (![1, 2].includes(peer.action)) {
          parryWindupSeenAt = null;
          parryBlockArmed = false;
        }
      } else {
        if (peer.action === 1) {
          if (dodgeWindupSeenAt === null) dodgeWindupSeenAt = performance.now();
          if (!dodgeTriggered && performance.now() - dodgeWindupSeenAt >= 35) {
            dodge = true;
            dodgeTriggered = true;
            dodgeReactionMs = performance.now() - dodgeWindupSeenAt;
          }
        }
        if (![1, 2].includes(peer.action)) {
          dodgeWindupSeenAt = null;
          dodgeTriggered = false;
        }
      }
    } else {
      if (distance > 68 && distance > 0.001) {
        moveX = dx / distance;
        moveY = dy / distance;
      }
      attack = distance <= 92 && sentInputs % 30 === 0;
    }
  }

  client.sendInput({
    tick: clientTick,
    moveX,
    moveY,
    facing,
    attack,
    dodge,
    block,
  });
  clientTick = (clientTick + 1) >>> 0;
  sentInputs += 1;
}

function render(now) {
  if (finished) return;
  if (lastFrameAt) frameDeltas.push(now - lastFrameAt);
  lastFrameAt = now;
  frameCount += 1;
  ctx.fillStyle = "#18150f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ownId = client?.playerNetId;
  const own = ownId ? client.state.get(ownId) : null;
  const cameraX = own ? own.x - canvas.width / 2 : 0;
  const cameraY = own ? own.y - canvas.height / 2 : 0;
  for (const entity of client?.state.values() ?? []) {
    const x = entity.x - cameraX;
    const y = entity.y - cameraY;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(entity.facing ?? 0);
    ctx.fillStyle = entity.netId === ownId ? "#e2d5b4" : "#b96350";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c8b684";
    ctx.fillRect(12, -2, 26, 4);
    ctx.restore();
  }

  animationFrame = requestAnimationFrame(render);
}

function finish() {
  if (finished) return;
  finished = true;
  if (inputTimer !== null) clearInterval(inputTimer);
  if (animationFrame) cancelAnimationFrame(animationFrame);

  const ownId = client?.playerNetId ?? null;
  const sortedFrames = [...frameDeltas].sort((a, b) => a - b);
  const frameP95 = percentile(sortedFrames, 0.95);
  const isAttacker = Boolean(ownId && peerNetId && ownId < peerNetId);
  const attackerStunnedSeen = isAttacker ? ownStunnedSeen : peerStunnedSeen;
  const defenderBlockSeen = isAttacker ? peerBlockSeen : ownBlockSeen;
  const defenderDodgeSeen = isAttacker ? peerDodgeSeen : ownDodgeSeen;
  const minDefenderHp = isAttacker ? minPeerHp : minOwnHp;
  const minDefenderGuard = isAttacker ? minPeerGuard : minOwnGuard;
  const commonOk = Boolean(
    ownId && peerNetId && ownId !== peerNetId
    && maxAuthoritativeEntities >= 2
    && snapshots >= 10 && acknowledgements >= 10 && sentInputs >= 20
    && Number.isFinite(frameP95) && frameP95 < 25
  );
  const damageOk = minOwnHp < 100 && minPeerHp < 100
    && ownDamageTransitions > 0 && peerDamageTransitions > 0;
  const parryOk = firstParryAt !== null
    && attackerStunnedSeen && defenderBlockSeen
    && minDefenderHp === 100 && minDefenderGuard === 100;
  const dodgeOk = firstDodgeEvadeAt !== null
    && defenderDodgeSeen && dodgeOverlapSeen
    && minDefenderHp === 100 && minDefenderGuard === 100
    && !defenderBlockSeen && !attackerStunnedSeen;
  const scenarioOk = scenario === "parry" ? parryOk : scenario === "dodge" ? dodgeOk : damageOk;
  const result = {
    ok: commonOk && scenarioOk,
    scenario,
    role: isAttacker ? "attacker" : "defender",
    playerNetId: ownId,
    peerNetId,
    snapshots,
    acknowledgements,
    sentInputs,
    frames: frameCount,
    frameP95: round(frameP95),
    maxAuthoritativeEntities,
    minOwnHp,
    minPeerHp,
    minOwnGuard,
    minPeerGuard,
    ownDamageTransitions,
    peerDamageTransitions,
    ownBlockSeen,
    peerBlockSeen,
    ownStunnedSeen,
    peerStunnedSeen,
    attackerStunnedSeen,
    defenderBlockSeen,
    defenderDodgeSeen,
    dodgeOverlapSeen,
    dodgeOverlapDistance: round(dodgeOverlapDistance),
    dodgeOverlapArcDelta: round(dodgeOverlapArcDelta),
    minDefenderHp,
    minDefenderGuard,
    peerSeenMs: peerSeenAt === null ? null : round(peerSeenAt - startedAt),
    firstDamageMs: firstDamageAt === null ? null : round(firstDamageAt - startedAt),
    firstParryMs: firstParryAt === null ? null : round(firstParryAt - startedAt),
    parryReactionMs: round(parryReactionMs),
    firstDodgeEvadeMs: firstDodgeEvadeAt === null ? null : round(firstDodgeEvadeAt - startedAt),
    dodgeReactionMs: round(dodgeReactionMs),
    elapsedMs: round(performance.now() - startedAt),
  };
  window.__MYASO_PVP_RESULT__ = result;
  status.textContent = result.ok
    ? (scenario === "parry"
      ? "authoritative PvP parry verified"
      : scenario === "dodge"
        ? "authoritative PvP dodge verified"
        : "authoritative PvP damage verified")
    : `PvP ${scenario} flight incomplete`;
  client?.close(`PvP ${scenario} flight complete`);
}

function fail(error) {
  if (finished) return;
  finished = true;
  if (inputTimer !== null) clearInterval(inputTimer);
  if (animationFrame) cancelAnimationFrame(animationFrame);
  window.__MYASO_PVP_ERROR__ = String(error?.stack ?? error);
  status.textContent = "failed";
  client?.close("PvP flight failed");
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(value) {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
}
