# Core 8A M156: original v1 short-click provenance (review only)

A genuine Chrome2 pointerdown/pointerup of approximately 6 ms during Firefox #2's authoritative knockdown did not produce an original World light attack in protected CI #39827439191. This is a diagnostic gap, not proof of lost QUIC packets.

The existing M144 observer is extended for the M156 scenario only. It captures the true DOM pointer IDs, pointer release classification and `onLight` latch; bounded actual 30 Hz `attack`, `jump`, and `heavyAttack` samples before the unchanged `sendInput` call; and genuine processed ACK highwater plus the server-provided actor ID. M156-only event history is bounded at 32. Native M156 still requires exactly one genuine 34 HP hit against the eligible knockdown victim, with all W3C timing and original World rules unchanged.

Use absence of `onLight` to investigate UI focus or capture. If latched but not sampled, investigate input consumption. If sampled without ACK, examine v1 networking. If ACK highwater advanced but the World remained Idle, examine actual server admission and Combat eligibility. An ACK is not proof of individual event execution or damage.

The focused native workflow runs the unchanged genuine Chrome/Firefox/Chrome2 M156 test. The full protected suite is still mandatory. There is no production gameplay, packet, Combat, server, or v2 protocol modification. Remains draft; release HOLD.
