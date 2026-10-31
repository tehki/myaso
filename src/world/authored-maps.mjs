// A designer-authored, versioned fixed map. No procedural geography.
// This file defines visual locations and intended door links; it does NOT
// authorize transfers in multiplayer. Only a future server zone service can.
export const MAP_IDS = Object.freeze({
  overworld: "moonvale-overworld",
  tavern: "red-lion-inn",
});

export const AUTHORED_MAPS = Object.freeze({
  [MAP_IDS.overworld]: {
    id: MAP_IDS.overworld, kind: "outdoor", name: "Moonvale",
    width: 8192, height: 8192, spawn: {x: 4110, y: 4160},
    fields: [
      {x:2600,y:3370,w:450,h:800,color:"#95926a"},
      {x:5170,y:3330,w:720,h:570,color:"#999469"},
      {x:5390,y:5000,w:750,h:490,color:"#9c9970"},
      {x:2410,y:5140,w:590,h:470,color:"#858c5e"},
      {x:1320,y:2420,w:520,h:620,color:"#8e9466"},
    ],
    river: {width:142,points:[
      [1940,-300],[2050,830],[1840,2000],[2150,2880],[1940,3820],
      [1890,4690],[2170,5520],[1940,6750],[2200,8520],
    ]},
    roads: [
      {id:"kings-road-west",width:76,points:[[0,4150],[1250,4170],[1960,4250],[2600,4150],[3620,4170],[4160,4180]]},
      {id:"kings-road-east",width:76,points:[[4160,4180],[4860,4200],[5520,3980],[6370,4000],[7520,4140],[8200,4290]]},
      {id:"northern-road",width:56,points:[[4130,4190],[4130,3490],[3860,2850],[3560,1900],[3250,1100]]},
      {id:"southern-road",width:58,points:[[4130,4200],[4130,4740],[4500,5380],[4810,6360],[5200,8200]]},
      {id:"market-lane",width:46,points:[[3780,3840],[4160,3840],[4570,3860]]},
      {id:"western-farms",width:38,points:[[2700,4180],[2670,3680],[2950,3320]]},
      {id:"eastern-farms",width:38,points:[[5500,3980],[5620,4680],[5900,5180]]},
    ],
    city: {id:"greyhaven",name:"GREYHAVEN",x:3520,y:3460,w:1240,h:1290},
    buildings: [
      {id:"red-lion",name:"The Red Lion Inn",x:4240,y:3880,w:250,h:170,color:"#964e3c",kind:"tavern",entrance:{x:4365,y:4060},portal:"red-lion-enter"},
      {id:"smith",name:"Blacksmith",x:3710,y:3850,w:182,h:162,color:"#6d6460",kind:"smith"},
      {id:"market",name:"Market Hall",x:4320,y:4340,w:268,h:175,color:"#867453",kind:"market"},
      {id:"chapel",name:"Chapel",x:4520,y:3630,w:158,h:185,color:"#6e7377",kind:"chapel"},
      {id:"townhouse-a",name:"Townhouse",x:3710,y:4450,w:155,h:170,color:"#825646",kind:"house"},
      {id:"townhouse-b",name:"Townhouse",x:3840,y:3540,w:130,h:145,color:"#9a6854",kind:"house"},
      {id:"stable",name:"Stables",x:4480,y:4580,w:185,h:98,color:"#675445",kind:"stable"},
      {id:"mill",name:"Old Mill",x:2750,y:3820,w:150,h:160,color:"#84715d",kind:"mill"},
      {id:"briarford",name:"Briarford",x:1250,y:3940,w:204,h:170,color:"#916b52",kind:"village"},
      {id:"west-stable",name:"Stable",x:1460,y:4360,w:154,h:115,color:"#6f6050",kind:"stable"},
      {id:"stonebrook",name:"Stonebrook",x:6380,y:3820,w:224,h:185,color:"#92745a",kind:"village"},
      {id:"stonebrook-home",name:"Cottage",x:6770,y:4140,w:148,h:116,color:"#9a765a",kind:"house"},
      {id:"farm-east",name:"Farmhouse",x:5630,y:4660,w:162,h:126,color:"#866244",kind:"farm"},
      {id:"farm-south",name:"Southern Farm",x:4660,y:5660,w:164,h:126,color:"#986a49",kind:"farm"},
      {id:"watch-ruin",name:"Old Ruins",x:3130,y:1880,w:165,h:130,color:"#7c7a6f",kind:"ruin"},
    ],
    // Each tree is a fixed authored position relative to its grove anchor.
    groves: [
      {x:690,y:2350,trees:[
        [32,40],[100,30],[165,70],[230,20],[325,80],[410,40],[500,130],
        [50,185],[130,175],[205,220],[285,170],[366,225],[452,204],[540,225],
        [70,320],[165,330],[255,315],[345,365],[440,310],[530,345],
        [95,470],[197,430],[285,480],[378,438],[480,470]]},
      {x:4760,y:2050,trees:[
        [65,66],[150,40],[245,75],[337,42],[440,90],[530,60],
        [92,180],[189,190],[278,166],[377,220],[469,190],[563,200],
        [65,302],[165,335],[268,280],[358,345],[465,310],[556,325]]},
      {x:5730,y:5600,trees:[
        [50,70],[140,35],[230,90],[328,55],[434,77],[510,95],
        [60,187],[156,188],[251,195],[352,167],[454,199],
        [100,312],[202,298],[300,316],[406,302],[525,306]]},
    ],
    bridges: [{x:1980,y:4240,w:240,h:97},{x:2100,y:5500,w:240,h:78}],
    portals: [{id:"red-lion-enter",x:4365,y:4075,radius:52,
      targetMap:MAP_IDS.tavern,targetPortal:"red-lion-exit"}],
  },
  [MAP_IDS.tavern]: {
    id: MAP_IDS.tavern, kind: "interior", name: "The Red Lion Inn",
    // A 780x620 playable interior inside a 250x170 exterior footprint.
    width: 780, height: 620, spawn: {x:390,y:475},
    furniture:[
      {kind:"counter",x:278,y:90,w:260,h:54},
      {kind:"table",x:135,y:310,w:120,h:74},
      {kind:"table",x:352,y:332,w:118,h:78},
      {kind:"table",x:576,y:315,w:118,h:80},
      {kind:"fire",x:658,y:206,w:75,h:80},
      {kind:"kitchen",x:55,y:56,w:188,h:124},
      {kind:"rug",x:305,y:458,w:177,h:58},
      {kind:"barrels",x:85,y:220,w:115,h:50},
      {kind:"bedroom",x:593,y:55,w:120,h:103},
    ],
    portals: [{id:"red-lion-exit",x:390,y:550,radius:42,
      targetMap:MAP_IDS.overworld,targetPortal:"red-lion-enter"}],
  },
});

export function getAuthoredMap(id) {
  return AUTHORED_MAPS[id] ?? null;
}

export function nearbyAuthoredPortal(mapId, x, y, reach = 0) {
  const map = getAuthoredMap(mapId);
  if (!map || !Number.isFinite(x) || !Number.isFinite(y)
    || !Number.isFinite(reach) || reach < 0 || reach > 100) return null;
  return map.portals.find(p => Math.hypot(p.x - x, p.y - y) <= p.radius + reach) ?? null;
}

// Authoring helper for OFFLINE PREVIEW ONLY, not network authorization.
export function previewPortalDestination(mapId, portalId) {
  const map = getAuthoredMap(mapId);
  const portal = map?.portals.find(p => p.id === portalId);
  const target = getAuthoredMap(portal?.targetMap);
  const destination = target?.portals.find(p => p.id === portal?.targetPortal
    && p.targetMap === mapId && p.targetPortal === portalId);
  if (!destination) return null;
  return { mapId: target.id, x: destination.x,
    y: destination.y + (target.kind === "outdoor" ? 68 : -70) };
}
