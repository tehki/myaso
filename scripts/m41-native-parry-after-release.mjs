// M41: synchronize the genuine Chrome/Firefox W3C gestures at the native
// release ACK boundary instead of predicting Firefox's 4..65ms wheel ingress
// from an unstable median. The unchanged 135ms R2 release-to-hit windup and
// 125ms parry window leave room for one genuine wheel after light release.
// No DOM event synthesis, button replay, server-state writes, or hit retries.
import { setTimeout as sleepTimer } from "node:timers/promises";

export async function dispatchM41NativeParryAfterRelease({
  sendAttack, sendWheel, sleep = sleepTimer,
  wheelAfterReleaseMs = 10,
}) {
  if (![sendAttack, sendWheel, sleep].every(fn => typeof fn === "function")
    || !Number.isFinite(wheelAfterReleaseMs)
    || wheelAfterReleaseMs < 0 || wheelAfterReleaseMs > 30) {
    throw new TypeError("M41 requires exactly one real release followed by a bounded W3C wheel");
  }
  // This resolves only after the native Chrome W3C pointerUp was ACKed.
  // Do not start a Firefox wheel if the attack was rejected or timed out.
  await sendAttack();
  await sleep(wheelAfterReleaseMs);
  // A rejected real Firefox W3C scroll is fatal, never reissued or forged.
  await sendWheel();
  return { wheelAfterReleaseMs };
}
