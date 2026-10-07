# M166 — Authoritative Stamina Feedback

## Goal

Make authoritative exhaustion readable to the player instead of allowing a stamina-gated input to fail silently.

M166 builds directly on M163–M165. The server still owns stamina and action legality; the client only presents a short cue when the latest replicated authoritative stamina is below the unchanged cost of an attempted action.

## Contract

- Roll remains 28 stamina.
- Kick remains 18 stamina.
- Jump remains 14 stamina.
- The attempted input is still sent to authority; UI feedback never suppresses or converts the request.
- A low-stamina cue is shown only from a known replicated stamina value and while the local authoritative action is idle.
- At or above the action cost, no exhaustion cue is shown.
- The cue is transient and does not replace authoritative combat events.
- No damage, guard, movement, stamina, timing, hitbox, knockdown, packet, snapshot, or protocol constants change.

## Player feedback

When an idle player attempts an unaffordable action, the event line states the reason directly:

- `Low stamina — roll needs 28.`
- `Low stamina — kick needs 18.`
- `Low stamina — jump needs 14.`

A short stamina-colored arena pulse reinforces the message without adding permanent HUD chrome.

## Acceptance

The M166 CI gate proves:

- the pure presentation rule is silent at or above each unchanged threshold;
- the pure presentation rule names the correct unaffordable action and cost;
- a real Chrome wheel-forward below the roll threshold is still recorded as genuine browser input;
- authority still rejects that roll and does not spend stamina;
- the production UI records both the low-stamina text and `stamina-denied` visual feedback;
- both real browser clients retain clean HP/guard throughout the proof.
