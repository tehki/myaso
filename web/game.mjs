import { createFrameBudget } from "../src/browser/frame-budget.mjs";
import { installRightButtonGesture } from "../src/browser/right-button-gesture.mjs";
import { createDirectionalDash } from "../src/browser/dash-input.mjs";
import { createLeftButtonCharge } from "../src/browser/left-button-charge.mjs";
import { captureLightAttackMovement } from "../src/browser/light-attack-movement.mjs";
import { createCombatImpactController } from "../src/browser/combat-impact.mjs";
import { createGameAudio, installGameAudioControls, soundForCombatFeedback } from "../src/browser/game-audio.mjs";
import { COMBAT, createFighter, createWorld, stepWorld } from "../src/combat/model.mjs";
import { createSparringAi } from "../src/combat/sparring-ai.mjs";

const canvas = document.querySelector("#arena");
const chargeHud = {
  root: document.querySelector("#heavy-charge-indicator"),
  value: document.querySelector("#heavy-charge-value"),
  fill: document.querySelector("#heavy-charge-fill"),
};
function updateChargeHud() {
  const progress = leftButtonCharge.progress();
  chargeHud.root.hidden = progress <= 0;
  if (progress <= 0) return;
  const percent = Math.min(100, Math.round(progress * 100));
  chargeHud.value.textContent = percent === 100 ? "READY" : `${percent}%`;
  chargeHud.root.dataset.ready = String(percent === 100);
  chargeHud.fill.style.transform = `scaleX(${progress})`;
}

const ctx = canvas.getContext("2d", { alpha: false });
const eventText = document.querySelector("#event-text");
const arenaStage = document.querySelector(".arena-stage");
const hud = {
  playerHp: document.querySelector("#player-hp"),
  playerHpValue: document.querySelector("#player-hp-value"),
  playerGuard: document.querySelector("#player-guard"),
  playerGuardValue: document.querySelector("#player-guard-value"),
  playerStamina: document.querySelector("#player-stamina"),
  playerStaminaValue: document.querySelector("#player-stamina-value"),
  botHp: document.querySelector("#bot-hp"),
  botHpValue: document.querySelector("#bot-hp-value"),
  botGuard: document.querySelector("#bot-guard"),
  botGuardValue: document.querySelector("#bot-guard-value"),
};
const hudCache = {
  playerHp: null,
  playerGuard: null,
  playerStamina: null,
  botHp: null,
  botGuard: null,
  eventText: null,
};

const player = createFighter({ id: "player", x: 270, y: 270, facing: 0 });
const bot = createFighter({ id: "bot", x: 690, y: 270, facing: Math.PI });
const world = createWorld({ width: canvas.width, height: canvas.height, fighters: [player, bot] });

