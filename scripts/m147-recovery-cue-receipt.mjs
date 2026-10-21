import { randomUUID } from "node:crypto";
import { COMBAT } from "../src/combat/model.mjs";

// Test-only observation channel. A DOM cue is NOT a gameplay receipt or HIT
// authority. The native flight must still verify pointers, phases and vitals.
export function createM147RecoveryCueReceipt({
  now = Date.now, schedule = setTimeout, cancel = clearTimeout, makeToken = randomUUID,
} = {}) {
  let current = null;
  return {
    arm({ observerId, targetId, ids }) {
      if (current) throw new Error("M147 cue already armed");
      if (!Array.isArray(ids) || ids.length !== 3 || new Set(ids).size !== 3
        || !ids.every(id => Number.isSafeInteger(id) && id > 0)
        || observerId === targetId || !ids.includes(observerId) || !ids.includes(targetId)) {
        throw new RangeError("M147 cue needs three real distinct roles");
      }
      const token = makeToken();
      if (typeof token !== "string" || token.length < 16 || token.length > 128) throw new Error("M147 invalid nonce");
      let resolve, timer = null, finished = false;
      const promise = new Promise(done => { resolve = done; });
      const finish = value => {
        if (finished) return;
        finished = true;
        if (timer !== null) cancel(timer);
        if (current?.token === token) current = null;
        resolve(value);
      };
      current = { token, observerId, targetId, ids: [...ids], armedAt: now(), finish };
      return {
        token,
        // Start the unchanged 900ms observation budget AFTER the browser has
        // armed/preconnected, never spend it waiting for that driver's ACK.
        wait() {
          if (!finished && timer === null) timer = schedule(() => finish(null), 900);
          return promise;
        },
        cancel: () => finish(null),
      };
    },
    receive(packet) {
      const lease = current;
      if (!lease || !packet || packet.token !== lease.token
        || packet.playerNetId !== lease.observerId || packet.targetNetId !== lease.targetId
        || !Number.isSafeInteger(packet.serverTick) || packet.serverTick <= 0
        || !Number.isFinite(packet.observedEpochMs) || !Number.isFinite(packet.cue?.epochMs)
        || packet.cue.visible !== true || packet.cue.state !== "jump-attack-recovery"
        || packet.cue.label !== "PUNISH" || packet.cue.detail !== "Jump attack recovery"
        || packet.cue.epochMs < lease.armedAt - 25
        || packet.observedEpochMs < packet.cue.epochMs
        || packet.observedEpochMs > now() + 25
        || now() - packet.observedEpochMs >= COMBAT.jumpAttack.recoveryMs
        || packet.observedEpochMs - packet.cue.epochMs >= COMBAT.jumpAttack.recoveryMs
        || !Array.isArray(packet.fighters) || packet.fighters.length !== 3
        || new Set(packet.fighters.map(f => f?.netId)).size !== 3
        || !packet.fighters.every(f => f && lease.ids.includes(f.netId)
          && Number.isFinite(f.x) && Number.isFinite(f.y) && f.hp === 100 && f.guard === 100
          && f.action === (f.netId === lease.targetId ? 18 : 0))) return false;
      lease.finish({ ...packet, cue: { ...packet.cue }, fighters: packet.fighters.map(f => ({ ...f })), receivedEpochMs: now() });
      return true;
    },
    dispose() { current?.finish(null); },
  };
}

export async function dispatchM147CuePunish({ lease, armBrowser, performJump, performPunish }) {
  let jump;
  try {
    if (await armBrowser() !== true) throw new Error("M147 browser cue observer did not arm");
    const cue = lease.wait();
    jump = Promise.resolve().then(performJump)
      .then(() => ({ ok: true }), error => ({ ok: false, error }));
    const observed = await cue;
    if (!observed) {
      const result = await jump;
      if (!result.ok) throw result.error;
      throw new Error("M147 no actual pristine recovery cue");
    }
    let punishError;
    try { await performPunish(observed); } catch (error) { punishError = error; }
    const result = await jump;
    if (punishError) throw punishError;
    if (!result.ok) throw result.error;
    return observed;
  } finally {
    lease.cancel();
    if (jump) await jump; // Real driver completion remains mandatory, even on failure.
  }
}

