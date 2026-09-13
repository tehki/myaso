# myaso

**myaso.io** is a browser-based free-for-all action game focused on skillful melee combat, inspired by the immediacy of classic `.io` games and old-school action-RPG worlds.

The combat north star is simple: **player skill should decide fights more than accumulated stats**.

## Combat Kernel M1

The first playable development milestone is intentionally small:

- WASD movement;
- mouse-facing/aiming;
- one committed melee attack with windup, active, and recovery phases;
- timed dodge with a short invulnerability window;
- directional block and a short parry window;
- guard pressure and guard break;
- health, death, and respawn;
- a deterministic sparring bot for repeatable local practice.

There is deliberately no progression, loot, inventory, account system, classes, or additional weapons in M1. First, the fight itself has to be fun.

## Run locally

From the repository root:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/web/`.

Controls: **WASD** move, **mouse** aim, **left mouse** attack, **right mouse** block/parry, **Space** dodge.

## Tests

```bash
node --test tests/combat-model.test.mjs
```

See [`docs/COMBAT_NORTH_STAR.md`](docs/COMBAT_NORTH_STAR.md) for the design contract.
