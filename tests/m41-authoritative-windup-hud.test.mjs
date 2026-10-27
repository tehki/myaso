import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMBAT_ACTION} from '../src/browser/combat-readability.mjs';
import {authoritativeWindupHudHint} from '../src/browser/authoritative-windup-hud.mjs';

test('only server-replicated Light/Heavy Windup may surface an early readable HUD cue', () => {
  assert.equal(authoritativeWindupHudHint({action:COMBAT_ACTION.attackWindup}),
    'Attack committed - your windup is readable.');
  assert.equal(authoritativeWindupHudHint({action:COMBAT_ACTION.heavyAttackWindup}),
    'Heavy strike committed - the long windup is readable.');
  for(const action of [0,2,3,6,7,16,17,18,19]) assert.equal(authoritativeWindupHudHint({action}),null);
  assert.equal(authoritativeWindupHudHint(null),null);
  assert.equal(authoritativeWindupHudHint({action:COMBAT_ACTION.attackWindup},
    {now:100,combatMessage:'Hit taken - 34 HP.',combatMessageUntil:125}),null);
  assert.equal(authoritativeWindupHudHint({action:COMBAT_ACTION.attackWindup},
    {now:126,combatMessage:'Hit taken - 34 HP.',combatMessageUntil:125}),
    'Attack committed - your windup is readable.');
});
test('original snapshot pipeline presents genuine actor-bound cue before RAF without sending combat input', () => {
  const source=readFileSync(new URL('../web/online-game.mjs', import.meta.url),'utf8');
  const start=source.indexOf('function observeCombatState(state) {');
  const end=source.indexOf('function observeThreatCommitment(',start);
  const observe=source.slice(start,end);
  assert.match(observe,/const originalWindupHint = authoritativeWindupHudHint\(state\.get\(ownId\),/);
  assert.match(observe,/if \(originalWindupHint\) setStatus\(originalWindupHint\)/);
  assert.ok(observe.indexOf('if (originalWindupHint) setStatus') < observe.indexOf('const event = combatReadability.observe'));
  assert.doesNotMatch(observe,/networkClient\.sendInput|currentInput|simulatePrediction/);
  assert.match(source,/function updateHud\(ownId\)/);
});
