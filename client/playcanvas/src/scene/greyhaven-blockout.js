function material(pc, hex, gloss = 18, metalness = 0) {
  const color = pc.Color.fromString(hex);
  const result = new pc.StandardMaterial();
  result.diffuse = color;
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

function buildingProxy(app, pc, name, x, z, width, depth, wallColor, roofColor) {
  const walls = material(pc, wallColor, 10);
  const roof = material(pc, roofColor, 22);
  primitive(app, pc, `${name} — diagnostic footprint proxy`, 'box', [x, 1.35, z], [width, 2.7, depth], walls);
  primitive(app, pc, `${name} — diagnostic roof proxy`, 'box', [x, 2.95, z], [width + 0.45, 0.55, depth + 0.45], roof);
  primitive(app, pc, `${name} — door marker (not an interaction)`, 'box', [x, 0.85, z + depth / 2 + 0.03], [0.8, 1.7, 0.12], material(pc, '#493629', 8));
}

function treeProxy(app, pc, x, z) {
  primitive(app, pc, 'Tree trunk proxy', 'cylinder', [x, 1.0, z], [0.32, 2.0, 0.32], material(pc, '#58402d', 8));
  primitive(app, pc, 'Tree canopy proxy', 'sphere', [x, 2.35, z], [1.5, 1.8, 1.5], material(pc, '#38533c', 12));
}

function playerMarker(app, pc, name, x, z, tint) {
  const root = new pc.Entity(name);
  root.setPosition(x, 0, z);
  app.root.addChild(root);
  const body = new pc.Entity(`${name} body marker`);
  body.addComponent('render', { type: 'capsule', material: material(pc, tint, 20, 0.05) });
  body.setLocalScale(0.72, 1.55, 0.72);
  body.setPosition(0, 0.95, 0);
  root.addChild(body);
  const head = new pc.Entity(`${name} head marker`);
  head.addComponent('render', { type: 'sphere', material: material(pc, '#b9a18a', 16) });
  head.setLocalScale(0.48, 0.48, 0.48);
  head.setPosition(0, 1.95, 0);
  root.addChild(head);
  return root;
}

export function buildGreyhavenBlockout(app, pc) {
  const grass = material(pc, '#56634b', 8);
  const stone = material(pc, '#77766d', 10);
  const earth = material(pc, '#826b50', 6);
  const ground = primitive(app, pc, 'Greyhaven test ground — not canonical map data', 'plane', [0, 0, 0], [36, 1, 36], grass);

  // Diagnostic street layout only. Coordinates are local scene units, not World9 coordinates.
  primitive(app, pc, 'Main cobblestone street proxy', 'box', [0, 0.045, 0], [25, 0.09, 3.8], stone);
  primitive(app, pc, 'Packed-earth lane proxy', 'box', [-7.8, 0.05, 7.0], [9.0, 0.1, 2.4], earth);
  primitive(app, pc, 'Town square proxy', 'box', [0, 0.055, -0.2], [8.5, 0.11, 7.0], stone);

  buildingProxy(app, pc, 'Red Lion', -7.0, -4.5, 6.0, 4.5, '#75604d', '#633d32');
  buildingProxy(app, pc, 'Blacksmith', 7.0, 4.0, 4.8, 4.2, '#5b5b55', '#403b36');
  treeProxy(app, pc, -12, 5);
  treeProxy(app, pc, 12, -6);
  treeProxy(app, pc, 10, 10);

  playerMarker(app, pc, 'Local player visual marker', -1.5, 1.5, '#8a9da7');
  playerMarker(app, pc, 'Remote player visual marker (static preview only)', 1.5, -1.5, '#9b7956');

  const camera = new pc.Entity('Greyhaven isometric camera');
  camera.addComponent('camera', {
    projection: pc.PROJECTION_ORTHOGRAPHIC,
    orthoHeight: 19,
    nearClip: 0.1,
    farClip: 120,
    clearColor: new pc.Color(0.075, 0.085, 0.085)
  });
  camera.setPosition(22, 27, 22);
  camera.lookAt(0, 0, 0);
  app.root.addChild(camera);

  const sun = new pc.Entity('Warm dusk directional light');
  sun.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1.0, 0.82, 0.64),
    intensity: 1.35,
    castShadows: true,
    shadowResolution: 1024,
    shadowDistance: 70,
    shadowBias: 0.2,
    normalOffsetBias: 0.05
  });
  sun.setEulerAngles(48, 35, 0);
  app.root.addChild(sun);

  return Object.freeze({
    sceneKind: 'diagnostic-greyhaven-blockout',
    canonicalWorld9Coordinates: false,
    approvedArtIntegrated: false,
    serverAuthorityConnected: false,
    proxies: Object.freeze(['Red Lion', 'Blacksmith', 'street', 'trees', 'two static player markers']),
    ground
  });
}
