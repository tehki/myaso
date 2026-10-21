# UI Department 10 — IDR P0 actual four-browser disguise-preview gate

## Source and purpose

This draft is a test-only child of [IDR phase-1 PR #633](https://github.com/tehki/myaso/pull/633), on exact reviewed parent `54d6bd025a6642bd4f65a8263d26164b5c5c9eec`.

It reuses the existing authoritative Greyhaven+Graphics 3B Blacksmith empty-rack+Chat C1 native browser acceptance's real server launch, pinned TLS and per-browser ChromeDriver/GeckoDriver sessions. A dedicated test uses four **real** W3C browser clients (Chrome/Firefox/Chrome/Firefox), all with the explicit loopback-only `?idrPreview=1`.

Each browser must show exactly one **You** and three **Unknown stranger** scoreboard labels (never a `Player #NN` slot label), a masked status, actual source-authored Greyhaven rack pixels, zero fabricated swords and fresh server snapshots. Genuine chat keyboard submission from player A must receive authoritative ChatResult, appear only for adjacent B/C as **Unknown voice**, and be absent for diagonal distant D. A claimed identity in text must remain unverified, never used as speaker identity.

## Hard trust boundaries

This verifies **browser presentation only**. Raw QUIC messages still expose network IDs and are not proof of identity privacy from technically capable clients. No authenticated SubjectId mapping, per-observer signed knowledge, true identity verification, NPC/Player packet indistinguishability, persistent disguise, actual sword pickup, live equipment or production release is claimed.

Do not hide server/packet ID leakage behind a display claim. The server and game source are unchanged by this child. This is not a gameplay feature flag or a deployment request. Main Orchestrator controls integration, release and rollback.

Native acceptance must be confirmed on the exact head; local source syntax alone is not a browser PASS.
