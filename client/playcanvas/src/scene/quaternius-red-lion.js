const ASSET_ROOT = '/assets/quaternius/medieval-village-megakit';

export const QUATERNIUS_SOURCE = Object.freeze({
  creator: 'Quaternius',
  pack: 'Medieval Village MegaKit',
  sourceRepository: 'https://github.com/J-Ponzo/gltf-medieval-village-megakit',
  sourceCommit: '21104b4045261c28fc312360841ed1a7b0ac8782',
  license: 'CC0-1.0',
  noticePath: `${ASSET_ROOT}/NOTICE.md`,
  licensePath: `${ASSET_ROOT}/LICENSE`
});

export const RED_LION_MODEL_FILES = Object.freeze([
  'Wall_Plaster_Door_Round.gltf',
  'Wall_Plaster_Window_Wide_Round.gltf',
  'Wall_Plaster_WoodGrid.gltf',
  'Wall_Plaster_Straight.gltf',
  'WindowShutters_Wide_Round_Open.gltf',
  'Window_Wide_Round1.gltf',
  'Door_1_Round.gltf',
  'Roof_RoundTiles_4x6.gltf',
  'Roof_Front_Brick6.gltf',
  'Prop_Chimney.gltf'
]);

const WALL_LOCAL_CENTER_Z = -0.1107943058;
const WALL_FRONT_FACE_Z = 0.0924467146;
const SHUTTER_LOCAL_CENTER_Z = 0.326972514;
const WINDOW_LOCAL_CENTER_Z = 0.012504488;
const GABLE_LOCAL_CENTER_Z = 0.229588329;
const DOOR_LOCAL_CENTER_X = 0.5137433372;
const DOOR_LOCAL_BASE_Y = 0.0330896378;
const DOOR_LOCAL_CENTER_Z = 0.00279258005;

// Measured from the genuine Quaternius Wall_Plaster_Door_Round opening in
// Blender: 1.305 m wide below the arch; arch apex approximately 2.50 m.
// The actual Door_1_Round timber leaf is only 1.120 m wide × 2.318 m tall.
// Fit its width to the same front-wall presentation scale, retain a visible
// jamb reveal, and make the arch taller without touching the wall or portal.
export const RED_LION_DOOR_FIT = Object.freeze({
  openingWidth: 1.305,
  archApexHeight: 2.50,
  horizontalScale: 1.10,
  verticalScale: 1.04
});

export function fittedRedLionDoorTransform(frontScaleX, depth) {
  if (!(Number.isFinite(frontScaleX) && frontScaleX > 0 &&
        Number.isFinite(depth) && depth > 0)) {
    throw new TypeError('Red Lion door requires the real World9 presentation dimensions');
  }

  const scaleX = frontScaleX * RED_LION_DOOR_FIT.horizontalScale;
  const scaleY = RED_LION_DOOR_FIT.verticalScale;
  return Object.freeze({
    x: -DOOR_LOCAL_CENTER_X * scaleX,
    y: -DOOR_LOCAL_BASE_Y * scaleY,
    z: depth / 2 - DOOR_LOCAL_CENTER_Z,
    scaleX,
    scaleY
  });
}
const WALL_HEIGHT = 3.1226887703;
const ROOF_MIN_Y = -0.5157185793;

function loadContainer(app, filename) {
  const url = `${ASSET_ROOT}/${filename}`;

  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(url, 'container', (error, asset) => {
      if (error) {
        reject(new Error(`Unable to load Quaternius asset ${filename}: ${error.message ?? error}`));
        return;
      }

      if (!asset?.resource?.instantiateRenderEntity) {
        reject(new Error(`Quaternius container did not expose render geometry: ${filename}`));
        return;
      }

      resolve(asset);
    });
  });
}

function instantiatePart(root, container, name, transform) {
  const entity = container.resource.instantiateRenderEntity({
    castShadows: true,
    receiveShadows: true
  });
  entity.name = name;
  entity.setLocalPosition(transform.x, transform.y, transform.z);
  entity.setLocalEulerAngles(0, transform.yaw ?? 0, 0);
  entity.setLocalScale(
    transform.scaleX ?? 1,
    transform.scaleY ?? 1,
    transform.scaleZ ?? 1
  );
  root.addChild(entity);
  return entity;
}

