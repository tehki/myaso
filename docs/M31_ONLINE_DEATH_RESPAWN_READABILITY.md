# M31 — Real Online Death / Respawn Readability

## Objective

Make authoritative death unmistakable in the normal player-facing browser game, then remove that presentation only when the server actually respawns the player.

M31 deepens the existing human-vs-human combat loop. It does not add progression, persistence, new combat rules, or a client-owned respawn timer.

## Player presentation

- The normal `web/index.html` arena contains a non-interactive combat overlay.
- While the local authoritative fighter action is `Dead`, the overlay shows `DEFEATED` and `Respawning…`.
- The overlay is hidden for every non-dead authoritative action.
- Existing M29 transient event text remains responsible for explaining the exchange and the return to play.
- No countdown is estimated in the browser; the server remains the only authority for when respawn has completed.

## Real-browser flight

The M31 `uirespawn` scenario opens the normal online page concurrently in Chrome and Firefox against one loopback authoritative server.
The lower network ID uses only ordinary browser controls: short `D` movement pulses to recover hit knockback spacing plus real rightward primary-pointer attacks. The higher network ID remains passive.

The flight passes only when:

- the defender reaches authoritative 0 HP and both clients render that result;
- the defender overlay is visibly `DEFEATED` / `Respawning…` while dead;
- the defender records `Defeated - read the exchange.` and the attacker records `Opponent down.`;
- after the real server respawn, defender HP/guard return to 100/100 and the attacker sees the same opponent vitals;
- the death overlay is hidden again after having been shown;
- the defender records `Respawned - back in the fight.` and the attacker records `Opponent respawned.`;
- real movement and rightward pointer-input provenance is present.

The flight observes rendered DOM/HUD state only. It does not inject HP, guard, positions, actions, simulation state, respawn state, or server events.

## Risk / rollback

The product change is presentation-only and consumes already-authoritative state. Rollback is to close/discard the M31 branch; the accepted M30 head remains unchanged.
