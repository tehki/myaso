# Graphics 3A — genuine four-player Silver Knight browser screenshots

This independent test-only child of PR #742 captures **actual native WebDriver browser PNG screenshots** from four real local Rust-server connected Chrome/Firefox game clients, only AFTER strict four-client authority/source acceptance passes.

Parent PR #742 [run #39725864164](https://github.com/tehki/myaso/actions/runs/39725864164) already proved four distinct authoritative browser-player IDs, four original Silver Knight sprites in each client's real Canvas, and W3C movement. It provided authoritative logs, not viewable screenshot artifacts.

The new independent **graphics3a-native-four-silver-screenshots** job runs the same local Rust server with native Chrome, Firefox, Chrome #2 and Chrome #3. An explicit opt-in after successful real four-person Silver source verification requests each browser's native W3C **GET /session/{id}/screenshot** endpoint. It refuses missing/non-PNG output, writes eight unmodified W3C PNG files (four full browser viewports and four native arena element screenshots), and records exact per-file SHA-256 digest and server player ID in a manifest. The job uploads those PNGs and manifest as a one-day Actions artifact for Main/Art review. Artifact upload failure remains a reported CI failure, not silently accepted.

This is not simulated sprite art or a generated illustration. These are automated real browser sessions, NOT four independent human operators. PNG presence does not demonstrate successful real hitboxes, guard/parry/hit/knockback, four-way full jump/roll, authoritative exact timestamps, 0.84 Greyhaven city, deployment or player usability. Inspect the actual screenshots before providing aesthetic approval.

Manual QA command, on supported Rust + ChromeDriver + GeckoDriver host:

    cargo build --locked --manifest-path server/Cargo.toml --bin myaso-server
    MYASO_PVP_SCENARIO=uiidentity MYASO_GRAPHICS3A_PREALPHA_SILVER_FLIGHT=1 MYASO_GRAPHICS3A_PREALPHA_FOUR_FLIGHT=1 MYASO_GRAPHICS3A_FOUR_NATIVE_PNG=1 node scripts/pvp_browser_flight_runner.mjs

Output directory: .graphics3a-real-four-silver-native-png ; files: prealpha_real_four_silver_chrome.png, prealpha_real_four_silver_firefox.png, prealpha_real_four_silver_chrome2.png, prealpha_real_four_silver_chrome3.png and, for each browser, corresponding prealpha_real_four_silver_{browser}_arena.png, plus native_browser_evidence.json.

NO production gameplay, existing original Silver source art, authoritative Rust server, controls, roll/jump/Combat timing, or default client setting changes. Mandatory separate full protected quality and Combat #696, real four-person human smoke and Main Orchestrator #695 GO remain HOLD. Owner-approved Spartan Kick #611/#617 excluded from minimal Pre-Alpha 0.1.

Native arena element screenshots resolve #arena through real W3C DOM and request /session/{id}/element/{arenaId}/screenshot. They are not crops or reconstructed art; they are actual browser element screenshots. Retain unmodified full viewport images for accurate UI context, and arena images for complete visibility (Firefox's natural initial page scroll otherwise truncates the arena in the viewport). Both sets are SHA-256 verified and must be inspected by a human.
