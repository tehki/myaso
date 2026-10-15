# M227 — trusted real light-pointerdown receipt for M144 FFA recovery staging

Issue [#265](https://github.com/tehki/myaso/issues/265) records a genuine three-browser M144 failure: the independent `sleep(90)` after initiating the light attack produced a **132ms** real input lead, beyond strict **20..120ms**. It happened under browser-driver jitter without any gameplay failure.

M227 changes **acceptance harness only**, not the game. The existing native Chrome2 real left-button `pointerdown` capture observer may send a one-use `event.isTrusted === true` read-only receipt to the localhost flight runner. The runner arms the receipt **before** dispatching the sole real W3C light gesture, starts the light W3C request, waits for the actual input event receipt instead of guessing from command-issue time, holds a **65ms** bounded harness-only lead, then issues exactly one genuine Chrome Space+LMB jump chord. The pre-existing server lifecycle, authoritative HP/guard, focus handoffs `#3 -> #1 -> nearest #3`, visual recovery cues, true W3C evidence, M144 **20..120ms** and M145 **70..150ms** strict overlap assertions are unchanged. M145 retains its 100ms existing staging.

Missing/late/untrusted/duplicate receipt **fails closed** (600ms ceiling); no synthetic event, second click, widened gameplay parry/recovery rule, or post-damage test retry. The read-only receipt alone never means the attack landed or qualified.

This timing change is a hypothesis, not proven until full real Chrome/Firefox/Chrome2 quality succeeds twice on the same head, followed by independent merged-main CI. Preserve the original red evidence. Keep the playable build closed.
