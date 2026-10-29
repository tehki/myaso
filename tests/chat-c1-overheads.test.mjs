import test from "node:test";
import assert from "node:assert/strict";
import { createOverheadChatBubbles, OVERHEAD_CHAT } from "../src/browser/chat-c1-overheads.mjs";
import { projectArenaPoint } from "../src/browser/arena-viewport.mjs";

function fixture() {
  let now = 1000;
  const doc = { };
  function element(tag) {
    const node = {
      tagName: tag.toUpperCase(), children: [], style: {}, textContent: "",
      hidden: false, attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      append(child) { child.parent = this; this.children.push(child); },
      remove() {
        if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
        this.parent = null;
      },
      getBoundingClientRect() {
        return { left: this.left || 0, top: this.top || 0,
          width: this.width || 960, height: this.height || 540 };
      },
    };
    return node;
  }
  const stage = element("div"), canvas = element("canvas");
  stage.width = 960; stage.height = 540;
  canvas.width = 960; canvas.height = 540;
  doc.createElement = element;
  doc.querySelector = selector => selector === ".arena-stage" ? stage
    : selector === "#arena" ? canvas : null;
  const bubbles = createOverheadChatBubbles({ doc, clock: () => now });
  const frame = ({ remotes = [{netId:2,x:110,y:100,hp:100,action:0}],
    own = {x:100,y:100,hp:100,action:0}, camera={x:100,y:100}, ownId=1,
    deadAction=-1 } = {}) => bubbles.frame({
    ownId, own, remotes, camera, width:960, height:540,
    deadAction, nowMs:now,
  });
  return { stage, canvas, bubbles, frame, tick: ms => { now += ms; } };
}

test("Only server-authoritative numeric sender.netId can anchor an overhead bubble", () => {
  const x = fixture();
  assert.equal(x.bubbles.received({channel:"system", sender:{netId:2},text:"Reboot"}),false);
  assert.equal(x.bubbles.received({channel:"local",sender:{displayName:"Player #2"},text:"spoof"}),false);
  assert.equal(x.bubbles.received({channel:"local",sender:{netId:"2"},text:"spoof"}),false);
  assert.equal(x.bubbles.received({channel:"local",sender:{netId:2},text:"<img onerror=alert(1)>"}),true);
  x.frame();
  assert.equal(x.bubbles.count, 1);
  const node=x.bubbles.root.children[0];
  assert.equal(node.hidden,false);
  assert.equal(node.textContent,"<img onerror=alert(1)>");
  assert.equal(node.children.length,0,"untrusted text never creates a DOM element");
  x.bubbles.dispose();
});
test("Bubble follows interpolated Knight and camera using the existing arena projection", () => {
  const x = fixture();
  x.bubbles.received({channel:"local",sender:{netId:2},text:"To the forge!"});
  x.frame();
  const node=x.bubbles.root.children[0];
  const initial=Number.parseFloat(node.style.left);
  assert.equal(initial,488.4);
  x.frame({remotes:[{netId:2,x:170,y:100,hp:100,action:0}]});
  assert(Number.parseFloat(node.style.left)>initial+45);
  x.frame({camera:{x:170,y:100},remotes:[{netId:2,x:170,y:100,hp:100,action:0}]});
  assert.equal(Number.parseFloat(node.style.left),480);
  assert.deepEqual(projectArenaPoint(170,100,170,100,960,540),{x:480,y:270});
  x.bubbles.dispose();
});
test("Offscreen, disconnected and dead fighters never leave floating orphan chat bubbles", () => {
  const x = fixture();
  x.bubbles.received({channel:"local",sender:{netId:2},text:"Hello"});
  x.frame({remotes:[]});
  assert.equal(x.bubbles.root.children[0].hidden,true);
  x.frame({remotes:[{netId:2,x:110,y:100,hp:0,action:-1}]});
  assert.equal(x.bubbles.root.children[0].hidden,true);
  x.frame({remotes:[{netId:2,x:9000,y:100,hp:100,action:0}]});
  assert.equal(x.bubbles.root.children[0].hidden,true);
  x.frame();
  assert.equal(x.bubbles.root.children[0].hidden,false);
  x.bubbles.clear();
  assert.equal(x.bubbles.count,0);
  assert.equal(x.bubbles.root.children.length,0);
  x.bubbles.dispose();
});
test("Bubble fades and expires after 4.8s; two per fighter and eight global maximum", () => {
  const x=fixture();
  for(let i=0;i<16;i++) x.bubbles.received({channel:"local",sender:{netId:i+1},text:"Player "+i});
  assert.equal(x.bubbles.count,8);
  x.bubbles.received({channel:"local",sender:{netId:2},text:"new one"});
  x.bubbles.received({channel:"local",sender:{netId:2},text:"new two"});
  x.bubbles.received({channel:"local",sender:{netId:2},text:"new three"});
  assert.equal(x.bubbles.root.children.filter(n=>n.textContent==="new one").length,0);
  assert(x.bubbles.count<=8);
  x.tick(OVERHEAD_CHAT.fadeStartMs + 100);
  x.frame({remotes:[{netId:2,x:110,y:100,hp:100,action:0}]});
  const node=x.bubbles.root.children.find(n=>n.textContent==="new three");
  assert(Number(node.style.opacity)<1);
  x.tick(OVERHEAD_CHAT.lifetimeMs-OVERHEAD_CHAT.fadeStartMs-100);
  x.frame();
  assert.equal(x.bubbles.count,0);
  x.bubbles.dispose();
});
test("Own speech only appears after explicit confirmed ACK callback, never from optimistic send", () => {
  const x=fixture();
  assert.equal(x.bubbles.count,0);
  assert.equal(x.bubbles.acceptedOwn(1, "The gate is open"),true);
  x.frame();
  const node=x.bubbles.root.children[0];
  assert.equal(node.hidden,false);
  assert.equal(Number.parseFloat(node.style.left),480);
  x.bubbles.dispose();
});
