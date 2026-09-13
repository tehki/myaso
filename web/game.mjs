import { COMBAT, createFighter, createWorld, stepWorld } from "../src/combat/model.mjs";

const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d");
const eventText = document.querySelector("#event-text");
const hud = {
  playerHp: document.querySelector("#player-hp"),
  playerHpValue: document.querySelector("#player-hp-value"),
  playerGuard: document.querySelector("#player-guard"),
  playerGuardValue: document.querySelector("#player-guard-value"),
  botHp: document.querySelector("#bot-hp"),
  botHpValue: document.querySelector("#bot-hp-value"),
  botGuard: document.querySelector("#bot-guard"),
  botGuardValue: document.querySelector("#bot-guard-value"),
};

const player = createFighter({ id: "player", x: 270, y: 270, facing: 0 });
const bot = createFighter({ id: "bot", x: 690, y: 270, facing: Math.PI });
const world = createWorld({ width: canvas.width, height: canvas.height, fighters: [player, bot] });

const keys = new Set();
const mouse = { x: 700, y: 270, block: false };
let attackRequested = false;
let dodgeRequested = false;
let lastFrame = performance.now();
let accumulator = 0;
let lastBotAttackAt = -1000;
let botBlockUntil = 0;
let botDodgeUntil = 0;
let messageUntil = 0;
const fixedStepMs = 1000 / 120;

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  if (event.button === 0) attackRequested = true;
  if (event.button === 2) mouse.block = true;
  updateMouse(event);
});
canvas.addEventListener("pointerup", (event) => {
  if (event.button === 2) mouse.block = false;
});
canvas.addEventListener("pointermove", updateMouse);
window.addEventListener("blur", () => {
  keys.clear();
  attackRequested = false;
  mouse.block = false;
});
canvas.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === "Space" && !event.repeat) dodgeRequested = true;
});
canvas.addEventListener("keyup", (event) => keys.delete(event.code));

function updateMouse(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
}

function playerInput() {
  const moveX = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const moveY = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  const input = {
    moveX,
    moveY,
    aimX: mouse.x,
    aimY: mouse.y,
    attack: attackRequested,
    block: mouse.block,
    dodge: dodgeRequested,
  };
  attackRequested = false;
  dodgeRequested = false;
  return input;
}

function botInput() {
  const dx = player.x - bot.x;
  const dy = player.y - bot.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = dx / distance;
  const ny = dy / distance;
  const side = Math.sin(world.nowMs / 650) >= 0 ? 1 : -1;
  const input = { aimX: player.x, aimY: player.y, moveX: 0, moveY: 0, attack: false, block: false, dodge: false };

  if (player.action === "attack_windup" && distance < 118) {
    const observedWindup = player.actionElapsedMs;
    if (observedWindup > 72 && botBlockUntil < world.nowMs && botDodgeUntil < world.nowMs) {
      const decision = Math.floor(world.nowMs / 900) % 3;
      if (decision === 0) botDodgeUntil = world.nowMs + 80;
      else botBlockUntil = world.nowMs + 210;
    }
  }

  if (botDodgeUntil > world.nowMs) {
    input.dodge = true;
    input.moveX = -ny * side;
    input.moveY = nx * side;
    return input;
  }

  if (botBlockUntil > world.nowMs) {
    input.block = true;
    return input;
  }

  if (distance > 118) {
    input.moveX = nx;
    input.moveY = ny;
  } else if (distance < 64) {
    input.moveX = -nx * 0.7 - ny * side * 0.3;
    input.moveY = -ny * 0.7 + nx * side * 0.3;
  } else {
    input.moveX = -ny * side * 0.55;
    input.moveY = nx * side * 0.55;
  }

  if (distance < 94 && world.nowMs - lastBotAttackAt > 760 && bot.action === "idle") {
    input.attack = true;
    lastBotAttackAt = world.nowMs;
  }
  return input;
}

