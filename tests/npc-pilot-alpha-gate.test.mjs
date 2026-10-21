import test from "node:test";
import assert from "node:assert/strict";
import { createNpcChatPanel } from "../web/npc-chat.mjs";

// Minimal isolated DOM fixture. This checks the actual optional browser
// module, but is NOT a real Chrome/Firefox/WebTransport acceptance.
class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.hidden = false;
    this.value = "";
    this.textContent = "";
    this.listeners = new Map();
    this.focused = false;
    this.attributes = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  addEventListener(event, listener) { this.listeners.set(event, listener); }
  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
    if (this.tag === "select" && this.children.length && !this.value) {
      this.value = this.children[0].value;
    }
  }
  replaceChildren(...nodes) {
    this.children.length = 0;
    this.value = "";
    this.append(...nodes);
  }
  remove() {
    const index = this.parent?.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
  }
  focus() {
    if (globalThis.document.activeElement) globalThis.document.activeElement.focused = false;
    globalThis.document.activeElement = this;
    this.focused = true;
  }
  blur() {
    if (globalThis.document.activeElement === this) globalThis.document.activeElement = null;
    this.focused = false;
  }
  get firstElementChild() { return this.children[0] ?? null; }
  get options() { return this.children; }
  get scrollHeight() { return this.children.length; }
}

function installDocument() {
  const stage = new Element("div");
  const canvas = new Element("canvas");
  const original = globalThis.document;
  globalThis.document = {
    activeElement: null,
    createElement(tag) { return new Element(tag); },
    querySelector(selector) {
      if (selector === ".arena-wrap") return stage;
      if (selector === "#arena") return canvas;
      return null;
    },
  };
  return { stage, canvas, restore() {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  } };
}

test("P0 NPC-off alpha has no accessible conversation or send until valid pilot roster", async () => {
  const { stage, restore } = installDocument();
  try {
    const sent = [];
    let divertedFocus = 0;
    const npc = createNpcChatPanel({
      onSend: async (id, text) => sent.push({ id, text }),
      onFocus: () => { divertedFocus += 1; },
    });
    const panel = stage.children[0];
    assert.equal(stage.children.length, 1);
    assert.equal(panel.hidden, true);
    assert.equal(npc.enabled, false);
    assert.deepEqual(npc.npcs, []);
    const [,, roster,,, history, form] = panel.children;
    const [input] = form.children;
    const submit = async () => form.listeners.get("submit")({
      preventDefault() {},
    });

    // A server snapshot, site status or supply report cannot activate chat
    // before the only enabled signal: a nonempty validated roster.
    npc.updateState({ tick: 60, states: [{ id: 3, x: 200, y: 150, activity: 1 }] });
    npc.updateSupplies({ tick: 60, sequence: 0, stocks: {
      wellWater: 8, tomasWater: 0, yardWater: 0,
      depotFood: 8, elaraFood: 0, stallFood: 0,
      forgeIron: 6, forgeNails: 0,
    }, lastActor: 0, lastOperation: 0 });
    npc.setObstacles([{ x: 100, y: 100, width: 20, height: 20 }]);
    npc.setWorksites([{ id: 1, name: "Yard" }]);
    npc.updateWorksiteStatus({ revision: 2, active: [true, true, true, true, true] });
    npc.receive({ text: "Ignored pilot packet cannot enable a game control" });
    npc.focus();
    input.value = "try chat before roster";
    roster.value = "3";
    await submit();
    assert.equal(panel.hidden, true);
    assert.equal(npc.enabled, false);
    assert.equal(divertedFocus, 0);
    assert.equal(sent.length, 0);

    npc.setRoster([{ id: 3, x: 155, y: 205, name: "Rowan", role: "Guard" }]);
    assert.equal(panel.hidden, false);
    assert.equal(npc.enabled, true);
    assert.equal(roster.value, "3");
    npc.focus();
    assert.equal(divertedFocus, 1);
    assert.equal(input.focused, true);
    input.value = "Where is the yard?";
    await submit();
    assert.deepEqual(sent, [{ id: 3, text: "Where is the yard?" }]);
    assert.equal(input.value, "");

    // Losing the roster prevents later accidental chat submissions,
    // including an input left in the former form by a stale UI task.
    npc.setRoster([]);
    assert.equal(panel.hidden, true);
    assert.equal(npc.enabled, false);
    input.value = "stale client request";
    roster.value = "3";
    await submit();
    npc.focus();
    assert.equal(sent.length, 1);
    assert.equal(divertedFocus, 1);
    assert.equal(history.children.length, 0, "revoked pilot transcript is cleared");
    assert.equal(globalThis.document.activeElement?.tag, "canvas",
      "revoking the focused NPC roster restores gameplay input focus");
  } finally {
    restore();
  }
});

