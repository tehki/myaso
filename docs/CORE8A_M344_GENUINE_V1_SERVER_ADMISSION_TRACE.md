# Core 8A M344 — genuine original v1 QUIC ingress and World admission (REVIEW ONLY)

## Reason for instrumenting server ingress

On the same unchanged source head in Combat4 M343, a real Chrome2 third-party M156 click was sent with original 30 Hz INPUT `attack=true` at ticks 53/54, and processed input ACK highwater advanced to 58. Yet the original Rust World actor remained Idle0 and no 34 HP hit occurred. An ACK highwater confirms only that some later input has been processed: it cannot prove a particular attack sample reached World.set_input. Previous read-only Core8A M156 PR #837 separately proved a successful real 6.7 ms click → light latch → outgoing tick48 → World LightWindup/Active → 34HP hit. A real server-side comparison is needed, not altered W3C timing or a synthetic attack.

## Exact diagnostic boundary

New `MYASO_FLIGHT_INPUT_ADMISSION_TRACE=1` is STRICTLY optional, off by default, accepts only `0/1`, and is prohibited for non-loopback server binds at startup. The dedicated original three-browser M156 runner opts in ONLY for its `uirollknockdownffahit` scenario, alongside preexisting loopback-only M201 authoritative 60 Hz action proof. No new datagrams, ACK, audio, release window or game state are generated.

After actual `decode_input_packet`, trace `M344_V1_RX` when actual original received packet includes an attack/dodge/jump/kick action sample, with the server-owned actor ID, session, genuine packet sequence/tick and action sample ticks/bits. Follow up with only four later received packets after the last action-bearing one. After original `InputIngressWindow::ingest`, trace `M344_V1_INGRESS` with accepted action samples and the actual `coalesce_accepted_input_batch` selected newest tick and attack/heavy booleans. Immediately after existing World lock and `apply_coalesced_input_and_read_tick`, record `M344_V1_WORLD_SET` with the previously captured selection and original World tick. Original `M201_AUTH_ACTION` and `M201_AUTH_HIT` 60 Hz logs are independent World truth; original legacy 16-byte ACK highwater may coalesce multiple accepted ticks.

Important: `M344_V1_WORLD_SET` means the original `World.set_input` call was performed, not that World entered a combat windup or a hit landed; use independent original M201 World events and HP. This diagnostic is current original v1, not an approved v2 `0x11/0x12` ingress. Actor identity is server-issued from the authenticated connection, never read from client input bytes. This is test-only stdout provenance, not publicly available telemetry.

## Investigation matrix

If client sent tick53 action but no `M344_V1_RX` for its action samples, inspect actual QUIC transport/packet redundancy. If decoded but no `M344_V1_INGRESS` accepted action, inspect per-actor ingress dedup/window. If action accepted but selected coalesced newest sample has `attack=false`, inspect coalescing vs single-tick edge preservation. If selected true and World.set_input logged but `M201_AUTH_ACTION` stayed Idle, investigate World.step gating/timing and Combat4 legality under the actual session lease. If M201 hit exists without replicated HP, investigate snapshot/replication.

The scoped new Node source tests and focused authentic M156 native Rust/Chrome/Firefox/Chrome2 workflow do not waive the strict exactly-one 34HP World result. Mandatory exact-head full protected native quality remains required. The earlier intermittent original M156 RED is not repaired by diagnostics. No main merge, v2 activation, staging, deployment, ports or restarts are authorized; Pre-Alpha HOLD.
