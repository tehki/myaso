# Core8A — two browser sessions / one original Rust World / Main-selected release-only

**DRAFT / NONRELEASE.** Direct test-only child of Main-selected #887
release-to-strike KeyE ancestry, which inherits #862->#855->#852. No
server, Combat, UI, World, wire format, timeout or acceptance thresholds
are modified. Do not port auto-KeyE runtime from #858/#868 descendants.

The new exact-head focused CI test starts one original compiled Rust
myaso-server loopback-only with deliberate default-OFF v2 opt-in and
ephemeral TLS pin. TWO independent OS chromedriver/Chromium browser
sessions negotiate TWO real pinned WebTransport connections and receive
original server-supplied grants on the same original Rust World
BEFORE any W3C physical Combat input. Each imports the SAME existing
Core8A original shared typed outbox source separately with an opaque
own session lease, per-lease independent global sequence / gesture IDs,
server ACK receipt & transport-only settlement (ACK != HIT).

Actor1: genuine first Chrome W3C physical LMB down, KeyE down/up BUSY
during original LMB 135ms windup, same-pointer LMB up. Original World
must enter fighter1 LightWindup1 to LightActive2 EXACTLY once, while
busy source1 cannot start a second heavy. All four exact source-bound
original 0x12 ACCEPTED receipts for its lease must be processed by its
real unchanged shared outbox, pending 0 / closed false.

Actor2: a second process, second native QUIC seat and independently
W3C trusted physical KeyE keyDOWN must enter true original World
fighter2 HeavyWindup9, with its own ACCEPTED server tick ACK sequence1.
Keep key physically DOWN for >320ms server READY; forbid even ONE
HeavyActive10 while held. Only its real trusted physical matching
KeyE keyUP and separate seq2 genuine original 0x12 ACK can commit
ONE World HeavyActive10. Require original World-tick receipts,
independent private queue pending0 / open and transportSettled true
but combatCommitted false. No invented HP evidence or synthetic DOM.

The accepted action path on this branch is identical to main-selected
release-to-strike contract (#723). Auto-KeyE #874's physical two-browser
script provided TEST PATTERN ONLY and cannot be substituted for this
new release semantics.

CI success on this test would prove two independent actual Chromium
processes on ONE hosted CI computer, not independently operated humans
on physically separate computers and not the real production
web/online-game.mjs client. This does not prove actor respawn lease
regrant, browser human identity or original M-series acceptance,
and MUST NOT be treated as Pre-Alpha GO. Local desktop browser launches
may be resource-limited and must NOT interfere with user processes.
NO MAIN merge/stage/restart/deploy/public protocol v2.
