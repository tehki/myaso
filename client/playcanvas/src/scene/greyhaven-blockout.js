import { AUTHORED_MAPS, MAP_IDS } from '../world/authored-maps.mjs';

const WORLD9_RENDER_SCALE = 0.025;
const SOURCE_COMMIT = '0843946d308bc3f88bb147d910deff450393c475';

function colorFromHex(pc, hex) {
  const value = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new TypeError(`Expected #RRGGBB color, received ${hex}`);
  }
  return new pc.Color(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255
  );
}

function material(pc, hex, gloss = 18, metalness = 0) {
  const result = new pc.StandardMaterial();
  result.diffuse = colorFromHex(pc, hex);
  result.gloss = gloss;
  result.metalness = metalness;
  result.update();
  return result;
}

function primitive(app, pc, name, type, position, scale, surface) {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type, material: surface });
  entity.setLocalScale(scale[0], scale[1], scale[2]);
  entity.setPosition(position[0], position[1], position[2]);
  app.root.addChild(entity);
  return entity;
}

function toScenePoint(x, y, centerX, centerY) {
  return {
    x: (x - centerX) * WORLD9_RENDER_SCALE,
    z: (y - centerY) * WORLD9_RENDER_SCALE
  };
}

function polyline(app, pc, name, points, width, height, y, centerX, centerY, surface) {
  const created = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = toScenePoint(points[index][0], points[index][1], centerX, centerY);
    const b = toScenePoint(points[index + 1][0], points[index + 1][1], centerX, centerY);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length <= 0) continue;
    const segment = primitive(
      app,
      `${name} segment ${index + 1}`,
      'box',
      [(a.x + b.x) / 2, y, (a.z + b.z) / 2],
      [width, height, length],
      surface
    );
    segment.setEulerAngles(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
    created.push(segment);
  }
  return created;
}

function buildingHeight(kind) {
  if (kind === 'tavern') return 2.8;
  if (kind === 'chapel') return 3.2;
  if (kind === 'smith') return 2.35;
  if (kind === 'market') return 2.5;
  if (kind === 'mill') return 2.6;
  return 1.9;
}

function buildingProxy(app, pc, building, centerX, centerY, cache) {
  const point = toScenePoint(
    building.x + building.w / 2,
    building.y + building.h / 2,
    centerX,
    centerY
  );
  const width = building.w * WORLD9_RENDER_SCALE;
  const depth = building.h * WORLD9_RENDER_SCALE;
  const height = buildingHeight(building.kind);
  const wallColor = building.color || '#806b58';
  const roofColor = building.kind === 'tavern' ? '#633d32'
    : building.kind === 'smith' ? '#403b36' : '#625348';
  cache[wallColor] ??= material(pc, wallColor, 10);
  cache[roofColor] ??= material(pc, roofColor, 18);

  primitive(app, pc, `${building.name} — World9 footprint proxy`, 'box',
    [point.x, height / 2, point.z], [width, height, depth], cache[wallColor]);
  primitive(app, pc, `${building.name} — roof proxy`, 'box',
    [point.x, height + 0.16, point.z], [width + 0.28, 0.32, depth + 0.28], cache[roofColor]);

  if (building.id === 'red-lion' && building.entrance) {
    const door = toScenePoint(building.entrance.x, building.entrance.y, centerX, centerY);
    primitive(app, pc, 'The Red Lion — authored entrance marker (visual only)', 'box',
      [door.x, 0.12, door.z], [0.55, 0.24, 0.55], cache.spawn);
  }
}

function treeProxy(app, pc, x, z, trunkMaterial, canopyMaterial, index) {
  primitive(app, pc, `World9 grove tree ${index} trunk`, 'cylinder',
    [x, 0.72, z], [0.22, 1.44, 0.22], trunkMaterial);
  primitive(app, pc, `World9 grove tree ${index} canopy`, 'sphere',
    [x, 1.72, z], [1.05, 1.35, 1.05], canopyMaterial);
}