const keys = new Set();
const audio = createGameAudio();
installGameAudioControls(audio);
const dashGesture = createDirectionalDash();
let dashRequested = false;
let dashMove = null;
const mouse = { x: 700, y: 270 };
const playerInputState = {
  moveX: 0, moveY: 0, aimX: mouse.x, aimY: mouse.y,
  attack: false, heavyAttack: false, block: false, dodge: false, dash: false,
  kick: false, run: false, jump: false,
};
const inputs = { player: playerInputState, bot: null };
const sparringAi = createSparringAi();
let attackRequested = false;
let runningAttackRequested = false;
let committedLightMove = null;
let heavyAttackRequested = false;
let rollRequested = false;
let kickRequested = false;
let jumpRequested = false;
let shortBlockUntil = 0;
let middleBlockHeld = false;
const leftButtonCharge = createLeftButtonCharge({
  onLight() {
    attackRequested = true;
    committedLightMove = captureLightAttackMovement(keys);
    if (rightButtonGesture.isRunning() && ["KeyW", "KeyA", "KeyS", "KeyD"].some(code => keys.has(code))) {
      runningAttackRequested = true;
    }
    audio.play("light");
  },
  onHeavy() { heavyAttackRequested = true; audio.play("heavy"); },
});
const rightButtonGesture = installRightButtonGesture(canvas, {
  onKick: () => { kickRequested = true; audio.play("kick"); },
});
let messageUntil = 0;
let animationFrameId = 0;
const fixedStepMs = 1000 / 120;
const frameBudget = createFrameBudget({
  stepMs: fixedStepMs,
  maxFrameDeltaMs: 50,
  maxStepsPerFrame: 6,
});
const arenaLayer = createArenaLayer();
const combatImpact = createCombatImpactController();
let combatFeedbackTimer = 0;

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  updateMouse(event);
  if (event.button === 1) {
    event.preventDefault();
    middleBlockHeld = true;
    return;
  }
  if (event.button === 0) {
    leftButtonCharge.press(event.pointerId, {
      immediate: player.action === "jump" || jumpRequested || keys.has("Space"),
    });
    return;
  }
});
function onLeftPointerUp(event) {
  if (event.button === 1) {
    middleBlockHeld = false;
    return;
  }
  if (event.button !== 0) return;
  updateMouse(event);
  const committed = leftButtonCharge.release(event.pointerId);
  if (committed && !audio.isUnlocked()) {
    // Initialize only after release classification; first-use audio cannot
    // stretch a real short click past the 80ms heavy upgrade window.
    audio.unlock();
    audio.play(committed === "heavy" ? "heavy" : "light");
  }
}
canvas.addEventListener("pointerup", onLeftPointerUp);
// W3C Pointer Events fire pointerdown/up only on transitions between zero
// and any pressed mouse button. With RMB held, additional LMB down/up
// produces mouse events but no pointer events: preserve running attacks.
const CHORDED_LEFT_POINTER_ID = -1;
let chordedLeftDown = false;
canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || !(event.buttons & 2) || leftButtonCharge.isPressed()) return;
  canvas.focus();
  updateMouse(event);
  chordedLeftDown = true;
  leftButtonCharge.press(CHORDED_LEFT_POINTER_ID, {
    immediate: player.action === "jump" || jumpRequested || keys.has("Space"),
  });
});
function onChordedLeftMouseUp(event) {
  if (event.button !== 0 || !chordedLeftDown) return;
  chordedLeftDown = false;
  updateMouse(event);
  leftButtonCharge.release(CHORDED_LEFT_POINTER_ID);
}
canvas.addEventListener("mouseup", onChordedLeftMouseUp);
window.addEventListener("mouseup", onChordedLeftMouseUp);

window.addEventListener("pointerup", onLeftPointerUp);
canvas.addEventListener("pointercancel", (event) => {
  if (event.button === 1) middleBlockHeld = false;
  // Match the active pointerId even when pointercancel reports button=-1.
  leftButtonCharge.cancel(event.pointerId);
});
canvas.addEventListener("lostpointercapture", (event) => {
  if (event.button === 1) middleBlockHeld = false;
  if (Number.isInteger(event.pointerId) && !(event.buttons & 1)) {
    leftButtonCharge.cancel(event.pointerId);
  }
});
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  canvas.focus();
  if (event.deltaY < 0) { rollRequested = true; audio.play("roll"); }
  else if (event.deltaY > 0) { shortBlockUntil = Math.max(shortBlockUntil, world.nowMs + COMBAT.block.shortBlockMs); audio.play("guard"); }
}, { passive: false });
canvas.addEventListener("pointermove", updateMouse);
window.addEventListener("blur", releaseInputs);
canvas.addEventListener("keydown", (event) => {
  const firstAudioGesture = !audio.isUnlocked();
  if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "Space"].includes(event.code)) event.preventDefault();
  if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code) && !keys.has(event.code)) {
    const direction = dashGesture.press(event.code, performance.now(), event.repeat);
    if (direction && player.action === "idle"
      && player.stamina >= COMBAT.dash.staminaCost) {
      dashRequested = true; dashMove = direction;
      audio.play("roll");
    }
  }
  keys.add(event.code);
  if (event.code === "KeyE" && !event.repeat) heavyAttackRequested = true;
  if (event.code === "KeyE" && !event.repeat) audio.play("heavy");
  if (event.code === "Space" && !event.repeat) {
    jumpRequested = true;
    audio.play("jump");
    leftButtonCharge.commitLight();
  }
  // Commit every native key action before one-time AudioContext startup.
  audio.unlock();
  if (firstAudioGesture && !event.repeat && event.code === "KeyE") audio.play("heavy");
  if (firstAudioGesture && !event.repeat && event.code === "Space") audio.play("jump");
});
canvas.addEventListener("keyup", (event) => keys.delete(event.code));
document.addEventListener("visibilitychange", handleVisibilityChange);

