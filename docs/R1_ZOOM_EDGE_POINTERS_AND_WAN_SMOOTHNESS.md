# R1 — wider arena, directional off-screen opponents, smoother WAN rendering

## User-facing changes
- Zoom the **online authoritative render layer** to 84% of previous fighter/presentation size. It exposes ~19% more horizontal and vertical world distance, without modifying the 960×540 canvas, mouse aim, movement speed, attack reach, collision, combat radius, ticks or QUIC packets.
- Add tiny gold triangular pointers near each screen edge **only** for opponents outside the visible canvas who are still within 1,200 world units (maximum 5 nearest). The arrows point to their true camera-relative direction with an inset from the clipping edge and a small #ID label. Dead actors, the local fighter, malformed positions, and far-away interests are ignored. Unlike red threat markers, these pointers are purely informational.
- HUD, aim, score, minimap-free edge indicators and attack warnings remain in screen-space. Only visual fighters and world combat effects use the zoom. World positions themselves are unchanged.
- Avoid repeated per-frame remote sprite allocations: reuse the existing interpolator's scratch per net ID for edge-pointer locations.

## Network movement improvement
Live R1 smoke from external X230i recorded 321–325ms input→ACK p50 and 92–125ms ACK jitter p95; subsequent ICMP pings varied 144–481ms (average 304ms). These are client-to-VPS observations, not universal player latency, and routing remains an independent problem.

The server already sends 20Hz snapshots while browser presentation advances at ~60Hz. Under large WAN jitter bursts, the old render clock could jump many server ticks in one requestAnimationFrame when a late snapshot arrived, visually teleporting remote fighters. The new render-only clock limits individual catch-up frames to 145% of elapsed frame time (with an independent 50ms cap), never going backwards. It converges toward the same existing target and preserves the 90ms interpolation baseline, 100ms maximum extrapolation, and wrap/visibility reset behavior. No changes to authoritative own player position, reconciliation, WebTransport, packet format, combat, stamina, speed, movement, or hitboxes. Optional netstats shows bounded catch-up count so the effect can be measured.

## Release acceptance
Focused unit and CI tests cover four directional edges, diagonal clipping, near/far/death filtering, number cap, render/HUD isolation, target-clock burst bounds and teleport/outage handling. Still require the full main-equivalent Rust/Chrome/Firefox/512-player quality suite and external live smoke. Keep previous release rollback until client tests pass. **Do not confuse reduced visual snapping with lower actual network RTT**; routing/ACK latency remains tracked in #293.