test("pilot roster generation fences stale async sends and recycled UI state", async () => {
  const { stage, restore } = installDocument();
  try {
    const pending = [];
    const npc = createNpcChatPanel({
      onSend(id, text) {
        return new Promise((resolve, reject) => pending.push({ id, text, resolve, reject }));
      },
      onFocus() {},
    });
    const panel = stage.children[0];
    const [,, roster,,, history, form] = panel.children;
    const [input, sendButton] = form.children;
    const submit = () => form.listeners.get("submit")({ preventDefault() {} });
    const rowan = [{ id: 3, x: 155, y: 205, name: "Rowan", role: "Guard" }];
    const tomas = [{ id: 5, x: 270, y: 220, name: "Tomas", role: "Laborer" }];

    npc.setRoster(rowan);
    input.value = "Old session message";
    const first = submit();
    assert.equal(sendButton.disabled, true);
    assert.deepEqual(pending.map(({ id, text }) => [id, text]), [[3, "Old session message"]]);
    // Enter can submit forms while a button is disabled. Do not create a
    // second reliable NPC write until this one succeeds or fails.
    await submit();
    assert.equal(pending.length, 1, "only one outstanding NPC chat per roster");
    assert.equal(sendButton.disabled, true);

    npc.setRoster([]);
    assert.equal(panel.hidden, true);
    assert.equal(sendButton.disabled, false);
    assert.equal(input.value, "");
    assert.equal(history.children.length, 0);
    npc.receive({ text: "Late reply for revoked session" });
    assert.equal(history.children.length, 0);

    npc.setRoster(tomas);
    assert.equal(roster.value, "5");
    input.value = "New session draft";
    pending[0].resolve();
    await first;
    assert.equal(input.value, "New session draft",
      "an old promise cannot erase a new session's typed text");
    assert.equal(history.children.length, 0,
      "an old successful send cannot appear under a newer NPC roster");
    assert.equal(sendButton.disabled, false);

    const second = submit();
    assert.deepEqual(pending.at(-1) && [pending.at(-1).id, pending.at(-1).text],
      [5, "New session draft"]);
    await submit();
    assert.equal(pending.length, 2, "no duplicate while second session send is pending");
    pending.at(-1).resolve();
    await second;
    assert.equal(history.children.length, 1);
    assert.match(history.children[0].textContent, /Tomas: New session draft/);
    assert.equal(input.value, "");
    npc.receive({ id: 3, text: "Rowan did not answer Tomas’s question" });
    assert.equal(history.children.length, 1, "wrong NPC cannot consume queued reply");
    npc.receive({ id: 5, text: "Tomas responds" });
    assert.equal(history.children.length, 2);
    npc.receive({ id: 5, text: "Unsolicited duplicate" });
    assert.equal(history.children.length, 2, "duplicate is not an authorized pending response");

    input.value = "Pending old failure";
    const third = submit();
    assert.equal(sendButton.disabled, true);
    await submit();
    assert.equal(pending.length, 3);
    npc.setRoster([]);
    npc.setRoster(rowan);
    pending.at(-1).reject(new Error("Connection closed"));
    await third;
    assert.equal(sendButton.disabled, false);
    assert.equal(history.children.length, 0,
      "an old failed request cannot leak error text into a new roster");
    npc.receive({ id: 3, text: "Old/unsolicited server response" });
    assert.equal(history.children.length, 0,
      "without a locally submitted message, a reply cannot appear in the new conversation");
  } finally {
    restore();
  }
});