function releaseInputs() {
  keys.clear();
  dashGesture.clearTaps();
  dashRequested = false;
  dashMove = null;
  attackRequested = false;
  runningAttackRequested = false;
  committedLightMove = null;
  leftButtonCharge.cancel();
  chordedLeftDown = false;
  heavyAttackRequested = false;
  rollRequested = false;
  kickRequested = false;
  jumpRequested = false;
  shortBlockUntil = 0;
  middleBlockHeld = false;
  rightButtonGesture.cancel();
}

function updateMouse(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
}

function playerInput() {
  playerInputState.moveX = dashRequested && dashMove ? dashMove.x : committedLightMove?.moveX ?? ((keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0));
  playerInputState.moveY = dashRequested && dashMove ? dashMove.y : committedLightMove?.moveY ?? ((keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0));
  playerInputState.aimX = mouse.x;
  playerInputState.aimY = mouse.y;
  const leftChargeHeld = leftButtonCharge.isCharging();
  playerInputState.attack = attackRequested || leftChargeHeld;
  playerInputState.heavyAttack = heavyAttackRequested || leftChargeHeld;
  playerInputState.block = middleBlockHeld || world.nowMs < shortBlockUntil;
  playerInputState.dodge = rollRequested;
  playerInputState.dash = dashRequested;
  playerInputState.kick = kickRequested;
  playerInputState.run = rightButtonGesture.isRunning() || runningAttackRequested;
  playerInputState.jump = jumpRequested;
  if (player.action === "idle" && (playerInputState.moveX || playerInputState.moveY)) {
    audio.play("step", { level: playerInputState.run ? .90 : .55 });
  }
  attackRequested = false;
  runningAttackRequested = false;
  committedLightMove = null;
  heavyAttackRequested = false;
  rollRequested = false;
  kickRequested = false;
  jumpRequested = false;
  dashRequested = false;
  dashMove = null;
  return playerInputState;
}

function botInput() {
  return sparringAi.sample({
    nowMs: world.nowMs,
    self: bot,
    opponent: player,
  });
}

function handleEvents(events) {
  for (const event of events) {
    const cue = ({ hit: "hit", block: "block", parry: "parry", kick: "kick", roll_hit: "hit",
      guard_break: "guardbreak", death: "death" })[event.type];
    if (cue) audio.play(cue);
    const names = { player: "You", bot: "Bot" };
    if (event.type === "hit") {
      say(`${names[event.attackerId]} hit ${names[event.targetId]} for ${event.damage}.`, 560);
      showCombatFeedback(event.targetId === "player" ? "damage-taken" : "hit-confirm");
    }
    if (event.type === "block") {
      say(`${names[event.targetId]} blocked.`, 480);
      showCombatFeedback(event.targetId === "player" ? "guard-pressure" : "block-confirm");
    }
    if (event.type === "parry") {
      say(`${names[event.targetId]} PARRIED ${names[event.attackerId]} — punish now!`, 920);
      showCombatFeedback(event.targetId === "player" ? "parry-success" : "parried");
    }
    if (event.type === "kick") {
      say(`${names[event.attackerId]} shoved ${names[event.targetId]} down.`, 620);
      showCombatFeedback(event.attackerId === "player" ? "kick-confirm" : "shoved");
    }
    if (event.type === "roll_hit") {
      say(`${names[event.attackerId]} rolled through ${names[event.targetId]}.`, 560);
      showCombatFeedback(event.attackerId === "player" ? "roll-impact" : "rolled-over");
    }
    if (event.type === "guard_break") {
      say(`${names[event.targetId]}'s guard broke. Punish!`, 760);
      showCombatFeedback(event.targetId === "player" ? "guard-broken" : "guard-break-confirm");
    }
    if (event.type === "evade") {
      say(`${names[event.targetId]} dodged through the strike.`, 520);
      showCombatFeedback(event.targetId === "player" ? "dodge-success" : "dodge-evaded");
    }
    if (event.type === "death") say(`${names[event.killerId]} wins the exchange.`, 980);
    if (event.type === "respawn") say(`${names[event.fighterId]} re-enters the arena.`, 620);
  }
}

function showCombatFeedback(feedback) {
  if (!feedback || !arenaStage) return;
  combatImpact.trigger(feedback, performance.now());
  if (combatFeedbackTimer) clearTimeout(combatFeedbackTimer);
  delete arenaStage.dataset.combatFeedback;
  void arenaStage.offsetWidth;
  arenaStage.dataset.combatFeedback = feedback;
  const durationMs = feedback === "guard-broken" || feedback === "guard-break-confirm" ? 420
    : feedback === "parry-success" || feedback === "parried" ? 380
      : 320;
  combatFeedbackTimer = window.setTimeout(() => {
    if (arenaStage.dataset.combatFeedback === feedback) delete arenaStage.dataset.combatFeedback;
    combatFeedbackTimer = 0;
  }, durationMs);
}