function addRedLionSignboard(root, app, pc, depth) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable for the Red Lion sign');

  context.fillStyle = '#2b2119';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#c9a96b';
  context.lineWidth = 8;
  context.strokeRect(8, 8, 496, 176);
  context.lineWidth = 2;
  context.strokeRect(19, 19, 474, 154);

  // Original heraldic lion-head mark, drawn into the sign texture.
  context.save();
  context.translate(92, 96);
  context.fillStyle = '#9a3429';
  context.beginPath();
  for (let index = 0; index < 16; index += 1) {
    const angle = (Math.PI * 2 * index) / 16;
    const radius = index % 2 === 0 ? 57 : 45;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
  context.fillStyle = '#d7b873';
  context.beginPath();
  context.ellipse(0, 3, 30, 37, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#2b2119';
  context.beginPath();
  context.ellipse(-11, -5, 4, 3, 0, 0, Math.PI * 2);
  context.ellipse(11, -5, 4, 3, 0, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(0, 7);
  context.lineTo(-7, 15);
  context.lineTo(7, 15);
  context.closePath();
  context.fill();
  context.restore();

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#e1c58b';
  context.font = 'bold 43px Georgia, serif';
  context.fillText('THE RED LION', 320, 78);
  context.font = '21px Georgia, serif';
  context.fillText('TAVERN  •  GREYHAVEN', 320, 128);

  const wood = new pc.StandardMaterial();
  wood.diffuse = new pc.Color(0.22, 0.14, 0.09);
  wood.gloss = 8;
  wood.update();

  const board = new pc.Entity('Red Lion — carved timber signboard');
  board.addComponent('render', { type: 'box', material: wood });
  board.setLocalPosition(0, 2.72, depth / 2 + 0.32);
  board.setLocalScale(1.82, 0.62, 0.14);
  root.addChild(board);

  const texture = new pc.Texture(app.graphicsDevice, {
    width: canvas.width,
    height: canvas.height,
    format: pc.PIXELFORMAT_R8_G8_B8_A8,
    mipmaps: true
  });
  texture.setSource(canvas);

  const faceMaterial = new pc.StandardMaterial();
  faceMaterial.diffuseMap = texture;
  faceMaterial.emissiveMap = texture;
  faceMaterial.emissive = new pc.Color(0.45, 0.38, 0.27);
  faceMaterial.gloss = 3;
  faceMaterial.update();

  const face = new pc.Entity('Red Lion — painted tavern sign face');
  face.addComponent('render', { type: 'plane', material: faceMaterial });
  face.setLocalPosition(0, 2.72, depth / 2 + 0.397);
  face.setLocalEulerAngles(90, 0, 0);
  face.setLocalScale(1.72, 0.56, 1);
  root.addChild(face);

  for (const x of [-0.66, 0.66]) {
    const bracket = new pc.Entity('Red Lion — timber sign bracket');
    bracket.addComponent('render', { type: 'box', material: wood });
    bracket.setLocalPosition(x, 3.08, depth / 2 + 0.22);
    bracket.setLocalScale(0.08, 0.22, 0.08);
    root.addChild(bracket);
  }

  return true;
}

function toScenePoint(x, y, centerX, centerY, renderScale) {
  return {
    x: (x - centerX) * renderScale,
    z: (y - centerY) * renderScale
  };
}

export async function buildQuaterniusRedLion(app, pc, building, centerX, centerY, renderScale) {
  if (building?.id !== 'red-lion' || !building.entrance) {
    throw new TypeError('Expected the authored World9 Red Lion building record');
  }

  const containers = new Map();
  const loaded = await Promise.all(
    RED_LION_MODEL_FILES.map(async filename => [filename, await loadContainer(app, filename)])
  );
  for (const [filename, asset] of loaded) containers.set(filename, asset);

  const point = toScenePoint(
    building.x + building.w / 2,
    building.y + building.h / 2,
    centerX,
    centerY,
    renderScale
  );
  const width = building.w * renderScale;
  const depth = building.h * renderScale;
  const frontWallZ = depth / 2 - WALL_LOCAL_CENTER_Z;
  const backWallZ = -depth / 2 + WALL_LOCAL_CENTER_Z;
  const frontScaleX = width / 6;
  const sideScaleX = depth / 4;
  const third = width / 3;
  const halfDepth = depth / 4;

  const root = new pc.Entity('The Red Lion — Quaternius Medieval Village MegaKit');
  root.setPosition(point.x, 0, point.z);
  app.root.addChild(root);

  const part = (filename, name, transform) =>
    instantiatePart(root, containers.get(filename), name, transform);

  // South/front facade: the door is centered on the authored World9 entrance.
  part('Wall_Plaster_Window_Wide_Round.gltf', 'Red Lion — front left window wall', {
    x: -third, y: 0, z: frontWallZ, scaleX: frontScaleX
  });
  part('Wall_Plaster_Door_Round.gltf', 'Red Lion — front entrance wall', {
    x: 0, y: 0, z: frontWallZ, scaleX: frontScaleX
  });
  part('Wall_Plaster_Window_Wide_Round.gltf', 'Red Lion — front right window wall', {
    x: third, y: 0, z: frontWallZ, scaleX: frontScaleX
  });

  const shutterZ = frontWallZ + WALL_FRONT_FACE_Z - SHUTTER_LOCAL_CENTER_Z + 0.02;
  for (const x of [-third, third]) {
    part('Window_Wide_Round1.gltf', 'Red Lion — glazed arched window', {
      x, y: 0, z: depth / 2 - WINDOW_LOCAL_CENTER_Z
    });
    part('WindowShutters_Wide_Round_Open.gltf', 'Red Lion — open timber window shutters', {
      x, y: 0, z: shutterZ
    });
  }

  // Keep the genuine timber door centered and grounded inside the source
  // arched opening as the World9 facade modules scale to the building width.
  // This is a visual fit only: it does not create an interactive entrance.
  part('Door_1_Round.gltf', 'Red Lion — timber entrance door',
    fittedRedLionDoorTransform(frontScaleX, depth));

  // Three timber-framed plaster modules form the rear wall.
  for (const x of [-third, 0, third]) {
    part('Wall_Plaster_WoodGrid.gltf', 'Red Lion — rear timber-framed wall', {
      x, y: 0, z: backWallZ, yaw: 180, scaleX: frontScaleX
    });
  }

  // Two modular wall segments on each end close the footprint without changing World9 data.
  for (const z of [-halfDepth, halfDepth]) {
    part('Wall_Plaster_Straight.gltf', 'Red Lion — east side wall', {
      x: width / 2 - WALL_LOCAL_CENTER_Z,
      y: 0, z, yaw: 90, scaleX: sideScaleX
    });
    part('Wall_Plaster_Straight.gltf', 'Red Lion — west side wall', {
      x: -width / 2 + WALL_LOCAL_CENTER_Z,
      y: 0, z, yaw: -90, scaleX: sideScaleX
    });
  }

  // A single scaled roof module gives the 6.25 × 4.25 m authored footprint a modest overhang.
  const roofScaleX = 0.916;
  const roofScaleY = 0.85;
  const roofScaleZ = 0.931;
  const roofBaseY = WALL_HEIGHT;
  part('Roof_RoundTiles_4x6.gltf', 'Red Lion — Quaternius round-tile gabled roof', {
    x: 0,
    y: roofBaseY - ROOF_MIN_Y * roofScaleY,
    z: 0,
    yaw: 90,
    scaleX: roofScaleX,
    scaleY: roofScaleY,
    scaleZ: roofScaleZ
  });

  // Plaster-and-timber gable ends close the roof triangles at both ridge ends.
  const gableScaleX = 0.754;
  const gableScaleY = 0.78;
  const gableScaleZ = 0.7;
  const roofHalfLength = 3.78614 * roofScaleZ;
  const gableRootOffset = GABLE_LOCAL_CENTER_Z * gableScaleZ;
  const gableRootY = WALL_HEIGHT + 0.1318020672 * gableScaleY;
  for (const side of [-1, 1]) {
    part('Roof_Front_Brick6.gltf', 'Red Lion — timber-framed plaster gable', {
      x: side * (roofHalfLength - gableRootOffset),
      y: gableRootY,
      z: 0,
      yaw: side > 0 ? 90 : -90,
      scaleX: gableScaleX,
      scaleY: gableScaleY,
      scaleZ: gableScaleZ
    });
  }

  // A custom heraldic sign gives the tavern its Red Lion identity.
  const signboard = addRedLionSignboard(root, app, pc, depth);

  // Stone-and-brick chimney sits toward the rear roof slope.
  part('Prop_Chimney.gltf', 'Red Lion — masonry chimney', {
    x: -1.7,
    y: 4.0,
    z: -1.35
  });

  return Object.freeze({
    loaded: true,
    name: 'The Red Lion',
    source: 'Quaternius Medieval Village MegaKit',
    license: 'CC0-1.0',
    sourceCommit: QUATERNIUS_SOURCE.sourceCommit,
    world9BuildingId: building.id,
    world9Entrance: Object.freeze({ ...building.entrance }),
    footprintMeters: Object.freeze({ width, depth }),
    wallSegments: 10,
    gableEnds: 2,
    glazedWindows: 2,
    openShutters: 2,
    signboard,
    roofModel: 'Roof_RoundTiles_4x6.gltf',
    collisionAuthority: false,
    portalAuthority: false,
    gameplayAuthority: false
  });
}
