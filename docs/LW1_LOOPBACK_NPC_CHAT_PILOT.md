# LW-1 — Loopback NPC Conversation Pilot

Status: **implemented in draft PR #353; not merged, deployed, or AI-backed**.
The pilot is independent of the normal alpha. It is off by default, and the server **refuses to enable it on a non-loopback bind**.

## Local test

Start the Rust server with a development certificate and pilot activated:

```sh
MYASO_NPC_PILOT=1 cargo run --locked --manifest-path server/Cargo.toml
```

In another terminal at the repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/web/?server=https://localhost:4433/game&cert=<SHA256_HASH>`, where `<SHA256_HASH>` is the hex-encoded short-lived development certificate hash printed by the server (without punctuation). The browser pins this fingerprint using its existing authoritative client. Enable game audio only by user gesture; nothing changes sound behavior.

When the server provides the NPC roster, five named **staging markers** appear near the initial combat spawn and a chat panel appears below the arena. Press **Enter** with the arena focused, or click the chat input. Select an NPC and type a short single-line message. All requests run on a reliable stream; the server validates the session's current alive state and its actual world-space distance to the selected NPC (180 units).

Try `hello`, `my name is Rose`, `remember me`, `news`, `trade` and `quest`. Names and acquaintance persist **only for the current connection**. The behavior is scripted, not an external model: NPCs do not invent rewards, merchants, crimes or world facts. There is no text-to-item or world-mutation path.

To disable the feature, unset `MYASO_NPC_PILOT` or set it to `0`. Starting with `MYASO_BIND=0.0.0.0:4433 MYASO_NPC_PILOT=1` fails closed even with an otherwise valid TLS certificate.

## Runtime limits

- Staging map markers **are not** movable/collidable fighter entities, NPC routines, learned relationships or completed Greyhaven art. Their positions are fixed, server-advertised read-only anchors.
- Requests: max **240 UTF-8 bytes**, one line, strict framing and version checks. Packet request type 5, NPC answer type 6, NPC roster type 7; the existing protocol version (1) and combat packet types (1–4) are unchanged. Reliable frames are length-prefixed with a u16 LE count.
- Responses are point-to-point and bounded; the server enforces per-connection cooldown (850ms) and can fail its reader on malformed framing. The session-local NPC reader uses a separate async task and never waits for a model or storage inside the 60 Hz world tick.
- NPC memory is a small in-process per-connection acquaintance set and optional self-declared *cosmetic* nickname. It is never a verified user name or cross-session identity and cannot authorize purchases, rewards or private information disclosure.
- The browser shows up to 12 recent lines during the active chat session using `textContent`. The server writes no chat bodies, prompts or nicknames to logs or persistent storage. The UI state disappears when the tab/session ends.
- The full, persistent living-world architecture remains the roadmap in `docs/MOON_LIVING_WORLD_AI.md`; LW-0 identity/consent, actual world objects/navigation, scheduled NPC simulation, persistent event/relationship storage, and AI provider are still separate future tasks.

## Test expectations and nonclaims

- `node --test tests/networking.test.mjs tests/m6-browser-authority.test.mjs tests/browser-runtime.test.mjs`
- `cargo fmt --all --manifest-path server/Cargo.toml -- --check`
- `cargo check --locked --manifest-path server/Cargo.toml`
- `cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings`
- `cargo test --locked --manifest-path server/Cargo.toml`
- Full protected GitHub `quality` and authentic browser acceptance before merging.

Nothing in this pilot indicates that hosted inference, durable player memory, NPC travel, inventories, quests, voice, free-for-all loot or live Greyhaven state is present. Do not deploy this experimental path to the shared production VPS.