function say(text, durationMs) {
  setEventText(text);
  messageUntil = world.nowMs + durationMs;
}

function updateHud() {
  setMeter("playerHp", hud.playerHp, hud.playerHpValue, player.hp);
  setMeter("playerGuard", hud.playerGuard, hud.playerGuardValue, player.guard);
  setMeter("playerStamina", hud.playerStamina, hud.playerStaminaValue, player.stamina);
  setMeter("botHp", hud.botHp, hud.botHpValue, bot.hp);
  setMeter("botGuard", hud.botGuard, hud.botGuardValue, bot.guard);
  if (world.nowMs > messageUntil) setEventText(actionHint());
}

function setMeter(cacheKey, bar, label, value) {
  const rounded = Math.max(0, Math.round(value));
  if (hudCache[cacheKey] === rounded) return;
  hudCache[cacheKey] = rounded;
  bar.style.transform = `scaleX(${rounded / 100})`;
  label.textContent = String(rounded);
}

function setEventText(text) {
  if (hudCache.eventText === text) return;
  hudCache.eventText = text;
  eventText.textContent = text;
}

function actionHint() {
  if (player.action === "dead") return "Down. Read the exchange and reset.";
  if (player.action === "attack_windup") return "Committed — your strike is readable now.";
  if (player.action === "attack_left_windup") return "LEFT SWEEP — strafe-selected lane committed.";
  if (player.action === "attack_right_windup") return "RIGHT SWEEP — strafe-selected lane committed.";
  if (player.action === "attack_left_recovery" || player.action === "attack_right_recovery") return "SWEEP RECOVERY — the lane choice is punishable.";
  if (player.action === "running_attack_windup") return "RUNNING STRIKE — momentum committed; opponents can read the lane.";
  if (player.action === "running_attack_active") return "RUNNING STRIKE — carry the lunge through contact.";
  if (player.action === "running_attack_recovery") return "RUNNING RECOVERY — missed lunges are punishable.";
  if (player.action === "heavy_attack_windup") return "Heavy strike winding up after release — enemies can dodge or parry.";
  if (player.action === "attack_recovery") return "Recovery — this is where careless attacks get punished.";
  if (player.action === "heavy_attack_recovery") return "Heavy recovery — you are very punishable now.";
  if (player.action === "feint_recovery") return "FEINT — attack cancelled; short recovery before you can act again.";
  if (player.action === "kick_windup" || player.action === "kick_active") return "SHOVE — unblocked contact knocks them down.";
  if (player.action === "jump") return "AIRBORNE — LMB now for a jumping attack.";
  if (player.action.startsWith("jump_attack")) return "JUMP ATTACK — committed aerial pressure.";
  if (player.action === "block" && player.actionElapsedMs <= COMBAT.block.parryWindowMs) return "PARRY — punish window opened.";
  if (player.action === "block") return "Short block — wheel back again to re-time the parry.";
  if (player.action === "dodge") return "ROLL — i-frames plus collision knockdown.";
  if (player.action === "knockdown") return "KNOCKED DOWN — short recovery before control returns.";
  if (rightButtonGesture.isRunning()) return "RUNNING — stamina drains while sprinting.";
  if (leftButtonCharge.progress() > 0) return "CHARGING HEAVY — hold until READY, then release to strike.";
  return "Release LMB early: light · hold to READY and release: heavy · hold RMB and tap LMB: running strike.";
}

function render(impact = combatImpact.sample(performance.now())) {
  ctx.save();
  ctx.translate(impact.shakeX, impact.shakeY);
  ctx.drawImage(arenaLayer, 0, 0);
  drawFighter(player, "#e2d5b4", "#51452d");
  drawFighter(bot, "#b96350", "#47251f");
  ctx.restore();
  drawImpactBurst(impact);
}

