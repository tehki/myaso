# M51 - Three-Player Authoritative FFA

## Objective

Prove that the browser game is operating as free-for-all combat rather than as a sequence of two-player duels.

M51 adds no new combat rule. It validates the existing authoritative world, replication, identity, scoreboard, and browser-input stack with three simultaneous real clients.

## Deterministic server proof

The Rust regression creates three fighters on one line:

- fighter #1 on the left;
- fighter #2 in the center;
- fighter #3 on the right.

It then proves two independent authoritative attacks:

1. #1 attacks right and damages only #2 from 100 HP to 66 HP;
2. #3 attacks left and damages only #2 from 66 HP to 32 HP.

Both attackers remain at 100 HP, all kill scores remain 0, and the match remains active.

This catches accidental nearest-opponent assumptions, pair-only targeting, or shared-target corruption below the browser layer.

## Real-browser proof

The M51 `uiffa3` flight starts three independent browser sessions:

- Chrome on driver port 9515;
- Firefox on driver port 9516;
- a second isolated ChromeDriver/Chrome session on port 9517.

All prior M22-M50 scenarios still start exactly two browsers. The third driver exists only for this acceptance gate.

The flight requires:

- three distinct authoritative network IDs;
- all three clients to render the same three-row 0-0-0 scoreboard;
- each client to mark exactly one scoreboard row as its own;
- left fighter real movement + pointer attack to reduce only the center fighter to 66 HP;
- left fighter retreat;
- right fighter real movement + pointer attack to reduce only the center fighter to 32 HP;
- both attackers to remain at 100 HP;
- both attackers to retain real WebDriver pointer-down provenance;
- no kill-score or match-overlay mutation during the two non-lethal hits.

No player state, score, HP, identity, or hit outcome is injected by the harness.

## Why this milestone matters

The project targets a free-for-all action game and hundreds of players on one logical map. Earlier real combat acceptance used two browser clients, which proved authoritative PvP but not true multi-opponent behavior.

M51 closes that gap at the smallest meaningful scale: three simultaneous human-style clients and two different attackers interacting with the same authoritative target.

## Scope / risk

Base is M50 exact head `be3d3a17640361a48dcd33e3d6b98a1437be5c26`, validated by FULL quality CI #189 / run `35395588685`.

M51 changes acceptance infrastructure, one deterministic Rust regression, CI, and documentation only. It does not change damage, movement, match rules, packet size, protocol version, persistence, deployment, public bind, or runtime activation.
