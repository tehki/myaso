# M248 — Move native M146 parry input into the authoritative windup

## Independent exact-head failure

PR #303 quality [run 39112706040](https://github.com/tehki/myaso/actions/runs/39112706040), first attempt, stopped at M146 because its genuine Chrome wheel-back did not become an authoritative parry before the incoming Firefox light strike.

The failure contained genuine browser input with **unchanged** damage and action rules:
- Firefox attack light pointerDOWN/UP: 1792313581958 / 1792313582066 epoch ms; attack active at 1792313582255 (server tick 279).
- Chrome defender wheel-back event: 1792313582228; defender block action began at 1792313582288 (server tick 279), **33 ms after** the attack became active.
- Defender lost 34 HP; no parry succeeded. The strict M33/M146 browser gate rejected this correctly.

The wheel event occurring *before* attack active was insufficient: transport/60Hz acceptance of the block action was later. Do not compare independent browser-relative `t` origins. These timestamps are test-only evidence, not public-server RTT estimates.

## Surgical change

M146 alone now requests a 15 ms post-short-click lead in the same real WebDriver choreography, instead of the normal M33 55 ms. The 40 ms earlier wheel dispatch aims to center the native Chrome block acceptance before the genuine Firefox 135 ms light windup completes. The default M33 and other FFA parry tests still use their previous 55 ms delay.

This change introduces one validated, bounded optional test-harness lead parameter. It does **not** generate synthetic input, change the separate WebDriver request type, grant parries, alter game logic, extend stun/attack windows, retry resolved combat, adjust player geometry, or relax acceptance gates.

## Gate

The strict result must still prove: one actual short LMB (not heavy), one genuine wheel-back, server-authoritative parry and **650 ms stun**, delayed native punish pressed at 340–470 ms into stun, a single **34 HP hit**, full guard, both browser feedback events. Full exact-head quality and independently merged-main CI are mandatory; until then draft only and no VPS activation.

This is independent of M147/PR #303 and M194/issue #298. If the earlier wheel triggers an expired parry instead, that is a real failure requiring more precise input scheduling, not a reason to loosen timing bounds.