function drawImpactBurst(impact) {
  if (!impact?.active || impact.rays <= 0) return;
  const remoteOwned = impact.feedback === "hit-confirm"
    || impact.feedback === "block-confirm"
    || impact.feedback === "guard-break-confirm"
    || impact.feedback === "kick-confirm"
    || impact.feedback === "roll-impact"
    || impact.feedback === "dodge-evaded";
  const target = remoteOwned ? bot : player;
  const x = target.x;
  const y = target.y;
  const radius = 18 + impact.progress * 42;
  const alpha = Math.max(0, (1 - impact.progress) * 0.9);
  const parry = impact.feedback === "parry-success" || impact.feedback === "parried";
  const guard = impact.feedback === "guard-pressure" || impact.feedback === "block-confirm"
    || impact.feedback === "guard-broken" || impact.feedback === "guard-break-confirm";
  const roll = impact.feedback === "roll-impact" || impact.feedback === "rolled-over"
    || impact.feedback === "dodge-success" || impact.feedback === "dodge-evaded";
  const tone = parry ? "174, 209, 147" : guard ? "224, 187, 91" : roll ? "150, 194, 190" : "255, 170, 104";

  ctx.save();
  ctx.strokeStyle = `rgba(${tone}, ${alpha})`;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < impact.rays; i += 1) {
    const angle = (i / impact.rays) * Math.PI * 2 + impact.progress * 0.45;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * radius * 0.42, y + Math.sin(angle) * radius * 0.42);
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(${tone}, ${impact.flashAlpha})`;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(4, radius * 0.34), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function createArenaLayer() {
  const layer = document.createElement("canvas");
  layer.width = canvas.width;
  layer.height = canvas.height;
  const layerContext = layer.getContext("2d", { alpha: false });
  layerContext.fillStyle = "#1c1913";
  layerContext.fillRect(0, 0, layer.width, layer.height);
  layerContext.strokeStyle = "rgba(214, 195, 148, .065)";
  layerContext.lineWidth = 1;
  for (let x = 0; x <= layer.width; x += 48) {
    layerContext.beginPath();
    layerContext.moveTo(x, 0);
    layerContext.lineTo(x, layer.height);
    layerContext.stroke();
  }
  for (let y = 0; y <= layer.height; y += 48) {
    layerContext.beginPath();
    layerContext.moveTo(0, y);
    layerContext.lineTo(layer.width, y);
    layerContext.stroke();
  }
  layerContext.strokeStyle = "rgba(214, 195, 148, .22)";
  layerContext.lineWidth = 3;
  layerContext.strokeRect(12, 12, layer.width - 24, layer.height - 24);
  return layer;
}

function drawFighter(fighter, body, shadow) {
  const dead = fighter.action === "dead";
  ctx.save();
  const airborne = fighter.action === "jump" || fighter.action.startsWith("jump_attack");
  const knockedDown = fighter.action === "knockdown";
  const jumpProgress = airborne ? Math.min(1, fighter.actionElapsedMs / Math.max(1, fighter.actionDurationMs)) : 0;
  const lift = airborne ? Math.sin(jumpProgress * Math.PI) * 22 : 0;
  ctx.translate(fighter.x, fighter.y - lift);
  const rollSpin = fighter.action === "dodge" ? fighter.actionElapsedMs / COMBAT.dodge.durationMs * Math.PI * 2 : 0;
  ctx.rotate(fighter.facing + rollSpin + (knockedDown ? Math.PI / 2 : 0));
  const localCharge = fighter.id === "player" ? leftButtonCharge.progress() : 0;
  const heavyWindup = fighter.action === "heavy_attack_windup";
  const heavyActive = fighter.action === "heavy_attack_active";
  if (localCharge > 0 || heavyWindup || heavyActive) {
    const lean = heavyActive ? 16 : heavyWindup ? 9 : localCharge * 8;
    ctx.translate(lean, 0);
    ctx.scale(1 + (heavyActive ? 0.22 : localCharge * 0.09), heavyActive ? 0.89 : 1);
  }
  if (knockedDown) ctx.scale(1.38, 0.62);
  if (localCharge > 0) drawLmbChargeTell(localCharge);
  ctx.globalAlpha = dead ? 0.28 : 1;

  if (fighter.action === "attack_windup" || fighter.action === "attack_active") drawAttackArc(fighter);
  if (fighter.action === "attack_left_windup" || fighter.action === "attack_left_active"
    || fighter.action === "attack_right_windup" || fighter.action === "attack_right_active") drawDirectionalAttackArc(fighter);
  if (fighter.action === "running_attack_windup" || fighter.action === "running_attack_active") drawRunningAttackArc(fighter);
  if (fighter.action === "heavy_attack_windup" || fighter.action === "heavy_attack_active") drawHeavyAttackArc(fighter);
  if (fighter.action === "jump_attack_windup" || fighter.action === "jump_attack_active") drawJumpAttackArc(fighter);
  if (fighter.action === "kick_windup" || fighter.action === "kick_active") drawKickArc(fighter);
  if (fighter.action === "block") drawBlockArc(fighter);
  drawWeaponTrail(fighter.action);
  if (fighter.action === "dodge" && fighter.actionElapsedMs <= COMBAT.dodge.iframeMs) {
    ctx.strokeStyle = "rgba(216, 202, 160, .5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(-2, 8, 20, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, COMBAT.fighterRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#13110d";
  ctx.beginPath();
  ctx.arc(7, -5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c8b684";
  ctx.fillRect(12, -2, 26, 4);
  ctx.restore();
}

function drawWeaponTrail(action) {
  const light = action === "attack_windup" || action === "attack_active";
  const leftSweep = action === "attack_left_windup" || action === "attack_left_active";
  const rightSweep = action === "attack_right_windup" || action === "attack_right_active";
  const running = action === "running_attack_windup" || action === "running_attack_active";
  const heavy = action === "heavy_attack_windup" || action === "heavy_attack_active";
  const jump = action === "jump_attack_windup" || action === "jump_attack_active";
  if (!light && !leftSweep && !rightSweep && !running && !heavy && !jump) return;

  const active = action.endsWith("_active");
  const radius = heavy ? 44 : running ? 42 : jump ? 40 : 36;
  const sweepOffset = leftSweep
    ? -COMBAT.directionalAttack.arcOffsetRadians
    : rightSweep
      ? COMBAT.directionalAttack.arcOffsetRadians
      : 0;
  const start = (heavy ? -1.05 : running ? -0.54 : jump ? -0.34 : -0.72) + sweepOffset;
  const end = (heavy ? 0.72 : running ? 0.34 : jump ? 0.30 : 0.48) + sweepOffset;
  ctx.save();
  ctx.strokeStyle = heavy
    ? (active ? "rgba(255, 105, 58, .88)" : "rgba(255, 173, 92, .42)")
    : running
      ? (active ? "rgba(113, 214, 255, .92)" : "rgba(126, 193, 222, .42)")
    : jump
      ? (active ? "rgba(255, 150, 72, .9)" : "rgba(255, 195, 102, .42)")
      : (active ? "rgba(238, 219, 160, .82)" : "rgba(214, 195, 148, .34)");
  ctx.lineWidth = heavy ? 8 : running ? 6 : jump ? 6 : 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, radius, start, end);
  ctx.stroke();
  ctx.globalAlpha = 0.34;
  ctx.lineWidth *= 1.75;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 4, start + 0.10, end - 0.08);
  ctx.stroke();
  ctx.restore();
}

function drawAttackArc(fighter) {
  const progress = fighter.action === "attack_windup"
    ? fighter.actionElapsedMs / COMBAT.attack.windupMs
    : 1;
  const alpha = fighter.action === "attack_active" ? 0.34 : 0.08 + progress * 0.11;
  ctx.fillStyle = `rgba(214, 187, 112, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, COMBAT.attack.reach + COMBAT.fighterRadius, -COMBAT.attack.arcRadians / 2, COMBAT.attack.arcRadians / 2);
  ctx.closePath();
  ctx.fill();
}

