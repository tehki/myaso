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

## Networking Foundation M2

Networking is being designed for **hundreds of players on one continuous logical map**, with an initial engineering target of 512 connected players per map instance.

The foundation uses:

- server-authoritative combat and movement;
- 60 Hz authoritative simulation and 120 Hz local prediction target;
- WebTransport/HTTP3 datagrams for realtime state where available;
- reliable WebTransport streams for control/baseline/resync traffic;
- bounded WebSocket fallback with stale realtime-frame coalescing;
- compact redundant input datagrams;
- acknowledged-baseline binary delta snapshots;
- spatial interest management and byte-budgeted priority replication;
- local-player prediction/reconciliation and remote interpolation as the next integration step.

The 512-player figure is a **capacity target**, not a production claim. Production capacity must be demonstrated by server/transport load testing.

See [`docs/NETWORKING_ARCHITECTURE.md`](docs/NETWORKING_ARCHITECTURE.md) and [`docs/ADR-0001-REALTIME-NETWORKING.md`](docs/ADR-0001-REALTIME-NETWORKING.md).

## Run locally

From the repository root:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/web/`.

Controls: **WASD** move, **mouse** aim, **left mouse** attack (**strafe** = side sweep, **move toward pointer** = thrust, **move away from pointer** = overhead), **E** heavy attack, **mouse wheel forward** roll, **mouse wheel backward** parry/short block (or early attack feint), **right-click tap** kick/shove, **right-click hold** run, **right-click hold + WASD + left mouse** running attack, **Space** jump, and **Space + left mouse** jumping attack. Running, running attacks, rolling, kicking, and jumping consume stamina.

## Tests

```bash
node --test tests/combat-model.test.mjs
node --test tests/networking.test.mjs
```

Optional synthetic networking capacity probe:

```bash
node scripts/network_capacity_probe.mjs 512
```

See [`docs/COMBAT_NORTH_STAR.md`](docs/COMBAT_NORTH_STAR.md) for the combat design contract.
