// REVIEW ONLY. Nothing in live web/online-game.mjs imports this module.
export const KIND = Object.freeze({PRESS:1,UPGRADE:2,RELEASE:3,CANCEL:4,KEYE_PRESS:5,KEYE_RELEASE:6});
const valid = new Set(Object.values(KIND));
const u32=(n,k,zero=false)=>{if(!Number.isInteger(n)||n<(zero?0:1)||n>0xffffffff)throw new RangeError(k+" invalid");};
const epochCheck=(n)=>{if(typeof n!=="bigint"||n<1n||n>0xffffffffffffffffn)throw new RangeError("epoch invalid");};
export function encodeReview({epoch,sequence,events}){
  epochCheck(epoch);u32(sequence,"packetSequence",true);
  if(!Array.isArray(events)||events.length<1||events.length>4)throw new RangeError("count invalid");
  const b=new ArrayBuffer(16+events.length*16),v=new DataView(b);
  v.setUint8(0,2);v.setUint8(1,0x52);v.setUint8(2,events.length);
  v.setBigUint64(4,epoch,true);v.setUint32(12,sequence,true);
  for(let i=0;i<events.length;i++){
    const e=events[i],o=16+i*16;
    u32(e.seq,"seq");u32(e.gesture,"gesture");u32(e.tick,"tick",true);
    if(!valid.has(e.kind))throw new RangeError("kind invalid");
    v.setUint32(o,e.seq,true);v.setUint32(o+4,e.gesture,true);v.setUint32(o+8,e.tick,true);
    v.setUint8(o+12,e.kind);v.setUint8(o+13,e.kind<=4?1:2);
  }
  return b;
}
export function decodeReview(bytes){
  if(!(bytes instanceof ArrayBuffer)&&!ArrayBuffer.isView(bytes))throw new TypeError("buffer required");
  const v=bytes instanceof ArrayBuffer?new DataView(bytes):new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(v.byteLength<16)throw new RangeError("truncated");
  if(v.getUint8(0)!==2||v.getUint8(1)!==0x52)throw new RangeError("unnegotiated version or type");
  const n=v.getUint8(2);
  if(n<1||n>4||v.byteLength!==16+n*16||v.getUint8(3)!==0)throw new RangeError("count length or reserved invalid");
  const epoch=v.getBigUint64(4,true);epochCheck(epoch);const events=[];
  for(let i=0;i<n;i++){
    const o=16+i*16,kind=v.getUint8(o+12),seq=v.getUint32(o,true),gesture=v.getUint32(o+4,true);
    u32(seq,"seq");u32(gesture,"gesture");
    if(!valid.has(kind)||v.getUint8(o+13)!==(kind<=4?1:2)||v.getUint16(o+14,true)!==0)
      throw new RangeError("kind source or reserved invalid");
    events.push({seq,gesture,tick:v.getUint32(o+8,true),kind});
  }
  return {epoch,sequence:v.getUint32(12,true),events};
}
// Not authoritative gameplay: purely a proposal for order and dedup semantics.
export class PreviewGate {
  constructor(assignedEpoch){epochCheck(assignedEpoch);this.epoch=assignedEpoch;this.next=1;this.lastGesture=0;this.active=null;this.upgraded=false;this.keyeActive=null;}
  accept(raw){
    const p=decodeReview(raw);
    if(p.epoch!==this.epoch)throw new Error("actor lease epoch mismatch");
    const result=[];
    for(const e of p.events){
      if(e.seq<this.next)continue;
      if(e.seq!==this.next)throw new Error("missing event; require retransmission");
      this.next++;
      if(e.kind===KIND.PRESS){
        if(this.active!==null||this.keyeActive!==null||e.gesture<=this.lastGesture)continue;
        this.active=e.gesture;this.upgraded=false;this.lastGesture=e.gesture;result.push("press");
      }else if(e.kind===KIND.UPGRADE&&this.active===e.gesture&&!this.upgraded){this.upgraded=true;result.push("upgrade-intent");
      }else if((e.kind===KIND.RELEASE||e.kind===KIND.CANCEL)&&this.active===e.gesture){
        result.push(e.kind===KIND.RELEASE?"release":"cancel");this.active=null;this.upgraded=false;
      }else if(e.kind===KIND.KEYE_PRESS&&this.active===null&&this.keyeActive===null&&e.gesture>this.lastGesture){
        this.lastGesture=e.gesture;this.keyeActive=e.gesture;result.push("keye-press");
      }else if(e.kind===KIND.KEYE_RELEASE&&this.keyeActive===e.gesture){this.keyeActive=null;result.push("keye-release");}
    }
    return result;
  }
}
