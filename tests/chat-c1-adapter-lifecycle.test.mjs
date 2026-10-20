import test from "node:test";
import assert from "node:assert/strict";
import { installLocalChat } from "../src/browser/local-chat.mjs";

function fakeDocument() {
  const doc = { activeElement: null };
  const make = tag => {
    const listeners = new Map();
    const node = {
      tagName: tag.toUpperCase(), dataset: {}, children: [], textContent: "", value: "",
      setAttribute() {},
      append(...nodes) { for (const n of nodes) { n.parentElement = this; this.children.push(n); } },
      remove() { const siblings = this.parentElement?.children; if (siblings) siblings.splice(siblings.indexOf(this), 1); },
      addEventListener(type, fn) { (listeners.get(type) ?? (listeners.set(type, []), listeners.get(type))).push(fn); },
      removeEventListener(type, fn) { const list = listeners.get(type) ?? []; const index = list.indexOf(fn); if (index >= 0) list.splice(index, 1); },
      fire(type, extra = {}) { for (const fn of listeners.get(type) ?? []) fn({ key: "", preventDefault() {}, stopPropagation() {}, ...extra }); },
      focus() { doc.activeElement = this; },
      get childElementCount() { return this.children.length; },
      get firstElementChild() { return this.children[0] ?? null; },
      get lastElementChild() { return this.children.at(-1) ?? null; },
    };
    return node;
  };
  const stage = make("div"), canvas = make("canvas");
  doc.head = make("head");
  doc.createElement = make;
  doc.querySelector = key => key === ".arena-stage" ? stage : key === "#arena" ? canvas : null;
  return { doc, canvas };
}

test("C1 old adapter ACK and stale inbound callback cannot enter the new chat session", async () => {
  const { doc } = fakeDocument();
  let id = 0, finishOld, oldInbound, newInbound;
  const c = installLocalChat(doc, { online: true, idFactory: () => "id-" + ++id });
  c.bindAdapter({
    ready: true, send() { return new Promise(resolve => { finishOld = resolve; }); },
    subscribe(fn) { oldInbound = fn; return () => {}; },
  });
  c.input.focus();
  c.input.value = "A message";
  const oldSend = c.submit();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(c.input.readOnly, true);
  assert.equal(c.input.disabled, false);
  assert.equal(doc.activeElement, c.input);
  c.bindAdapter({
    ready: true, send(data) { return Promise.resolve({ ok: true, clientMessageId: data.clientMessageId }); },
    subscribe(fn) { newInbound = fn; return () => {}; },
  });
  assert.equal(await oldSend, false);
  assert.equal(c.history.lastElementChild.dataset.delivery, "failed");
  assert.equal(c.history.lastElementChild.children[2].textContent, "Not confirmed");
  finishOld({ ok: true, clientMessageId: "id-1" });
  await Promise.resolve();
  assert.equal(c.history.lastElementChild.dataset.delivery, "failed");
  const event = key => ({ channel: "local", serverMessageId: key, sender: { displayName: "Warden" }, text: "Hello." });
  oldInbound(event("stale"));
  assert.equal(c.history.childElementCount, 1);
  newInbound(event("fresh"));
  newInbound(event("fresh"));
  assert.equal(c.history.childElementCount, 2);
  c.input.value = "Another message";
  assert.equal(await c.submit(), true);
  assert.equal(c.history.lastElementChild.dataset.delivery, "accepted");
  c.dispose();
});

test("C1 pending composer Escape returns to canvas and dispose invalidates ACK", async () => {
  const { doc, canvas } = fakeDocument();
  const c = installLocalChat(doc, { online: true, idFactory: () => "dispose-id" });
  let finish;
  c.bindAdapter({
    ready: true, send() { return new Promise(resolve => { finish = resolve; }); },
    subscribe() { return () => {}; },
  });
  c.setExpanded(true, true);
  c.input.value = "Shield up";
  const task = c.submit();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(c.input.readOnly, true);
  c.input.fire("keydown", { key: "Escape" });
  assert.equal(c.root.dataset.open, "false");
  assert.equal(doc.activeElement, canvas);
  c.dispose();
  assert.equal(await task, false);
  finish({ ok: true, clientMessageId: "dispose-id" });
  await Promise.resolve();
  assert.equal(c.history.lastElementChild.dataset.delivery, "failed");
});
