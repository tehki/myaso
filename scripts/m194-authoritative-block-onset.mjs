import { parseM201ServerProof } from "./m201-authoritative-phase-proof.mjs";

// Read-only scheduling reference from the existing loopback 60Hz trace.
// Native wheel provenance, W3C acknowledgements and combat outcomes remain
// separate mandatory checks; this never sends input or creates a Block.
export async function awaitM194ServerBlock({
  readOutput, afterOffset, fighterId, sleep, now = () => Date.now(), timeoutMs = 190,
}) {
  if (![readOutput, sleep, now].every(fn => typeof fn === "function")
    || !Number.isSafeInteger(afterOffset) || afterOffset < 0
    || !Number.isSafeInteger(fighterId) || fighterId < 1
    || !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 190) {
    throw new TypeError("M194 requires bounded fresh authoritative Block proof");
  }
  const startedAt = now();
  while (now() - startedAt <= timeoutMs) {
    const output = readOutput();
    if (typeof output !== "string" || output.length < afterOffset) {
      throw new Error("M194 authoritative output unavailable");
    }
    const block = parseM201ServerProof(output.slice(afterOffset)).find(row =>
      row.kind === "action" && row.fighter === fighterId && row.from === 0 && row.to === 6);
    if (block) return { fighterId, serverTick: block.tick, observedAfterMs: now() - startedAt };
    await sleep(4);
  }
  throw new Error("M194 did not observe genuine server Block within release budget");
}
