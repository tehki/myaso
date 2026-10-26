// REVIEW-ONLY candidate for Main #723. This is NEVER imported by gameplay.
// Extend existing Combat4/Core8A 16-byte v2 0x11 event & 0x12 ACK grammar.
// Byte 3: zero remains unchanged LMB; one is proposed DISTINCT standalone KeyE.
// There is NO runtime QUIC negotiation, auth, lease, reliable ACK or hit grant.
export const REVIEW_VERSION = 2;
export const REVIEW_EVENT_TYPE = 0x11;
export const REVIEW_ACK_TYPE = 0x12;
export const REVIEW_LENGTH = 16;
export const REVIEW_SOURCE = Object.freeze({LMB:0,KEY_E:1});
export const REVIEW_ACTION = Object.freeze({PRESS:1,UPGRADE:2,RELEASE:3,CANCEL:4});
export const REVIEW_ACK = Object.freeze({ACCEPTED:1,DUPLICATE:2,STALE:3,REJECTED:4});
const u32=(x,positive=false)=>Number.isSafeInteger(x)&&x>=(positive?1:0)&&x<=0xffffffff;
const valid=(x,source)=>{
  if(!Object.values(REVIEW_ACTION).includes(x))return false;
  return source===REVIEW_SOURCE.LMB
    || (source===REVIEW_SOURCE.KEY_E&&x!==REVIEW_ACTION.UPGRADE);
};
function viewOf(input){
  if(input instanceof ArrayBuffer)return new DataView(input);
  if(ArrayBuffer.isView(input))
    return new DataView(input.buffer,input.byteOffset,input.byteLength);
  throw new TypeError("not actual bytes");
}
export function encodeReviewEvent({source,action,sequence,gestureId,clientTick=0}){
  if(![REVIEW_SOURCE.LMB,REVIEW_SOURCE.KEY_E].includes(source)||!valid(action,source))
    throw new Error("noncanonical typed gesture source/action");
  if(!u32(sequence,true)||!u32(gestureId,true)||!u32(clientTick))
    throw new Error("unbounded or zero wire identity");
  const b=new Uint8Array(REVIEW_LENGTH),v=new DataView(b.buffer);
  v.setUint8(0,REVIEW_VERSION);v.setUint8(1,REVIEW_EVENT_TYPE);
  v.setUint8(2,action);v.setUint8(3,source);
  v.setUint32(4,sequence,true);v.setUint32(8,gestureId,true);
  v.setUint32(12,clientTick,true); // diagnostics ONLY
  return b;
}
export function decodeReviewEvent(bytes){
  const v=viewOf(bytes);
  if(v.byteLength!==REVIEW_LENGTH)throw Error("invalid reviewed event length");
  if(v.getUint8(0)!==REVIEW_VERSION||v.getUint8(1)!==REVIEW_EVENT_TYPE)
    throw Error("unselected or legacy packet version/type");
  const source=v.getUint8(3),action=v.getUint8(2);
  if(![REVIEW_SOURCE.LMB,REVIEW_SOURCE.KEY_E].includes(source)||!valid(action,source))
    throw Error("unnegotiated source/action");
  const sequence=v.getUint32(4,true),gestureId=v.getUint32(8,true);
  if(!sequence||!gestureId)throw Error("zero event/gesture identity");
  return Object.freeze({source,action,sequence,gestureId,clientTick:v.getUint32(12,true)});
}
export function encodeReviewAck({status,sequence,gestureId,serverTick=0}){
  if(!Object.values(REVIEW_ACK).includes(status)||!u32(sequence,true)
    ||!u32(gestureId,true)||!u32(serverTick))
    throw Error("noncanonical reviewed ACK");
  const b=new Uint8Array(REVIEW_LENGTH),v=new DataView(b.buffer);
  v.setUint8(0,REVIEW_VERSION);v.setUint8(1,REVIEW_ACK_TYPE);
  v.setUint8(2,status);
  v.setUint32(4,sequence,true);v.setUint32(8,gestureId,true);
  v.setUint32(12,serverTick,true);
  return b;
}
