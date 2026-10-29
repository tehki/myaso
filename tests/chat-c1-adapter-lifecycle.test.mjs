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
  const { doc, canvas } = fakeDocument();
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
  assert.equal(doc.activeElement, canvas);
  assert.equal(c.root.dataset.open, "false");
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

test("C1 reconnect accepts server message ID reused by a new authoritative session", () => {
  const {doc} = fakeDocument();
  const c = installLocalChat(doc, {online: true});
  let oldInbound, newInbound;
  const old = {ready:true,send(){return Promise.resolve()},subscribe(fn){
    oldInbound=fn;return ()=>{};
  }};
  const next = {ready:true,send(){return Promise.resolve()},subscribe(fn){
    newInbound=fn;return ()=>{};
  }};
  const message=(text)=>({channel:"local",serverMessageId:"1",
    sender:{displayName:"Player #1"},text});
  c.bindAdapter(old);
  oldInbound(message("before restart"));
  oldInbound(message("old duplicate"));
  assert.equal(c.history.childElementCount,1);
  c.bindAdapter(null);
  c.bindAdapter(next);
  oldInbound(message("stale old transport ignored"));
  newInbound(message("after reconnect"));
  newInbound(message("new duplicate"));
  assert.equal(c.history.childElementCount,2,
    "same server-issued ID reused on new session is a distinct message");
  assert.deepEqual(c.history.children.map(n=>n.children[1].textContent),
    ["before restart","after reconnect"]);
  c.dispose();
});

test("C1 repeated bind of same authenticated adapter is idempotent, no duplicate server ID", async () => {
  const {doc} = fakeDocument();
  const c = installLocalChat(doc, {online:true,idFactory:()=>"stable-1"});
  let inbox, finishSend, subscriptions=0, unsubscribes=0;
  const transport={ready:true,
    send(){return new Promise(resolve=>{finishSend=resolve})},
    subscribe(fn){subscriptions++;inbox=fn;return ()=>{unsubscribes++}}};
  c.bindAdapter(transport);
  const evt=text=>({channel:"local",serverMessageId:"1",sender:{displayName:"Player #2"},text});
  inbox(evt("first"));
  c.input.value="pending ACK";
  const send=c.submit();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(c.input.readOnly,true);
  c.bindAdapter(transport); // not a reconnect; same adapter, same session
  inbox(evt("duplicate should remain suppressed"));
  assert.equal(c.history.childElementCount,2,"one received and one pending outgoing only");
  assert.equal(subscriptions,1,"no replacement subscription for same adapter");
  assert.equal(unsubscribes,0);
  finishSend({ok:true,clientMessageId:"stable-1"});
  assert.equal(await send,true,"same-session rebind must not cancel valid server ACK");
  assert.equal(c.history.lastElementChild.dataset.delivery,"accepted");
  c.dispose();
  assert.equal(unsubscribes,1);
});

test("C1 submit returns to canvas while pending and dispose invalidates ACK", async () => {
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
  assert.equal(c.root.dataset.open, "false");
  assert.equal(doc.activeElement, canvas);
  c.dispose();
  assert.equal(await task, false);
  finish({ ok: true, clientMessageId: "dispose-id" });
  await Promise.resolve();
  assert.equal(c.history.lastElementChild.dataset.delivery, "failed");
});