export function buildGreyhavenBlockout(app, pc) {
  const map = AUTHORED_MAPS[MAP_IDS.overworld];
  if (!map || map.city?.id !== 'greyhaven' || !Array.isArray(map.buildings)) {
    throw new Error('World9 authored Greyhaven map source is missing or invalid');
  }

  const centerX = map.city.x + map.city.w / 2;
  const centerY = map.city.y + map.city.h / 2;
  const cache = {
    grass: material(pc, '#56634b', 8),
    stone: material(pc, '#77766d', 10),
    earth: material(pc, '#826b50', 6),
    water: material(pc, '#496f79', 24, 0.08),
    bridge: material(pc, '#594532', 12),
    treeTrunk: material(pc, '#58402d', 8),
    treeCanopy: material(pc, '#38533c', 12),
    spawn: material(pc, '#c6a46b', 32, 0.15)
  };

  primitive(app, pc, 'Moonvale / Greyhaven terrain base — visual only', 'plane',
    [0, -0.12, 0],
    [map.width * WORLD9_RENDER_SCALE, 1, map.height * WORLD9_RENDER_SCALE],
    cache.grass);

  for (const field of map.fields ?? []) {
    const point = toScenePoint(field.x + field.w / 2, field.y + field.h / 2, centerX, centerY);
    const key = `field:${field.color}`;
    cache[key] ??= material(pc, field.color, 7);
    primitive(app, pc, 'Authored field / clearing', 'box',
      [point.x, -0.045, point.z],
      [field.w * WORLD9_RENDER_SCALE, 0.035, field.h * WORLD9_RENDER_SCALE],
      cache[key]);
  }

  for (const road of map.roads ?? []) {
    polyline(app, pc, `World9 road: ${road.id}`, road.points,
      road.width * WORLD9_RENDER_SCALE, 0.055, -0.005,
      centerX, centerY, road.id.includes('farm') ? cache.earth : cache.stone);
  }

  if (map.river?.points) {
    polyline(app, pc, 'Authored river — visual water only', map.river.points,
      map.river.width * WORLD9_RENDER_SCALE, 0.045, -0.025,
      centerX, centerY, cache.water);
  }

  for (const bridge of map.bridges ?? []) {
    const point = toScenePoint(bridge.x + bridge.w / 2, bridge.y + bridge.h / 2, centerX, centerY);
    primitive(app, pc, 'Authored bridge visual proxy', 'box',
      [point.x, 0.02, point.z],
      [bridge.w * WORLD9_RENDER_SCALE, 0.18, bridge.h * WORLD9_RENDER_SCALE],
      cache.bridge);
  }

  for (const building of map.buildings) {
    buildingProxy(app, pc, building, centerX, centerY, cache);
  }

  let treeIndex = 0;
  for (const grove of map.groves ?? []) {
    for (const [offsetX, offsetY] of grove.trees ?? []) {
      const point = toScenePoint(grove.x + offsetX, grove.y + offsetY, centerX, centerY);
      treeIndex += 1;
      treeProxy(app, pc, point.x, point.z, cache.treeTrunk, cache.treeCanopy, treeIndex);
    }
  }

  const spawn = toScenePoint(map.spawn.x, map.spawn.y, centerX, centerY);
  primitive(app, pc, 'World9 authored spawn reference — not a player actor', 'cylinder',
    [spawn.x, 0.08, spawn.z], [0.42, 0.16, 0.42], cache.spawn);

  const camera = new pc.Entity('Greyhaven isometric camera');
  camera.addComponent('camera', {
    projection: pc.PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 80,
    nearClip: 0.1,
    farClip: 600,
    clearColor: new pc.Color(0.075, 0.085, 0.085)
  });
  camera.setPosition(45, 66, 45);
  camera.lookAt(0, 0, 0);
  app.root.addChild(camera);

  const sun = new pc.Entity('Warm dusk directional light');
  sun.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1.0, 0.82, 0.64),
    intensity: 1.35,
    castShadows: true,
    shadowResolution: 2048,
    shadowDistance: 180,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
  });
  sun.setEulerAngles(48, 35, 0);
  app.root.addChild(sun);

  return Object.freeze({
    sceneKind: 'world9-greyhaven-authored-map-visualization',
    mapId: map.id,
    mapName: map.name,
    cityId: map.city.id,
    canonicalWorld9Coordinates: true,
    visualScaleOnly: WORLD9_RENDER_SCALE,
    sourcePullRequest: 1148,
    sourceCommit: SOURCE_COMMIT,
    buildingIds: Object.freeze(map.buildings.map(building => building.id)),
    treeCount: treeIndex,
    spawnReference: Object.freeze({ ...map.spawn }),
    approvedArtIntegrated: false,
    collisionAuthority: false,
    portalAuthority: false,
    serverAuthorityConnected: false
  });
}
