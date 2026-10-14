# M214 — genuine browser input → confirmed rejection feedback

M196 [issue #221](https://github.com/tehki/myaso/issues/221) includes responsiveness diagnostics for real players. This first narrow read-only slice instruments the **existing M175 genuine Chrome/Firefox confirmed stamina-denial acceptance**. It is not a claim that all successful combat actions, human-perceived responsiveness, or impaired network latency have already been qualified.

## Provenance

For each real W3C roll/kick/jump/run+attack attempt, the existing strict M175 proof already requires **one genuine input**, server-processed client tick ACK, authoritative under-cost rejection, UI queued→submitted→confirmed-rejected→shown progression and unchanged 100HP/100guard. M214 records the browser actor's event/queued/submitted/confirmed/shown `epochMs` **from the same browser observer**. No Chrome-vs-Firefox clock subtraction, no node harness-to-browser clock subtraction, no pretending `confirmed` equals server commitment instant.

The read-only log `M214_CONFIRMED_DENIAL_FEEDBACK_LATENCY` emits sample counts plus nearest-rank p50/p95, min/max for input→queued, input→submitted, input→authoritative-confirmation-observed, input→shown, submitted→confirmation and confirmation→shown. Missing timestamps, mismatched provenance or negative intervals stay **null/missing**, never fabricated zeros. Small N percentile counts are explicitly reported, not population-level responsiveness claims.

## Safety & scope

Strict existing W3C provenance, stamina-denial ACK, action suppression, original gameplay windows, all Rust and cross-browser CI gates are unchanged. The diagnostic executes only **after** all strict M175 100HP/100guard checks pass and cannot qualify a failed combat case. No new client-side speculative feedback is drawn and no production telemetry is shipped. Future work on #221 should add multi-run genuine successful combat input/cue phase measurements and moderate impaired-network sampling separately, with explicit provenance.
