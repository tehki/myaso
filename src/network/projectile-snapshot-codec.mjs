import { NETWORK, PACKET_TYPE } from "./constants.mjs";
export const PROJECTILE_HEADER_BYTES = 12;
export const PROJECTILE_RECORD_BYTES = 16;
export const DISARMED_RECORD_BYTES = 6;
export const MAX_VISIBLE_PROJECTILES = 40;
export const MAX_VISIBLE_DISARMED = 24;

export function decodeProjectileSnapshot(packet) {
  const view = packet instanceof DataView ? packet
    : packet instanceof ArrayBuffer ? new DataView(packet)
      : ArrayBuffer.isView(packet) ? new DataView(packet.buffer,packet.byteOffset,packet.byteLength)
        : null;
  if (!view || view.byteLength < PROJECTILE_HEADER_BYTES) throw new RangeError("truncated weapon snapshot");
  if (view.getUint8(0) !== NETWORK.protocolVersion) throw new Error("unsupported weapon snapshot version");
  if (view.getUint8(1) !== PACKET_TYPE.PROJECTILES) throw new Error("not weapon projectile snapshot");
  const count = view.getUint8(2);
  const countDisarmed = view.getUint8(3);
  if (count > MAX_VISIBLE_PROJECTILES || countDisarmed > MAX_VISIBLE_DISARMED) {
    throw new RangeError("projectile population exceeds datagram budget");
  }
  if (view.getUint16(10,true) !== 0) throw new Error("unexpected projectile header flags");
  if (view.byteLength !== PROJECTILE_HEADER_BYTES
    + count*PROJECTILE_RECORD_BYTES + countDisarmed*DISARMED_RECORD_BYTES) {
    throw new RangeError("invalid weapon snapshot length");
  }
  const serverTick = view.getUint32(4,true);
  const ownDisarmRemainingMs = view.getUint16(8,true);
  const projectiles = new Map();
  const disarmed = new Map();
  let off = PROJECTILE_HEADER_BYTES;
  for(let i=0;i<count;i++){
    const id=view.getUint32(off,true);
    const owner=view.getUint32(off+4,true);
    const x=view.getUint16(off+8,true)/NETWORK.worldCoordinateScale;
    const y=view.getUint16(off+10,true)/NETWORK.worldCoordinateScale;
    const facing=view.getUint16(off+12,true)/0xffff*Math.PI*2;
    const remainingSeconds=view.getUint16(off+14,true);
    if(!id || !owner || projectiles.has(id)) throw new Error("duplicate or invalid projectile identity");
    projectiles.set(id,{id,owner,x,y,facing,remainingSeconds});
    off+=PROJECTILE_RECORD_BYTES;
  }
  for(let i=0;i<countDisarmed;i++){
    const id=view.getUint32(off,true);
    const remainingSeconds=view.getUint16(off+4,true);
    if(!id || !remainingSeconds || disarmed.has(id)) throw new Error("invalid disarmed state");
    disarmed.set(id,remainingSeconds*1000);
    off+=DISARMED_RECORD_BYTES;
  }
  return { serverTick, ownDisarmRemainingMs, projectiles, disarmed };
}
