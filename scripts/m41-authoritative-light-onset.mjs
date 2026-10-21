// M41: use the genuine 60Hz authoritative light windup as the causal
// fence for one Firefox W3C wheel. A ChromeDriver pointerUp *ACK* is not the
// same as the server's charge→light transition, which is sampled on a
// different 30Hz stream. This helper never fabricates DOM actions or writes
// World state; it only reads loopback-only M201 server proof.
import { setTimeout as sleepTimer } from "node:timers/promises";

export async function awaitM41AuthoritativeLight({
  readOutput, afterOffset, fighterId, sleep = sleepTimer, now = () => Date.now(),
  timeoutMs = 500,
}) {
  if (typeof readOutput !== "function" || typeof sleep !== "function"
    || typeof now !== "function" || !Number.isSafeInteger(afterOffset) || afterOffset < 0
    || !Number.isSafeInteger(fighterId) || fighterId < 1
    || !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 1000) {
    throw new TypeError("M41 requires bounded server-owned light onset proof");
  }
  const start = now();
  while (now() - start <= timeoutMs) {
    const output = readOutput();
    if (typeof output !== "string" || output.length < afterOffset) {
      throw new Error("M41 authoritative server trace became unavailable");
    }
    for (const line of output.slice(afterOffset).split(/\r?\n/).slice(0, -1)) {
      const match = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(line);
      if (match && Number(match[2]) === fighterId
        && (Number(match[3]) === 0 || Number(match[3]) === 9)
        && Number(match[4]) === 1) {
        return { serverTick: Number(match[1]), observedAfterMs: now() - start };
      }
    }
    await sleep(4);
  }
  throw new Error("M41 no real authoritative light windup observed before wheel deadline");
}

export async function dispatchM41NativeParryOnLightOnset({
  readOutput, afterOffset, fighterId, sendAttack, sendWheel,
  sleep = sleepTimer, now = () => Date.now(), wheelAfterLightMs = 8,
}) {
  if (typeof sendAttack !== "function" || typeof sendWheel !== "function"
    || typeof sleep !== "function" || typeof now !== "function"
    || !Number.isInteger(wheelAfterLightMs) || wheelAfterLightMs < 0
    || wheelAfterLightMs > 30) {
    throw new TypeError("M41 needs one native Chrome tap and one native Firefox wheel");
  }
  // Chrome W3C is still one authentic mouse transaction, 20–35 ms short
  // hold. Observe the resulting real Rust light action without awaiting
  // WebDriver's variable response latency, then send ONE W3C Firefox wheel.
  // Start the genuine Chrome W3C request synchronously before reading
  // any server proof. A deferred microtask can poll a stale trace first.
  // The request's HTTP ACK may still arrive after the server light onset.
  let attackRequest;
  try {
    attackRequest = sendAttack();
  } catch (error) {
    throw error;
  }
  const attackOutcome = Promise.resolve(attackRequest).then(
    () => ({ ok: true }),
    error => ({ ok: false, error }),
  );
  let onset;
  try {
    onset = await awaitM41AuthoritativeLight({
      readOutput, afterOffset, fighterId, sleep, now,
    });
  } catch (error) {
    const attempted = await attackOutcome;
    if (!attempted.ok) throw attempted.error;
    throw error; // Never issue a blind wheel without real server light.
  }
  // With real Rust LIGHT at tick T and hit at T+8, Firefox Block must begin
  // neither too early (T+1 -> guard block) nor too late (T+9 -> 34HP hit).
  // Actual protected #39530511510: Block T+2 -> PARRY, Block T+1 -> BLOCK.
  // #39529874983: artificial +18ms could deliver Block T+9 -> 34HP HIT.
  // Target the intermediate W3C dispatch offset without changing gameplay
  // or claiming deterministic delivery under loaded independent drivers.
  if (wheelAfterLightMs > 0) await sleep(wheelAfterLightMs);
  let wheelError = null;
  try { await sendWheel(); } catch (error) { wheelError = error; }
  const attempted = await attackOutcome;
  if (!attempted.ok) throw attempted.error;
  if (wheelError) throw wheelError;
  return { ...onset, wheelAfterLightMs };
}
