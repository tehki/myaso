# UI10 — PlayCanvas original input contract, SOURCE ONLY / HOLD

**Integration:** Main0 [PlayCanvas Alpha PR #1152](https://github.com/tehki/myaso/pull/1152), exact parent `a3146e942970e5b80dc9b200385cb993f0879105`.
**Core8A sibling:** [PR #1155](https://github.com/tehki/myaso/pull/1155) genuine isolated QUIC read-only browser/ACK/reconnect tests. That evidence does **not** authorize interactive PlayCanvas gameplay, mapped Greyhaven authority or Combat.
**Activation:** DISABLED. No URL parameter, snapshot, browser capability, developer console flag or provisional game session enables inputs here.

## Existing ownership to reuse — not reinvent

| Physical control | Original UI contract and required future owner |
| --- | --- |
| W/A/S/D | Existing 60Hz browser sampler -> original `connectAuthoritativeClient.sendInput` -> authoritative Rust World movement; never move a PlayCanvas entity locally |
| LMB short / hold | The **exclusive** original LMB source0 owner, physical pointer ID and original v1 / server-granted instant profile. Light 135ms; heavy intent and 320ms World READY, release only at actual UP; no double writer |
| RMB short / hold | Existing `installRightButtonGesture`: short release Kick, hold Run, off-canvas release and focus cancellation. RMB+LMB must preserve original chorded MouseEvent path |
| Wheel forward/back | Original roll / parry and short Block, original 125ms parry / 240ms Block authority; no new local timer or synthetic event |
| Space | Original trusted keydown, *keyup*, 14-stamina Jump, existing 60ms `createPhysicalJumpChord` join with genuine LMB for JumpAttack; preserve 450ms World recovery and original Idle |
| Enter / Escape | Original `installLocalChat` + server Chat C1: lower-left composer, one Enter submission, Escape, 240 UTF-8 byte limit, ACK-controlled status, no Combat while typing, synchronous release/cancel of held inputs and correct focus recovery |

`src/input/original-input-contract.mjs` imports the **existing** Combat constants and original UI functions as compatibility witnesses, but deliberately never calls a physical input installer. `main.js` marks `data-playcanvas-inputs="hold-core8"` and exposes only an immutable, inert contract; its startup does not register any key, mouse, wheel or Chat listener, author a sample, negotiate typed Combat, or instantiate a second network owner.

## Core 8A/8C acceptance gate before any future activation change

1. Isolated original Rust QUIC/WebTransport, certificate pin, authenticated identity/lease, original server map/zone and Greyhaven position verified by Core8C; no fake client world.
2. Same source original input writer with Core8A processed-input ACK, session generations and stale replay protection; exclusive v1 *or* granted typed LMB (not two writers).
3. Real Chrome+Firefox W3C physical input acceptance: movement, Light34, held Heavy46 READY→UP, RMB Kick/Run, roll/parry/block, Jump42, three same-root respawns, stale-lease negative, input focus/blur and one Enter Chat C1; preserve M140 180ms and Firefox Space+LMB Idle 8s first-REDs until independently resolved.
4. Core8A+Core8C signoff, independent Combat4D, Main0 review and explicit owner release authorization. Only then a **separate source commit** may wire physical events to the already-qualified original owner. No public switch is provided in this branch.

No protected-main merge, deployment, production configuration, new server endpoint, WebSocket fallback, public feature flag or live input activation.

## UI10 follow-up — verified original-owner behavior (4 Nov 2026)

PlayCanvas's `#application` canvas is **not** the original Combat canvas `#arena`, and it lacks the legacy `.arena-stage` host required by `installLocalChat`. Do not quietly mount a separate chat composer or let PlayCanvas capture typing outside the original Chat C1 focus fence. The later Core8-signed activation patch must explicitly adapt the original host/installer while preserving its document-level capture guards, Enter/Escape, pending ACK, authenticated sender, and canvas blur → original source0 CANCEL. This is an **unmet activation prerequisite**, not a defect to bypass with `?rust=1`.

The added `tests/original-input-owners.test.mjs` exercises **the original source modules themselves**, not a PlayCanvas reimplementation: RMB short Kick vs 180ms held Run, exact pointer identity and blur; 60ms trusted Space chord, key release; same-gesture LMB PRESS→CANCEL on Chat focus and fresh PRESS→RELEASE; Chat C1 240 UTF-8 bytes and capture fence; original wheel sign and immediate authenticated v1 sender. It also verifies the PlayCanvas mount remains inert even when passed a connected-looking QUIC actor, snapshots, a fake `activate:true`, or `core8Signed:true`. Tests use synthetic Node events to prove module contracts, **not** genuine Chrome/Firefox gameplay acceptance.

The immutable `PLAYCANVAS_INPUT_ACTIVATION_GATES` checklist is explanatory/observable only. It cannot be satisfied by a client-side boolean, URL parameter or NetID. Core8A/8C must independently authorize a real gameplay session and single original writer; Combat4D and Main0 must qualify the physical browser path in a **separate reviewed activation change**. Current read-only Core8C [#1167](https://github.com/tehki/myaso/pull/1167) demonstrates genuine Greyhaven actor snapshots, but is still explicit HOLD on interactive Combat and Chat C1. No input hooks or production changes are made here.
