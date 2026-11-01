// Graphics 3B — authentic Blender R4 Blacksmith, purely visual.
// The World9 smith ID, server geometry, doors and inventory remain untouched.
export const BLACKSMITH_R4 = Object.freeze({
  source: 'Greyhaven Blacksmith R4 original Blender export',
  path: '/assets/greyhaven/blacksmith-r4/blacksmith-r4-original-blender-web1024.glb',
  sha256: '84cf7901e7ec851f24055766d47240726bf12e908ed494f4e33881faac382640',
  sourceBlendSha256: '26ef652f2493a66a01e174a1865f8beac787adcf953db0b0d69162747f1d7f3d',
  sourceBytes: 13425740,
  visualScale: 0.72,
  worldBuildingId: 'smith'
});

export function smithVisualPlacement(building, centerX, centerY, worldScale = 0.025) {
  if (building?.id !== BLACKSMITH_R4.worldBuildingId ||
    ![building.x, building.y, building.w, building.h, centerX, centerY, worldScale]
      .every(Number.isFinite) || building.w <= 0 || building.h <= 0 ||
    worldScale <= 0) throw new TypeError('Expected canonical World9 smith footprint');
  return Object.freeze({
    x: (building.x + building.w / 2 - centerX) * worldScale,
    y: 0,
    z: (building.y + building.h / 2 - centerY) * worldScale,
    scale: BLACKSMITH_R4.visualScale
  });
}

function loadOriginalContainer(app, url) {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(url, 'container', (error, asset) => {
      if (error || !asset?.resource?.instantiateRenderEntity) {
        reject(new Error('Original Blender Blacksmith GLB unavailable: ' + (error?.message ?? error ?? 'missing container')));
      } else resolve(asset);
    });
  });
}

export async function buildOriginalBlacksmith(app, pc, building, centerX, centerY, worldScale) {
  const placement = smithVisualPlacement(building, centerX, centerY, worldScale);
  const asset = await loadOriginalContainer(app, BLACKSMITH_R4.path);
  const entity = asset.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
  });
  entity.name = 'Blacksmith — authentic Blender R4 visual-only';
  entity.setPosition(placement.x, placement.y, placement.z);
  entity.setLocalScale(placement.scale, placement.scale, placement.scale);
  app.root.addChild(entity);

  return Object.freeze({
    loaded: true,
    root: entity,
    world9BuildingId: building.id,
    source: BLACKSMITH_R4.source,
    sourceSha256: BLACKSMITH_R4.sha256,
    placement,
    collisionAuthority: false,
    itemAuthority: false,
    doorAuthority: false,
    portalAuthority: false
  });
}
