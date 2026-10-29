// Native staging only. Keep both real Light attackers in range of center,
// and outside each other's94px reach; timing/World/feedback remain unchanged.
export function planM59ThreatGeometry(fighters, leftId, centerId, rightId) {
  if (!Array.isArray(fighters) || new Set([leftId,centerId,rightId]).size!==3)
    throw new TypeError("three distinct replicated M59 fighters required");
  const [left,center,right]=[leftId,centerId,rightId].map(id=>fighters.find(f=>f.netId===id));
  if ([left,center,right].some(f=>!f || !Number.isFinite(f.x) || !Number.isFinite(f.y)))
    throw new TypeError("finite original World replica coordinates required");
  const moves=[left,right].map((f,i)=>{
    const dx=center.x+(i===0?-62:62)-f.x,dy=center.y-f.y;
    if (Math.abs(dx)<=4 && Math.abs(dy)<=4) return {id:f.netId,key:null,ms:0};
    const horizontal=Math.abs(dx)>=Math.abs(dy),error=horizontal?dx:dy;
    return {id:f.netId,key:horizontal?(error>0?"d":"a"):(error>0?"s":"w"),
      ms:Math.max(15,Math.min(140,Math.round(Math.abs(error)*1000/215*.72)))};
  });
  return {ready:moves.every(m=>m.key===null),moves};
}