test("pilot chat releases its one-flight gate after same-roster send failure", async () => {
  const { stage, restore } = installDocument();
  try {
    const attempts = [];
    let fail = true;
    const npc = createNpcChatPanel({
      async onSend(id, text) {
        attempts.push([id, text]);
        if (fail) throw new Error("reliable stream closed");
      },
      onFocus() {},
    });
    npc.setRoster([{ id: 2, name: "Marta", role: "Blacksmith" }]);
    const [,, roster,,, history, form] = stage.children[0].children;
    const [input, button] = form.children;
    assert.equal(roster.value, "2");
    const submit = () => form.listeners.get("submit")({ preventDefault() {} });
    input.value = "Are swords available?";
    await submit();
    assert.equal(button.disabled, false);
    assert.equal(input.value, "Are swords available?",
      "failure should not discard the player's draft");
    assert.equal(history.children.length, 1);
    assert.equal(history.children[0].textContent, "Unable to send your message.");
    npc.receive({ id: 2, text: "Rejected write cannot authorize a reply" });
    assert.equal(history.children.length, 1,
      "send failure must release any pending reply entitlement");

    fail = false;
    await submit();
    assert.deepEqual(attempts, [[2, "Are swords available?"], [2, "Are swords available?"]]);
    assert.equal(button.disabled, false);
    assert.equal(input.value, "");
    assert.match(history.children[1].textContent, /Marta: Are swords available/);
    npc.receive({ id: 2, text: "Marta confirms" });
    assert.equal(history.children[2].textContent, "Marta confirms");
    npc.receive({ id: 2, text: "Duplicate after successful reply" });
    assert.equal(history.children.length, 3);
  } finally {
    restore();
  }
});

test("pilot replies require matching sent NPC and bounded outstanding queue", async () => {
  const { stage, restore } = installDocument();
  try {
    const actual = [];
    const npc = createNpcChatPanel({
      async onSend(id, text) { actual.push([id, text]); },
      onFocus() {},
    });
    const panel = stage.children[0];
    const [,, roster,,, history, form] = panel.children;
    const [input] = form.children;
    const submit = () => form.listeners.get("submit")({ preventDefault() {} });
    const names = [
      { id: 3, x: 155, y: 205, name: "Rowan", role: "Guard" },
      { id: 5, x: 270, y: 220, name: "Tomas", role: "Laborer" },
    ];
    npc.setRoster(names);
    assert.equal(roster.value, "3");
    npc.receive({ id: 3, text: "Forged old reply" });
    assert.equal(history.children.length, 0, "unsolicited reply cannot appear");

    input.value = "First question";
    await submit();
    npc.receive({ id: 5, text: "Wrong NPC" });
    assert.equal(history.children.length, 1);
    npc.receive({ id: 3, text: "Expected Rowan reply" });
    assert.equal(history.children.length, 2);
    npc.receive({ id: 3, text: "Duplicate reply" });
    assert.equal(history.children.length, 2);

    // A silent server must not grow a local unbounded reply backlog.
    for (let i = 0; i < 12; i += 1) {
      input.value = "Queued " + i;
      await submit();
    }
    assert.equal(actual.length, 13);
    input.value = "Overflow";
    await submit();
    assert.equal(actual.length, 13, "one roster cannot enqueue an unbounded backlog");
    assert.match(history.children.at(-1).textContent, /Waiting for NPC replies/);
    npc.receive({ id: 5, text: "Wrong ID must not release cap" });
    await submit();
    assert.equal(actual.length, 13);
    npc.receive({ id: 3, text: "Reply to queued 0" });
    input.value = "Capacity restored";
    await submit();
    assert.equal(actual.length, 14);

    // A new authoritative roster resets the pending reply obligations.
    npc.setRoster([{ id: 5, x: 270, y: 220, name: "Tomas", role: "Laborer" }]);
    npc.receive({ id: 3, text: "Stale Rowan answer" });
    assert.equal(history.children.length, 0);
    input.value = "Hello Tomas";
    await submit();
    npc.receive({ id: 5, text: "Welcome" });
    assert.equal(history.children.at(-1).textContent, "Welcome");
  } finally {
    restore();
  }
});

test("early NPC reply waits until its locally accepted question is shown", async () => {
  const { stage, restore } = installDocument();
  try {
    const sends = [];
    const npc = createNpcChatPanel({
      onSend(id, message) {
        return new Promise((resolve, reject) => sends.push({ id, message, resolve, reject }));
      },
      onFocus() {},
    });
    npc.setRoster([{ id: 3, name: "Rowan", role: "Guard" }]);
    const [,,,,, history, form] = stage.children[0].children;
    const [input, button] = form.children;
    const submit = () => form.listeners.get("submit")({ preventDefault() {} });
    input.value = "Tell me what you saw";
    const sending = submit();
    assert.equal(button.disabled, true);
    assert.equal(sends.length, 1);
    npc.receive({ id: 3, text: "Rowan: I saw a guard near the yard." });
    assert.equal(history.children.length, 0,
      "do not show NPC answer before local send settles");
    npc.receive({ id: 3, text: "Duplicate early reply" });
    assert.equal(history.children.length, 0);
    sends[0].resolve();
    await sending;
    assert.equal(history.children.length, 2);
    assert.match(history.children[0].textContent, /You → Rowan: Tell me what you saw/);
    assert.equal(history.children[1].textContent, "Rowan: I saw a guard near the yard.");
    assert.equal(input.value, "");
    assert.equal(button.disabled, false);
    npc.receive({ id: 3, text: "Late duplicate" });
    assert.equal(history.children.length, 2);
  } finally {
    restore();
  }
});

