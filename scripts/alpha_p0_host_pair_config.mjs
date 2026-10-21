// Core 8A P0: separate-host, explicitly attested STAGING acceptance only.
// This parser has no network or process side effects.
const pinned=/^[0-9a-f]{64}$/i;
const id=/^[a-z0-9][a-z0-9-]{2,31}$/;
export function privateIpv4(input){
  if(typeof input!=="string" || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(input))return false;
  const p=input.split(".").map(Number);
  if(p.some(x=>x>255)||p.some((n,i)=>String(n)!==input.split(".")[i]))return false;
  return p[0]===10 || (p[0]===172 && p[1]>=16 && p[1]<=31)
      || (p[0]===192 && p[1]===168);
}
export function parseHostPairConfig(env,{localAddresses=[],now=Date.now()}={}){
  if(env.MYASO_P0_HOST_PAIR_APPROVED!=="YES"||env.MYASO_P0_ISOLATED_STAGE!=="1")
    throw Error("P0 cross-host acceptance requires explicit isolated staging authorization");
  if(env.MYASO_P0_MAX_PLAYERS!=="4")throw Error("only isolated authoritative cap four is supported");
  const role=env.MYASO_P0_PAIR_ROLE;
  if(role!=="A"&&role!=="B")throw Error("pair role must be A or B");
  const hostId=env.MYASO_P0_PAIR_HOST_ID,peerHostId=env.MYASO_P0_PAIR_PEER_HOST_ID;
  if(!id.test(hostId||"")||!id.test(peerHostId||"")||hostId===peerHostId)
    throw Error("attest two different valid host IDs");
  const addr=env.MYASO_P0_SERVER_IPV4;
  if(!privateIpv4(addr))throw Error("staging QUIC address must be RFC1918 IPv4");
  if(!Array.isArray(localAddresses)||!localAddresses.some(privateIpv4)
    || localAddresses.includes(addr))throw Error("runner must be on a distinct private-network client host");
  let url;
  try{url=new URL(env.MYASO_P0_SERVER_URL)}catch{throw Error("invalid staging QUIC URL")}
  if(url.protocol!=="https:"||url.hostname!==addr||!url.port
    ||url.pathname!=="/game"||url.username||url.password||url.search||url.hash)
    throw Error("only pinned explicit-port private https://IPv4:port/game is permitted");
  const fingerprint=env.MYASO_P0_SERVER_CERT_SHA256;
  if(typeof fingerprint!=="string"||!pinned.test(fingerprint))
    throw Error("missing or invalid SHA256 staging certificate pin");
  const startText=env.MYASO_P0_COORDINATED_START_MS;
  if(!/^\d{13}$/.test(startText||""))throw Error("coordinated UTC start must be epoch milliseconds");
  const start=Number(startText);
  if(!Number.isSafeInteger(start)||start<now+20000||start>now+600000)
    throw Error("UTC start must be 20–600 seconds in the future at validation");
  return Object.freeze({
    role,hostId,peerHostId,url:url.href,serverIpv4:addr,
    fingerprint:fingerprint.toLowerCase(),start,cap:4,stagingOnly:true
  });
}
