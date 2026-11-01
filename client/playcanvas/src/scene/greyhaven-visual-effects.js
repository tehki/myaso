// Graphics 3C: PlayCanvas visual-only day/dusk environment.
export const GREYHAVEN_VISUAL_BUDGET = Object.freeze({
  maxChimneys: 2,
  wispsPerChimney: 6,
  maxPracticalLights: 4,
  shadowResolution: 1024,
  shadowDistance: 65
});

export function greyhavenLook(query) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query ?? '');
  return params.get('greyhavenTime') === 'dusk' ? 'dusk' : 'day';
}

export function smokePlan(chimneys, timeOfDay) {
  if (!Array.isArray(chimneys) || chimneys.length > GREYHAVEN_VISUAL_BUDGET.maxChimneys ||
      !['day','dusk'].includes(timeOfDay)) throw new TypeError('Invalid visual smoke plan');
  if (timeOfDay === 'day') return Object.freeze([]);
  return Object.freeze(chimneys.map(chimney => {
    if (typeof chimney.name !== 'string' || !chimney.name ||
        ![chimney.x,chimney.y,chimney.z].every(Number.isFinite))
      throw new TypeError('Invalid visual chimney position');
    return Object.freeze({...chimney});
  }));
}

export function redLionSmokeAnchor(focus) {
  if (![focus?.x,focus?.z].every(Number.isFinite)) throw new TypeError('Red Lion source anchor required');
  return Object.freeze({name:'Red Lion chimney',x:focus.x-1.7,y:4.9,z:focus.z-1.35});
}

export function blacksmithSmokeAnchor(placement) {
  if (![placement?.x,placement?.z].every(Number.isFinite)) throw new TypeError('Blacksmith source anchor required');
  // Presentation-only approximate chimney origin; not a World9 collider or door.
  return Object.freeze({name:'Blacksmith chimney',x:placement.x+0.55,y:5.1,z:placement.z-0.6});
}

export function configureGreyhavenLighting(app, pc, sun, look, redLionFocus, blacksmithPlacement) {
  if (!['day','dusk'].includes(look)) throw new TypeError('Invalid daylight state');
  const dusk=look==='dusk';
  app.scene.ambientLight=dusk?new pc.Color(0.20,0.22,0.27):new pc.Color(0.40,0.42,0.44);
  sun.light.color=dusk?new pc.Color(1.0,0.69,0.48):new pc.Color(1.0,0.94,0.85);
  sun.light.intensity=dusk?0.83:1.35;
  sun.light.shadowResolution=GREYHAVEN_VISUAL_BUDGET.shadowResolution;
  sun.light.shadowDistance=GREYHAVEN_VISUAL_BUDGET.shadowDistance;
  const lights=[];
  if(dusk) {
    const specs=[
      ['Red Lion left window',redLionFocus.x-2.05,1.75,redLionFocus.z+2.3,3.2,0.43],
      ['Red Lion right window',redLionFocus.x+2.05,1.75,redLionFocus.z+2.3,3.2,0.43],
      ['Red Lion doorway',redLionFocus.x,2.0,redLionFocus.z+2.4,3.6,0.37],
      ['Blacksmith forge',blacksmithPlacement.x+0.3,1.45,blacksmithPlacement.z+1.25,4.4,0.62]
    ];
    for(const [name,x,y,z,range,intensity] of specs.slice(0,GREYHAVEN_VISUAL_BUDGET.maxPracticalLights)) {
      const entity=new pc.Entity(name+' — dusk visual only');
      entity.addComponent('light',{type:'omni',color:new pc.Color(1,0.55,0.25),
        range,intensity,castShadows:false});
      entity.setPosition(x,y,z);
      app.root.addChild(entity);
      lights.push(entity);
    }
  }
  return Object.freeze({look,lights:Object.freeze(lights),sun});
}