test("early NPC reply is discarded if the corresponding write rejects or roster expires", async () => {
  const { stage, restore } = installDocument();
  try {
    const sends = [];
    const npc = createNpcChatPanel({
      onSend(id, message) {
        return new Promise((resolve, reject) => sends.push({ id, message, resolve, reject }));
      },
      onFocus() {},
    });
    const [,,,,, history, form] = stage.children[0].children;
    const [input, button] = form.children;
    const submit = () => form.listeners.get("submit")({ preventDefault() {} });
    npc.setRoster([{ id: 5, name: "Tomas", role: "Laborer" }]);
    input.value = "First attempted send";
    const first = submit();
    npc.receive({ id: 5, text: "Unconfirmed Tomas reply" });
    assert.equal(history.children.length, 0);
    sends[0].reject(new Error("Transport write rejected"));
    await first;
    assert.deepEqual(history.children.map((li) => li.textContent), [
      "Unable to send your message.",
    ]);
    assert.equal(input.value, "First attempted send");
    assert.equal(button.disabled, false);
    npc.receive({ id: 5, text: "Failed-send reply must not display" });
    assert.equal(history.children.length, 1);

    input.value = "New request on original roster";
    const second = submit();
    npc.receive({ id: 5, text: "Another early reply" });
    npc.setRoster([]);
    npc.setRoster([{ id: 3, name: "Rowan", role: "Guard" }]);
    sends[1].resolve();
    await second;
    assert.equal(history.children.length, 0,
      "a successful but revoked request must not resurrect its reply");
    assert.equal(button.disabled, false);
    npc.receive({ id: 5, text: "Old roster answer" });
    assert.equal(history.children.length, 0);
    input.value = "New current question";
    const third = submit();
    sends[2].resolve();
    await third;
    npc.receive({ id: 3, text: "Correct current reply" });
    assert.deepEqual(history.children.map((li) => li.textContent), [
      "You → Rowan: New current question", "Correct current reply",
    ]);
  } finally {
    restore();
  }
});

test("NPC pilot validates real UTF-8 wire size before queueing or sending", async () => {
  const { stage, restore } = installDocument();
  try {
    const sent = [];
    const npc = createNpcChatPanel({
      async onSend(id, message) { sent.push({ id, message }); },
      onFocus() {},
    });
    npc.setRoster([{ id: 3, name: "Rowan", role: "Guard" }]);
    const [,,,,, history, form] = stage.children[0].children;
    const [input, button] = form.children;
    const submit = () => form.listeners.get("submit")({ preventDefault() {} });

    // JS maxlength counts UTF-16 code units, but reliable frames limit bytes.
    input.value = "🔥".repeat(61); // 122 UTF-16 units; 244 UTF-8 bytes
    await submit();
    assert.equal(sent.length, 0);
    assert.match(history.children.at(-1).textContent, /exceeds 240 UTF-8 bytes/);
    assert.equal(button.disabled, false);
    assert.equal(input.value, "🔥".repeat(61), "draft must remain editable");

    input.value = "HELLO\nCOMMAND";
    await submit();
    assert.equal(sent.length, 0);
    assert.equal(history.children.at(-1).textContent, "Enter a valid single-line NPC message.");

    // Exactly 240 bytes is accepted by the shared request codec.
    input.value = "🔥".repeat(60);
    await submit();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].id, 3);
    assert.equal(new TextEncoder().encode(sent[0].message).length, 240);
    npc.receive({ id: 3, text: "Accepted by the pilot server" });
    assert.equal(history.children.at(-1).textContent, "Accepted by the pilot server");

    // A valid 240-byte ASCII request is equally accepted.
    input.value = "x".repeat(240);
    await submit();
    assert.equal(sent.length, 2);
    assert.equal(sent[1].message.length, 240);
  } finally {
    restore();
  }
});
