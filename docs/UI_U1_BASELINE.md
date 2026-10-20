# UI U1 — Baseline audit and compact combat controls

Audited 2026-10-20 against main at 7c5fe9b08e86254cff9e05ae07c1d0d572cb7879.
Department: UI & Player Experience. Risk LOW; FULL quality before merge.
This report documents real main, not aspirational or unmerged game features.

## Current player-facing architecture

- Native HTML, CSS, JS ES modules, no React/framework dependency.
- web/bootstrap.mjs loads game.mjs for offline sparring or online-game.mjs
  for authoritative multiplayer. Both share the canvas, HUD and controls.
- web/index.html + styles.css define a three-column HUD, health, guard,
  stamina, event text, rival details, heavy-charge meter, threat cues,
  scoreboard, kill feed and network diagnostics over a 16:9 canvas.
- Input is handled in game/online-game modules. The shared right-button
  classifier distinguishes RMB tap kick from 180 ms RMB hold run; LMB is
  release-to-strike with a 320 ms heavy READY charge; wheel and Space retain
  their established combat actions. These semantics are Combat-owned.
- Online presentation receives server snapshots, with prediction and
  reconciliation; UI cannot invent successful authoritative operations.
- web/alpha.html and alpha.css are the separate multiplayer lobby.
- UI styling is ad hoc; native node:test suites, Rust checks and stringent
  genuine browser tests execute in the existing protected quality workflow.

## Most disruptive usability issues

1. The full, permanent masthead binding list displaces the arena and forces
   new players to scan advanced combos before seeing essential input actions.
2. Basic versus advanced guidance has no disclosure hierarchy.
3. No consistent semantic design tokens or shared panel/slot/window patterns.
4. Inventory, magic, property and economic UI cannot be wired until the
   relevant authoritative contracts and APIs become available. Do not create
   fictional local item movement, balances or transaction confirmations.

## U1 improvement and constraints

- Use native, keyboard-accessible details/summary around the original complete
  control legend, collapsed by default, with concise essential actions always
  visible. With JavaScript disabled, the original full controls remain.
- Add only a dedicated lightweight module/style and one bootstrap call;
  do not edit index.html (Sound PR #355), styles.css (AI PR #353), or
  online-game.mjs (Physics PR #357, Graphics PR #326).
- Preserve wheel scroll prevention, LMB/RMB/Space ordering, stamina, real
  multiplayer feedback, combat timing, sound, simulation and wire protocol.
  No extra gameplay listeners, overlays, polling, persistence or deployment.
- Dependency gates: Combat owns mechanics; Magic & Items #354 owns physical
  inventory and item actions; Economics #358 owns ledger/trading rules;
  Core owns server authority; World owns property placement; Graphics/Sound
  own their respective presentation layers. Do not merge ahead of central CI.

## Future UI design system (proposal only)

Share semantic foreground/surface/border/focus/status tokens and spacing.
Introduce reusable accessible panels, item slots, meters, notifications and
server-confirmed transaction dialogs as real backend contracts arrive. Keep
critical information visible but clear the center of the arena.

## Acceptance and rollback

Tests: new ui-control-guide.test.mjs is imported by the already protected
R2 combat-control suite. Validate node syntax, targeted Node tests and the
full genuine browser/Rust quality workflow on exact PR head. Also smoke
keyboard disclosure activation and mobile wrapping in a real browser.
Revert the bootstrap module install to return to the original full legend.
Do not merge/deploy independently; submit to Moon Games Development Center.
