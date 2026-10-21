import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IDR_UNKNOWN, isIdrPreviewEligible, idrLabelFromProjection, idrScoreboardRows,
  idrChatSender, idrKillFeedText, idrFocusText, idrStatusText,
} from "../src/browser/identity-visibility.mjs";
import { openLocalChatUiBridge } from "../src/network/local-chat-ui-bridge.mjs";

test("IDR preview only eligible over explicit loopback HTTP; no public activation", () => {
  const input = (protocol, hostname, search) => ({protocol, hostname, search});
  assert.equal(isIdrPreviewEligible(input("http:", "127.0.0.1", "?idrPreview=1")), true);
  assert.equal(isIdrPreviewEligible(input("http:", "localhost", "?idrPreview=1")), true);
  assert.equal(isIdrPreviewEligible(input("http:", "[::1]", "?idrPreview=1")), true);
  for (const value of [
    input("https:", "localhost", "?idrPreview=1"),
    input("http:", "myaso.io", "?idrPreview=1"),
    input("http:", "127.0.0.1.evil.test", "?idrPreview=1"),
    input("http:", "127.0.0.1", "?idrPreview=0"),
    input("http:", "127.0.0.1", ""),
  ]) assert.equal(isIdrPreviewEligible(value), false);
});

test("without vetted server evidence an observer sees no true player or NPC identity", () => {
  assert.equal(idrLabelFromProjection(null), IDR_UNKNOWN);
  assert.equal(idrLabelFromProjection({certainty:"unknown", label:"Admin"}), IDR_UNKNOWN);
  assert.equal(idrLabelFromProjection({certainty:"claimed", label:"Calls themselves Aldric"}), "Calls themselves Aldric");
  assert.equal(idrLabelFromProjection({certainty:"verified", label:"Aldric"}), "Aldric");
  for (const label of ["A\u202eFake", "Bad\nName", "", "A".repeat(101)]) {
    assert.equal(idrLabelFromProjection({certainty:"verified", label}), IDR_UNKNOWN);
  }
});

test("anonymous scoreboard preserves score/roster but not a player category or net ID label", () => {
  const original = [{netId:1, kills:2, own:true, label:"#1"}, {netId:42,kills:1,own:false,label:"#42"}];
  const rows = idrScoreboardRows(original);
  assert.deepEqual(rows, [
    {netId:1,kills:2,own:true,label:"You"},
    {netId:42,kills:1,own:false,label:IDR_UNKNOWN},
  ]);
  assert.equal(original[1].label, "#42");
});

test("chat claims are unverified; speaker labels do not derive public identity from net slot", () => {
  const event = Object.freeze({channel:"local", text:"I am the captain!", serverMessageId:"m-1",
    sender:Object.freeze({displayName:"Player #42"})});
  const hidden = idrChatSender(event);
  assert.equal(hidden.sender.displayName, "Unknown voice");
  assert.equal(hidden.text, "I am the captain!");
  assert.equal(event.sender.displayName, "Player #42");
  assert.equal(idrChatSender({channel:"system", sender:{displayName:"System"}}).sender.displayName, "System");
});

test("native combat labels do not reveal provisional player net IDs in IDR preview", () => {
  assert.equal(idrKillFeedText({killer:42, victim:4}, 4), "Unknown stranger defeated you");
  assert.equal(idrKillFeedText({killer:4, victim:42}, 4), "You defeated Unknown stranger");
  assert.equal(idrFocusText("guard-break", true), "GUARD BREAK · UNKNOWN");
  assert.equal(idrFocusText("nearest", false), "NO RIVAL");
  assert.equal(idrStatusText("Online - player #4 - server tick 20"), "Online - connected character - server tick 20");
  assert.equal(idrStatusText("PARRY PUNISH #42"), "PARRY PUNISH unknown");
});

test("actual authenticated chat adapter exposes anonymous sender only on explicit IDR opt-in", async () => {
  async function receivePreview(identityPreview) {
    let onReceived;
    let finished;
    const reading = new Promise(resolve => { finished = resolve; });
    const wire = {
      closed:false, reading,
      send:async () => {},
      async close(){wire.closed=true; finished();},
    };
    const ui = await openLocalChatUiBridge({}, {identityPreview, openChannel: async (_conn, callbacks) => {
      onReceived = callbacks.onReceived;
      return wire;
    }});
    const received = [];
    ui.subscribe(message => received.push(message));
    onReceived({kind:"received", channel:1, senderId:42, messageId:24n, text:"I am a Sentinel"});
    await ui.close();
    return received;
  }
  const original = await receivePreview(false);
  const hidden = await receivePreview(true);
  assert.equal(original[0].sender.displayName, "Player #42");
  assert.equal(hidden[0].sender.displayName, "Unknown voice");
  assert.equal(hidden[0].text, "I am a Sentinel");
  assert.equal(hidden[0].serverMessageId.endsWith("-24"), true);
});
