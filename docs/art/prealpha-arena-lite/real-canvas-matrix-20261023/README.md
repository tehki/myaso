# Graphics 3C real in-game original-vs-Arena-Lite Canvas (source-only review)

**REVIEW / NOT SILVER KNIGHT ART APPROVAL / NOT PRE-ALPHA RELEASE GO.**
These are **full 960x540 PNG frames from the actual in-game #arena Canvas**, captured via original browser canvas.toDataURL('image/png'); NOT standalone artwork and NOT cropped page-viewport screenshots. Both frames use genuine Chromium 152 W3C sessions connecting to the original Rust WebTransport server with four actual authenticated players on one local Linux host.

- Actual optional earth/cobble arena: arena-lite-960x540-real-rust-four-chrome.png, with arenaLite=1.
- Actual default grid: original-grid-960x540-real-rust-four-chrome.png, with no option.

Parent gameplay source is PR #888 at 026029d46f26a85518c0571b1d7b5254bc41a142. This isolated child changes only native validation / CI evidence, not gameplay.

## Crucial source truth

This original baseline still draws ABSTRACT CIRCULAR fighters via Canvas.arc using COMBAT.fighterRadius. The independent authentic Silver Knight sprite drafts are NOT merged into this baseline. Thus real screenshots show circles and cannot certify actual Silver Knight silhouette, source animation or Silver-versus-terrain readability. The QA report explicitly leaves authenticSilverKnightIntegrationVerified = false.

The local benchmark used two separately booted original Rust World instances with four genuine Chrome browsers each, eight authenticated same-host sessions total. The exact-head CI runs native Chrome/Firefox/Chrome/Firefox twice with opposite optional floor flags and archives all eight full Canvas PNGs and corresponding SHA256 reports. Neither run constitutes four independent human-operated hosts, GPU-present timing, or human art signoff.

Local observed original gameplay Canvas floor drawImage frame-callback intervals (not GPU present latency):

| Chromium player slot | Grid p50 / p95 ms | Arena Lite p50 / p95 ms |
| --- | --- | --- |
| #1 | 16.7 / 24.7 | 16.7 / 21.7 |
| #2 | 16.7 / 20.8 | 16.6 / 24.9 |
| #3 | 16.7 / 26.0 | 16.7 / 20.9 |
| #4 | 16.7 / 19.1 | 16.7 / 22.5 |

Grid center source-pixel luminance 26.08; optional terrain 63.93. This is not proven fighter contrast or overall user visual quality. Every PNG in the native matrix undergoes exact dimension 960x540 and content-SHA validation.

**Main Pre-Alpha #695 explicitly excludes optional Graphics work as a mandatory dependency.** Human approval, authentic 3A Silver integration and cross-host Combat acceptance remain future separate gates. No default changes, merge, release, server restart or production deployment.
