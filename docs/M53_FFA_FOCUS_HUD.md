# M53 - FFA Focus HUD

## Objective

Remove the remaining two-player HUD assumption from live FFA play.

Before M53, the top-right fighter card was labeled "Opponent" and displayed the first remote entity encountered in replicated state. With three or more players that fighter was arbitrary and could differ from the rival that was actually closest to the player.

M53 turns that card into a deterministic nearest-rival focus HUD.

## Focus rule

The browser derives focus only from authoritative replicated fighter state:

1. start from the local authoritative fighter position;
2. ignore the local fighter;
3. ignore dead fighters;
4. choose the living rival with the smallest squared world-space distance;
5. if distances are equal, choose the lower authoritative network ID.

The selector returns only the focused network ID. It does not allocate a presentation object on the render hot path.

The HUD label is rebuilt only when the focused ID changes:

- `NEAREST #<netId>`;
- `NO RIVAL` if no living rival exists.

The focused HP/guard meters and recovery cue now follow that same fighter.

## Authority boundary

Focus is presentation only.

It does not:

- select an attack target for the server;
- alter hit detection;
- change movement or facing;
- change snapshots or protocol fields;
- write any fighter state.

Combat remains fully server-authoritative.

## Deterministic coverage

JavaScript coverage proves:

- nearest living rival selection;
- stable lower-net-ID tie break;
- automatic switch when the current rival dies;
- no focus when no living rival remains;
- no focus when the local authoritative fighter is absent.

## Real-browser acceptance

The M53 `uifocus` flight starts three real clients:

- Chrome;
- Firefox;
- a second isolated Chrome.

At the deterministic spawn layout it requires:

- fighter #1 focuses #2;
- fighter #2 is equidistant from #1 and #3 and therefore focuses #1;
- fighter #3 focuses #2;
- all focused HP/guard meters show 100/100.

Fighter #1 then performs real movement + pointer attack input against #2.

After the authoritative 34 HP hit:

- #1 still focuses #2 and sees focused HP 66;
- #2 still focuses healthy #1 and sees focused HP 100;
- #3 still focuses #2 and independently sees focused HP 66;
- only #2 has local HP 66;
- scores remain 0-0-0 and no match overlay appears.

This proves the HUD is derived from each client's authoritative FFA geometry rather than from connection order.

## Performance

M53 passes the authoritative state `Map` directly to the focus selector and returns a primitive net ID. No per-frame array or presentation-object allocation is introduced.

## Scope / risk

Base is M52 exact head `263bedefedf269834ddd8d902b66cfec50800327`, validated by FULL quality CI #193 / run `35433271830`.

M53 changes browser presentation, deterministic JS coverage, real-browser acceptance, CI, and documentation only. It does not change server simulation, combat rules, match rules, networking protocol, snapshot size, persistence, deployment, public bind, or runtime activation.

## Inherited acceptance stabilization

CI #194 first attempt failed at inherited M36 because Firefox delivered the real dodge keys but no authoritative dodge occurred; the same exact head passed M36 on one rerun.

That rerun later exposed a separate inherited M49 harness geometry issue: after the first kill/respawn, the attacker could already be near or beyond the defender, while the retry loop kept moving right and aiming right. Eight genuine attacks then committed without a hit.

The M53 branch stabilizes that acceptance geometry without changing gameplay:

- retreat the M49 attacker left for 500 ms to a deterministic boundary;
- approach right for 140 ms;
- retain the same real pointer attacks;
- use only 40 ms rightward correction between misses.

With 215 px/s movement and the existing authoritative attack reach, this keeps retries on the intended side of the respawned defender. No hit state is injected, no damage/range/timing rule changes, and no acceptance threshold is weakened.