function drawDirectionalAttackArc(fighter) {
  const left = fighter.action === "attack_left_windup" || fighter.action === "attack_left_active";
  const active = fighter.action === "attack_left_active" || fighter.action === "attack_right_active";
  const offset = left ? -COMBAT.directionalAttack.arcOffsetRadians : COMBAT.directionalAttack.arcOffsetRadians;
  const progress = fighter.action.endsWith("_windup")
    ? fighter.actionElapsedMs / COMBAT.directionalAttack.windupMs
    : 1;
  const alpha = active ? 0.30 : 0.08 + Math.min(1, progress) * 0.13;
  ctx.fillStyle = `rgba(224, 198, 122, ${alpha})`;
  ctx.strokeStyle = active ? "rgba(250, 226, 154, .92)" : "rgba(224, 198, 122, .62)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(
    0,
    0,
    COMBAT.directionalAttack.reach + COMBAT.fighterRadius,
    offset - COMBAT.directionalAttack.arcRadians / 2,
    offset + COMBAT.directionalAttack.arcRadians / 2,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawRunningAttackArc(fighter) {
  const progress = fighter.action === "running_attack_windup"
    ? fighter.actionElapsedMs / COMBAT.runningAttack.windupMs
    : 1;
  const active = fighter.action === "running_attack_active";
  const alpha = active ? 0.28 : 0.08 + Math.min(1, progress) * 0.14;
  ctx.fillStyle = `rgba(92, 190, 228, ${alpha})`;
  ctx.strokeStyle = active ? "rgba(113, 214, 255, .95)" : "rgba(126, 193, 222, .72)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(
    0,
    0,
    COMBAT.runningAttack.reach + COMBAT.fighterRadius,
    -COMBAT.runningAttack.arcRadians / 2,
    COMBAT.runningAttack.arcRadians / 2,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawLmbChargeTell(progress) {
  ctx.save();
  ctx.strokeStyle = progress >= 1 ? "#ffe49b" : "rgba(255, 172, 82, 0.88)";
  ctx.lineWidth = 3 + progress * 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, COMBAT.heavyAttack.reach + COMBAT.fighterRadius, -0.68, -0.68 + progress * 1.36);
  ctx.stroke();
  ctx.restore();
}

function drawHeavyAttackArc(fighter) {
  const progress = fighter.action === "heavy_attack_windup"
    ? fighter.actionElapsedMs / COMBAT.heavyAttack.windupMs
    : 1;
  const alpha = fighter.action === "heavy_attack_active" ? 0.32 : 0.10 + Math.min(1, progress) * 0.16;
  ctx.fillStyle = `rgba(255, 112, 64, ${alpha})`;
  ctx.strokeStyle = fighter.action === "heavy_attack_active"
    ? "rgba(255, 72, 42, .95)"
    : "rgba(255, 174, 92, .82)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(
    0,
    0,
    COMBAT.heavyAttack.reach + COMBAT.fighterRadius,
    -COMBAT.heavyAttack.arcRadians / 2,
    COMBAT.heavyAttack.arcRadians / 2,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, COMBAT.fighterRadius + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawKickArc(fighter) {
  const active = fighter.action === "kick_active";
  ctx.strokeStyle = active ? "rgba(255, 214, 120, .95)" : "rgba(255, 214, 120, .45)";
  ctx.lineWidth = active ? 6 : 3;
  ctx.beginPath();
  ctx.arc(0, 0, COMBAT.kick.reach + COMBAT.fighterRadius, -COMBAT.kick.arcRadians / 2, COMBAT.kick.arcRadians / 2);
  ctx.stroke();
}

function drawJumpAttackArc(fighter) {
  const active = fighter.action === "jump_attack_active";
  ctx.fillStyle = active ? "rgba(255, 128, 72, .32)" : "rgba(255, 190, 92, .16)";
  ctx.strokeStyle = active ? "rgba(255, 112, 58, .95)" : "rgba(255, 190, 92, .65)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, COMBAT.jumpAttack.reach + COMBAT.fighterRadius, -COMBAT.jumpAttack.arcRadians / 2, COMBAT.jumpAttack.arcRadians / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawBlockArc(fighter) {
  const parry = fighter.actionElapsedMs <= COMBAT.block.parryWindowMs;
  ctx.strokeStyle = parry ? "rgba(241, 218, 142, .9)" : "rgba(177, 160, 112, .58)";
  ctx.lineWidth = parry ? 5 : 3;
  ctx.beginPath();
  ctx.arc(0, 0, 32, -COMBAT.block.halfAngleRadians, COMBAT.block.halfAngleRadians);
  ctx.stroke();
}

function simulateStep(stepMs) {
  inputs.player = playerInput();
  inputs.bot = botInput();
  handleEvents(stepWorld(world, inputs, stepMs));
}

function frame(now) {
  if (document.hidden) return;
  frameBudget.advance(now, simulateStep);
  updateChargeHud();
  updateHud();
  const impact = combatImpact.sample(now);
  if (!impact.freeze) render(impact);
  animationFrameId = requestAnimationFrame(frame);
}

function handleVisibilityChange() {
  releaseInputs();
  if (document.hidden) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
    frameBudget.reset();
    return;
  }
  frameBudget.reset(performance.now());
  if (!animationFrameId) animationFrameId = requestAnimationFrame(frame);
}

updateHud();
render();
frameBudget.reset(performance.now());
animationFrameId = requestAnimationFrame(frame);