function handleEvents(events) {
  for (const event of events) {
    const names = { player: "You", bot: "Bot" };
    if (event.type === "hit") say(`${names[event.attackerId]} hit ${names[event.targetId]} for ${event.damage}.`, 560);
    if (event.type === "block") say(`${names[event.targetId]} blocked.`, 480);
    if (event.type === "parry") say(`${names[event.targetId]} PARRIED ${names[event.attackerId]}.`, 720);
    if (event.type === "guard_break") say(`${names[event.targetId]}'s guard broke. Punish!`, 760);
    if (event.type === "evade") say(`${names[event.targetId]} dodged through the strike.`, 520);
    if (event.type === "death") say(`${names[event.killerId]} wins the exchange.`, 980);
    if (event.type === "respawn") say(`${names[event.fighterId]} re-enters the arena.`, 620);
  }
}

function say(text, durationMs) {
  eventText.textContent = text;
  messageUntil = world.nowMs + durationMs;
}

function updateHud() {
  setMeter(hud.playerHp, hud.playerHpValue, player.hp);
  setMeter(hud.playerGuard, hud.playerGuardValue, player.guard);
  setMeter(hud.botHp, hud.botHpValue, bot.hp);
  setMeter(hud.botGuard, hud.botGuardValue, bot.guard);
  if (world.nowMs > messageUntil) eventText.textContent = actionHint();
}

function setMeter(bar, label, value) {
  const rounded = Math.max(0, Math.round(value));
  bar.style.width = `${rounded}%`;
  label.textContent = String(rounded);
}

function actionHint() {
  if (player.action === "dead") return "Down. Read the exchange and reset.";
  if (player.action === "attack_windup") return "Committed — your strike is readable now.";
  if (player.action === "attack_recovery") return "Recovery — this is where careless attacks get punished.";
  if (player.action === "block" && player.actionElapsedMs <= COMBAT.block.parryWindowMs) return "Parry window active.";
  if (player.action === "block") return "Blocking — keep your opponent in front of you.";
  if (player.action === "dodge") return "Dodge i-frames — reposition, don't spam.";
  return "Spacing decides the next exchange.";
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArena();
  drawFighter(player, "#e2d5b4", "#51452d");
  drawFighter(bot, "#b96350", "#47251f");
}

function drawArena() {
  ctx.fillStyle = "#1c1913";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(214, 195, 148, .065)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(214, 195, 148, .22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
}

function drawFighter(fighter, body, shadow) {
  const dead = fighter.action === "dead";
  ctx.save();
  ctx.translate(fighter.x, fighter.y);
  ctx.rotate(fighter.facing);
  ctx.globalAlpha = dead ? 0.28 : 1;

  if (fighter.action === "attack_windup" || fighter.action === "attack_active") drawAttackArc(fighter);
  if (fighter.action === "block") drawBlockArc(fighter);
  if (fighter.action === "dodge" && fighter.actionElapsedMs <= COMBAT.dodge.iframeMs) {
    ctx.strokeStyle = "rgba(216, 202, 160, .5)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.fillStyle = shadow;
  ctx.beginPath(); ctx.ellipse(-2, 8, 20, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0, 0, COMBAT.fighterRadius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#13110d";
  ctx.beginPath(); ctx.arc(7, -5, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#c8b684";
  ctx.fillRect(12, -2, 26, 4);
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

function drawBlockArc(fighter) {
  const parry = fighter.actionElapsedMs <= COMBAT.block.parryWindowMs;
  ctx.strokeStyle = parry ? "rgba(241, 218, 142, .9)" : "rgba(177, 160, 112, .58)";
  ctx.lineWidth = parry ? 5 : 3;
  ctx.beginPath();
  ctx.arc(0, 0, 32, -COMBAT.block.halfAngleRadians, COMBAT.block.halfAngleRadians);
  ctx.stroke();
}

function frame(now) {
  const elapsed = Math.min(50, now - lastFrame);
  lastFrame = now;
  accumulator += elapsed;

  while (accumulator >= fixedStepMs) {
    const events = stepWorld(world, { player: playerInput(), bot: botInput() }, fixedStepMs);
    handleEvents(events);
    accumulator -= fixedStepMs;
  }

  updateHud();
  render();
  requestAnimationFrame(frame);
}

updateHud();
render();
requestAnimationFrame(frame);