export function planM147OrdinaryFocusRetreat(fighters, { jumpId, observerId, closerId }) {
  const ids = [jumpId, observerId, closerId];
  if (!Array.isArray(fighters) || fighters.length !== 3 || new Set(fighters.map(f => f?.netId)).size !== 3
    || new Set(ids).size !== 3
    || !ids.every(id => Number.isSafeInteger(id) && id > 0)) throw new Error("M147 missing real staging roles");
  const actors = ids.map(id => fighters.find(f => f.netId === id));
  if (actors.some(f => !f || !Number.isFinite(f.x) || !Number.isFinite(f.y) || f.action !== 0)
    || !(actors[0].x < actors[1].x && actors[1].x < actors[2].x)) {
    throw new Error("M147 needs ordered idle replica positions");
  }
  const [jump, observer, closer] = actors;
  const jumpDistance = Math.hypot(jump.x - observer.x, jump.y - observer.y);
  const closerDistance = Math.hypot(closer.x - observer.x, closer.y - observer.y);
  if (jumpDistance > COMBAT.attack.reach || closerDistance > COMBAT.attack.reach) {
    throw new Error("M147 staging must retain original light reach");
  }
  if (jumpDistance > closerDistance + 1) return null; // Observe stale HUD; do not move it farther.
  const desiredDistance = closerDistance + 12;
  if (desiredDistance >= COMBAT.attack.reach - 4) throw new Error("M147 staging cannot retain light reach");
  return { key: "a", holdMs: Math.max(20, Math.min(120,
    Math.ceil((desiredDistance - jumpDistance) * 1000 / COMBAT.moveSpeed))), jumpDistance, closerDistance };
}

// Installed before the real attacker gesture; returns its driver ACK before
// that gesture begins. Only actual rendered cue + actual replica are observed.
export const M147_BROWSER_CUE_OBSERVER = `
  const [token,targetId,offset] = arguments;
  const done=arguments[arguments.length-1];
  const started=performance.now();
  let reported=false;
  const report=value=>{if(!reported){reported=true;done(value);}};
  const socket=new WebSocket('ws://'+location.host+'/__myaso_m147_cue');
  const timer=setInterval(()=>{
    if(performance.now()-started>=3000){clearInterval(timer);socket.close();report(false);return;}
    if(socket.readyState!==WebSocket.OPEN)return;
    const a=window.__MYASO_ACCEPTANCE_STATE__;
    const rows=window.__MYASO_M30_UI__?.recoveryTransitions??[];
    const cue=rows.slice(offset).findLast(x=>x.visible&&x.state==="jump-attack-recovery"
      &&x.label==="PUNISH"&&x.detail==="Jump attack recovery");
    const recovery=document.querySelector('#opponent-recovery');
    const focus=document.querySelector('#focus-label')?.textContent?.trim();
    const target=a?.fighters?.find(x=>x.netId===targetId);
    if(cue&&recovery&&!recovery.hidden&&recovery.dataset.state==="jump-attack-recovery"
      &&focus==="PUNISH TARGET #"+targetId&&a?.focusNetId===targetId&&target?.action===18){
      clearInterval(timer);
      socket.send(JSON.stringify({token,playerNetId:a.playerNetId,targetNetId:targetId,cue,
        serverTick:a.serverTick,fighters:a.fighters.map(x=>({...x})),observedEpochMs:Date.now()}));
      socket.close();
    }
  },4);
  socket.onopen=()=>report(true);
  socket.onerror=()=>{clearInterval(timer);socket.close();report(false);};
  socket.onclose=()=>{clearInterval(timer);report(false);};
`;
