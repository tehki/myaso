import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Source-authentic Firefox recovery observer only; real World/HIT/native
// acceptance remains independently mandatory.
const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const begin = source.indexOf("async function runOnlineUiJumpRecoveryFfaPunishFlight(");
const end = source.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(", begin);
const original = source.slice(begin, end);
const tick = String.fromCharCode(96);
const scriptStart = original.indexOf("script: " + tick);
const scriptEnd = original.indexOf(tick + ",\n        args:", scriptStart);
assert.ok(begin >= 0 && end > begin && scriptStart >= 0 && scriptEnd > scriptStart);
const browserObserver = original.slice(scriptStart + ("script: " + tick).length, scriptEnd);

function scenario() {
  let now = 0;
  let callback = null;
  let cleared = 0;
  const completed = [];
  const entries = [];
  let focus = "PUNISH TARGET #1";
  const recovery = {hidden: false, dataset: {state: "jump-attack-recovery"}};
  const document = { querySelector(selector) {
    if (selector === "#opponent-recovery") return recovery;
    if (selector === "#focus-label") return {textContent: focus};
    if (["#player-hp-value", "#player-guard-value", "#bot-hp-value", "#bot-guard-value"].includes(selector))
      return {textContent: "100"};
    throw new Error("unexpected DOM selector " + selector);
  }};
  const world = {__MYASO_M30_UI__: {recoveryTransitions: entries}};
  const script = "(function() {" + browserObserver + "\n}).apply(null, [0,1,900,done]);";
  vm.runInNewContext(script, {
    window: world, document, performance: {now: () => now},
    setInterval(fn, everyMs) {
      assert.equal(everyMs, 4);
      callback = fn;
      return 17;
    },
    clearInterval(id) {
      assert.equal(id, 17);
      cleared++;
    },
    done(value) { completed.push(value); },
  });
  return {
    advance(ms) { now += ms; callback(); },
    addRealCue() {
      entries.push({visible:true,state:"jump-attack-recovery",label:"PUNISH",
        detail:"Jump attack recovery",epochMs:100});
    },
    changeFocus(value) { focus = value; },
    changeRecoveryVisible(visible) { recovery.hidden = !visible; },
    completed, get cleared() {return cleared;},
  };
}

test("real recovery focus remains genuinely eligible 30ms before native click cue resolves", () => {
  const s = scenario();
  s.advance(100);
  s.addRealCue();
  s.advance(4);
  assert.equal(s.completed.length, 0);
  s.advance(25);
  assert.equal(s.completed.length, 0);
  s.advance(5);
  assert.equal(s.completed.length, 1);
  assert.equal(s.completed[0].epochMs, 100);
  assert.equal(s.completed[0].focusLabel, "PUNISH TARGET #1");
  assert.equal(s.cleared, 1);
});

test("stale focus or hidden recovery restarts bounded genuine cue verification", () => {
  const s = scenario();
  s.addRealCue();
  s.advance(5);
  s.changeFocus("NEAREST #3");
  s.advance(5);
  s.changeFocus("PUNISH TARGET #1");
  s.advance(5);
  s.advance(24);
  assert.equal(s.completed.length, 0);
  s.changeRecoveryVisible(false);
  s.advance(1);
  s.changeRecoveryVisible(true);
  s.advance(1);
  s.advance(29);
  assert.equal(s.completed.length, 0);
  s.advance(1);
  assert.equal(s.completed.length, 1);
  assert.equal(s.cleared, 1);
});

test("unqualified native recovery cue fails closed on original deadline", () => {
  const s = scenario();
  s.advance(901);
  assert.equal(s.completed.length, 1);
  assert.equal(s.completed[0], null);
  assert.equal(s.cleared, 1);
});

test("native 30ms stability preserves one real W3C click and original strict World HIT", () => {
  assert.match(original, /await performArenaM221GuardBreakClick\(observer, 0\)/);
  assert.match(original, /now - stableSince >= 30/);
  assert.match(original, /if \(now - started >= timeoutMs\)/);
  assert.match(original, /verifyM147WorldRecoveryProof\(/);
  assert.match(original, /punishDown\.epochMs < recovery\.epochMs/);
  assert.match(original, /punishDown\.epochMs < recoveryCue\.epochMs/);
  assert.doesNotMatch(original.slice(scriptEnd, original.indexOf("await performArenaM221GuardBreakClick(observer, 0)")),
    /await sleep\(/, "no WebDriver sleep between valid cue and authentic input");
});
