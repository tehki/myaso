# Core 8C: bounded C1 stream-registration retry after rejection (nonrelease)

Issue #1085 / Core 8C #1088. Main0 integrated candidate #1094 owns activation.

The original integrated Chat C1 code set `chat_started = true` immediately
after accepting the first optional client uni stream, **before** it had
registered the current original-World player with the chat hub. If the actor
was temporarily ineligible (e.g. before World respawn), or the bounded hub
lock was busy, the optional stream was dropped and this authenticated game
session could never open a working C1 stream afterward.

This scoped fix:
- keeps every sender bound to the current server-issued player ID/lease;
- attempts registration through the same original World-position and
  current-session gate as before, using only nonblocking chat `try_lock`;
- sets `chat_started=true` **only on successful hub registration**;
- enforces a 500 ms cooldown after failed registration to prevent an
  unbounded stream-opening retry loop from monopolizing gameplay;
- leaves game datagrams/World physics, damage, chat payload framing and
  chat enabled/default-OFF gates entirely unchanged.

The explicit async test recreates a missing actor, a spoofed old lease,
transient hub-lock contention, an actual World spawn/rejoin, and duplicate
subscription denial. It requires the later current lease to succeed and
does not waive any native Combat or Chat CI failures.

No public chat is enabled or deployed by this Draft. Main0 retains source
integration and release authority; independent Combat4D acceptance remains
mandatory.
