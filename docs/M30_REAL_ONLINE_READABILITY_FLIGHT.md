# M30 — Real Online Combat Readability Flight

## Objective

Prove that the normal player-facing browser game renders M29 combat readability from authoritative server state in two real browsers.

M30 deliberately uses `web/index.html` and `web/online-game.mjs`; it does not use the dedicated `pvp-flight.html` combat harness for its acceptance proof.

## Flight

- Start the existing authoritative loopback WebTransport server.
- Open the real online game page concurrently in headless Chrome and Firefox.
- Wait until both normal HUDs show two full-health fighters and expose their assigned player IDs through the normal online status text.
- Select the lower network ID as the attacker because the normal spawn layout places that fighter to the left of its opponent.
- Focus both real arena canvases.
- Keep the lower-ID attacker moving toward the passive defender with an ordinary held `D` input while the exchange is attempted; release it immediately after success or failure.
- Passively record the delivered `KeyD` down/up and primary-pointer events as browser-input provenance; the observers do not alter game state.
- Perform up to five real WebDriver canvas clicks, each followed by a 700 ms observation window, stopping immediately when the first authoritative 34-HP exchange renders. Holding movement during the attempts lets the normal server-owned movement close the final spacing instead of relying on a fixed-duration position guess.
- Observe only rendered DOM text/HUD values; do not inject simulation state, combat actions, HP, guard, positions, or server events.

## Acceptance

The flight passes only when both browsers agree on the same authoritative exchange:

- attacker HUD remains at 100 HP and renders opponent HP as 66;
- defender HUD renders own HP as 66 and opponent HP as 100;
- attacker visibly renders `Opponent hit - 34 HP.`;
- defender visibly renders `Hit taken - 34 HP.`;
- attacker visibly renders at least one authoritative commitment hint for windup, active strike, or recovery.
