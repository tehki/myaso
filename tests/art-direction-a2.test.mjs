import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../assets/environment/greyhaven/blood-iron-a2.art.json', import.meta.url), 'utf8'));
const a1 = JSON.parse(readFileSync(new URL('../assets/environment/greyhaven/art-manifest.v1.json', import.meta.url), 'utf8'));
const author = readFileSync(new URL('../tools/art/build_blood_iron_a2.py', import.meta.url), 'utf8');

test('A2 look-dev keeps the approved Red Lion dimensions and art-only boundary', () => {
  assert.equal(manifest.milestone.includes('non-runtime'), true);
  assert.equal(manifest.geometry.metersPerGameUnit, a1.coordinateConvention.metersPerWorldUnit);
  assert.deepEqual(manifest.sceneBuildings[0].unitMeters, [
    a1.firstSlice.approvedBuilding.exterior.width * manifest.geometry.metersPerGameUnit,
    a1.firstSlice.approvedBuilding.exterior.height * manifest.geometry.metersPerGameUnit
  ]);
  assert.equal(manifest.integration.changesGameplay, false);
  assert.equal(manifest.integration.changesPortalOrAuthority, false);
  assert.equal(manifest.integration.changesKnights, false);
  assert.equal(manifest.integration.productionApproved, false);
});

test('A2 authored scene has distinct architecture and explicitly separate roof candidates', () => {
  assert.deepEqual(manifest.sceneBuildings.map(x => x.id), [
    'red-lion', 'gable-merchant', 'tanners-cottage', 'stone-weaver', 'blacksmith'
  ]);
  assert.equal(manifest.street.cobblestones.count, 1032);
  assert.equal(manifest.street.cobblestones.meshBatches, 1);
  assert.match(author, /roof-occlusion-candidate/);
  assert.match(author, /world-base-candidate/);
  assert.match(author, /bpy\.ops\.wm\.obj_import/);
});

test('A2 CPU look-dev uses self-authored procedural materials, not external downloads', () => {
  assert.equal(manifest.rendering.device, 'CPU');
  assert.equal(manifest.rendering.cameraExportLocked, false);
  assert.match(author, /ShaderNodeTexNoise/);
  assert.match(author, /ShaderNodeBump/);
  assert.match(author, /scene\.cycles\.device\s*=\s*"CPU"/);
  assert.doesNotMatch(author, /ShaderNodeTexImage|https?:\/\/|requests\.|urlretrieve\(/);
});

test('A2 tavern and street barrels have non-overlapping outer iron hoops', () => {
  // Read the authored layout, rather than testing an unrelated copy of the positions.
  const definition = author.match(/BARREL_LAYOUT = \(\r?\n([\s\S]*?)\r?\n\)/);
  assert.ok(definition, 'barrel positions must be declared in a reviewable layout');
  const barrels = [...definition[1].matchAll(/\("([^"]+)",\s*(-?[\d.]+),\s*(-?[\d.]+)\)/g)]
    .map(([, name, x, y]) => ({ name, x: Number(x), y: Number(y) }));
  assert.equal(barrels.length, 7, 'both A1 and A2 barrel groups should be rebuilt');
  const radius = Number(author.match(/BARREL_OUTER_RADIUS = ([\d.]+)/)?.[1]);
  const requiredGap = Number(author.match(/BARREL_MIN_GAP = ([\d.]+)/)?.[1]);
  assert.equal(radius, 0.315);
  assert.ok(requiredGap >= 0.1);
  for (let i = 0; i < barrels.length; i++) {
    for (let j = 0; j < i; j++) {
      const gap = Math.hypot(barrels[i].x-barrels[j].x, barrels[i].y-barrels[j].y)-2*radius;
      assert.ok(gap >= requiredGap-1e-9,
        `barrels ${barrels[i].name} / ${barrels[j].name} have edge gap ${gap.toFixed(3)}m`);
    }
  }
  assert.match(author, /use_split_groups=True/);
  assert.match(author, /bpy\.data\.objects\.remove\(ob, do_unlink=True\)/);
  assert.match(author, /assert edge_gap >= BARREL_MIN_GAP/);
});


test('A2 knight/building scale review only reads approved A3 GLBs and keeps render offline', () => {
  const qa = readFileSync(new URL('../tools/art/compare_a3_knights_to_greyhaven.py', import.meta.url), 'utf8');
  assert.match(qa, /bpy\.ops\.import_scene\.gltf/);
  assert.match(qa, /bpy\.ops\.wm\.open_mainfile/);
  assert.match(qa, /len\(r\.data\.bones\)/);
  assert.match(qa, /rollAuthoritativeMs": 170/);
  assert.match(qa, /recoveryAuthoritativeMs": 180/);
  assert.match(qa, /"changesGameplay": False/);
  assert.match(qa, /"actualBrowserSpriteComparisonDone": False/);
  assert.match(qa, /"modelSourcesStoredInRepository": False/);
  assert.match(qa, /"nativeBlenderSceneCommitted": False/);
  assert.doesNotMatch(qa, /export_scene\.gltf|requests\.|urlretrieve\(/);
});


test('A2 GLB comparison excludes non-character spheres and samples real roll clips', () => {
  const qa = readFileSync(new URL('../tools/art/compare_a3_knights_to_greyhaven.py', import.meta.url), 'utf8');
  assert.match(qa, /ob\.name\.startswith\("Icosphere"\)/);
  assert.match(qa, /len\(ob\.data\.vertices\) <= 64/);
  assert.match(qa, /ob\.hide_render = True/);
  assert.match(qa, /if ob\.type != "MESH" or is_proxy\(ob\)/);
  assert.match(qa, /default=5\)/);
  assert.match(qa, /rig\.animation_data\.action = idle/);
  assert.match(qa, /rig\.animation_data\.action = hero\["roll"\]/);
  assert.match(qa, /roll\.frame_range\[0\] <= args\.roll_frame <= roll\.frame_range\[1\]/);
  assert.match(qa, /"actualBrowserSpriteComparisonDone": False/);
});


test('A2 A3 roll stills keep each knight visible independently of the other', () => {
  const qa = readFileSync(new URL('../tools/art/compare_a3_knights_to_greyhaven.py', import.meta.url), 'utf8');
  assert.match(qa, /blood_iron_silver_roll_a2\.png/);
  assert.match(qa, /blood_iron_sentinel_roll_a2\.png/);
  assert.match(qa, /for ob in companion\["objects"\]:/);
  assert.match(qa, /ob\.hide_render = True/);
  assert.match(qa, /hero\["roll"\]/);
  assert.match(qa, /scene\.frame_set\(args\.roll_frame\)/);
  assert.match(qa, /if ob\.type == "MESH" and not is_proxy\(ob\):/);
});


test('A2.1 Red Lion polish stays additive and preserves door, barrels and original meshes', () => {
  const art = readFileSync(new URL('../tools/art/polish_red_lion_a21.py', import.meta.url), 'utf8');
  assert.match(art, /bpy\.ops\.wm\.open_mainfile/);
  assert.match(art, /originals = \{o\.name for o in scene\.objects/);
  assert.match(art, /assert all\(name in scene\.objects for name in originals\)/);
  assert.match(art, /len\(original_barrels\) == 7/);
  assert.match(art, /assert all\(tuple\(round\(v,6\) for v in scene\.objects\[name\]\.location\)==pos/);
  assert.match(art, /"combatChanged":False/);
  assert.match(art, /"doorPortalChanged":False/);
  assert.match(art, /"rollChanged":False/);
  assert.doesNotMatch(art,/requests\.|urlretrieve\(|export_scene\.gltf|subprocess\./);
});

test('A2.1 materials remain three batched geometry surfaces with a separate roof layer', () => {
  const art = readFileSync(new URL('../tools/art/polish_red_lion_a21.py', import.meta.url), 'utf8');
  assert.match(art, /tile_rows, tile_cols = 11, 16/);
  assert.match(art, /assert 300<=tile_count<=352/);
  assert.match(art, /assert stone_count >= 55/);
  assert.match(art, /assert peg_count==12/);
  assert.match(art, /"newArtMeshes":3/);
  assert.match(art, /"meshBatches":1/);
  assert.match(art, /"roof-occlusion-candidate"/);
  assert.match(art, /scene\.cycles\.device = "CPU"/);
});


test('A2.1 retains superseded A1 roof courses but hides their protruding render layer', () => {
  const art = readFileSync(new URL('../tools/art/polish_red_lion_a21.py', import.meta.url), 'utf8');
  assert.match(art,/bpy\.data\.objects\.get\("Red Lion \/ roof_tile_courses"\)/);
  assert.match(art,/legacy_courses\.hide_render = True/);
  assert.match(art,/"legacyRoofCoursesRetainedButHidden": bool\(legacy_courses\.hide_render\)/);
  assert.match(art,/assert all\(name in scene\.objects for name in originals\)/);
});


test('A2.2 adds four roof families without altering A2.1 game or approved barrels', () => {
  const art = readFileSync(new URL('../tools/art/polish_greyhaven_a22.py', import.meta.url), 'utf8');
  for (const building of ['Gable Merchant', "Tanner's Cottage", 'Stone Weaver', 'Blacksmith']) {
    assert.ok(art.includes('"' + building + '"'));
  }
  assert.match(art, /len\(roof\.data\.polygons\)==5/);
  assert.match(art, /roof\.matrix_world @ roof\.data\.vertices\[i\]\.co/);
  assert.match(art, /"roof-occlusion-candidate"/);
  assert.match(art, /assert len\(oldcourses\)==14/);
  assert.match(art, /"originalBarrelsPreserved":len\(barrels\)/);
  assert.match(art, /"combatChanged":False/);
  assert.match(art, /"portalChanged":False/);
  assert.match(art, /"A3RollChanged":False/);
  assert.doesNotMatch(art,/requests\.|urlretrieve\(|export_scene\.gltf|subprocess\./);
});

test('A2.2 batches roof and facade detail without introducing unbounded object counts', () => {
  const art = readFileSync(new URL('../tools/art/polish_greyhaven_a22.py', import.meta.url), 'utf8');
  assert.match(art, /"newMeshObjects":5/);
  assert.match(art, /"oakDoorPlanks":planks_count/);
  assert.match(art, /len\(roof_objs\)==4/);
  assert.match(art, /planks_count==28 and hinges_count==8/);
  assert.match(art, /"textureAtlasBaked":False/);
  assert.match(art, /"browserFrameTimeMeasured":False/);
  assert.match(art, /scene\.cycles\.device="CPU"/);
});


test('A2.3 uses explicit roof names, never broad gable tags, and stays review-only', () => {
  const src=readFileSync(new URL('../tools/art/render_greyhaven_a23_layers.py',import.meta.url),'utf8');
  assert.match(src,/def is_actual_roof\(ob\):/);
  assert.match(src,/ROOF_SUFFIXES=/);
  assert.match(src,/assert "Red Lion \/ gables" in base_names/);
  assert.match(src,/assert "Gable Merchant \/ plaster walls" in base_names/);
  assert.match(src,/assert "Gable Merchant \/ roof occlusion" in roof_names/);
  assert.match(src,/ob\.hide_render=original\[ob\.name\] or/);
  assert.match(src,/scene\.render\.film_transparent=True/);
  assert.match(src,/scene\.render\.image_settings\.color_mode="RGBA"/);
  assert.match(src,/"roofOcclusionRuntimeActive":False/);
  assert.match(src,/"sourceSceneSaved":False/);
});
test('A2.3 WebP exporter validates lossless alpha, visible pixels and composite error', () => {
  const src=readFileSync(new URL('../tools/art/encode_greyhaven_a23_webp.py',import.meta.url),'utf8');
  assert.match(src,/lossless=True,method=6,exact=True/);
  assert.match(src,/ImageChops\.difference/);
  assert.match(src,/transparent_fraction/);
  assert.match(src,/greyhaven_a23_layer_composite_preview\.png/);
  assert.match(src,/compositeRGBMeanAbsoluteErrorVsFullRender/);
  assert.match(src,/compositeForegroundRGBMeanAbsoluteErrorVsFullRender/);
  assert.match(src,/greyhaven_a23_checkerboard_preview\.png/);
  assert.match(src,/"performanceFPSMeasured":False/);
  assert.doesNotMatch(src,/requests\.|urlretrieve\(|subprocess\.|shutil\.rmtree/);
});


test('A2.4 projection comparator reads true viewport zoom and rejects oblique-to-XY registration', () => {
  const source=readFileSync(new URL('../tools/art/measure_greyhaven_a24_projection.py',import.meta.url),'utf8');
  assert.match(source,/export const ARENA_VIEW_ZOOM/);
  assert.match(source,/world_to_camera_view/);
  assert.match(source,/world_to_camera_view\(scene,camera,v\)/);
  assert.match(source,/door_server=\(float\(door_world\["x"\]\),float\(door_world\["y"\]\)\)/);
  assert.match(source,/width\/2\+\(wx-door_server\[0\]\)\*zoom/);
  assert.match(source,/height\/2\+\(wy-door_server\[1\]\)\*zoom/);
  assert.match(source,/"directSingleLayerPlacementApproved":False/);
  assert.match(source,/"requiresCameraMatchedRerender":True/);
  assert.doesNotMatch(source,/save_as_mainfile|requests\.|urlretrieve\(/);
});

test('A2.4 cropped roof layer roundtrips pixel-identically and is explicitly offline', () => {
  const source=readFileSync(new URL('../tools/art/crop_greyhaven_a24_roof.py',import.meta.url),'utf8');
  assert.match(source,/lossless=True,method=6,exact=True/);
  assert.match(source,/full\.getchannel\("A"\)\.getbbox\(\)/);
  assert.match(source,/rebuilt\.alpha_composite/);
  assert.match(source,/ImageChops\.difference/);
  assert.match(source,/"coordinateSpace":"UNSCALED A2\.3 Blender review camera pixel frame/);
  assert.match(source,/"runtimeIntegrated":False/);
  assert.match(source,/"stableGameWorldPivotValidated":False/);
});


test('A2.5 overhead bake uses real browser zoom and a deliberately game-XY compatible camera',()=>{
  const source=readFileSync(new URL('../tools/art/render_greyhaven_a25_xy_slices.py',import.meta.url),'utf8');
  assert.match(source,/export const ARENA_VIEW_ZOOM/);
  assert.match(source,/camera\.data\.ortho_scale=args\.pixels\/pixels_per_meter/);
  assert.match(source,/camera\.data\.type="ORTHO"/);
  assert.match(source,/camera_add\(location=\(0,0,30\),rotation=\(0,0,0\)\)/);
  assert.match(source,/max_err<\.01/);
  assert.match(source,/gameAlignedPixelsPerMeterYAfterFlip/);
  assert.match(source,/"authoritativeWorldPlacementVerified":False/);
  assert.match(source,/"browserSpritePivotVerified":False/);
  assert.match(source,/"sourceBlenderSaved":False/);
  assert.match(source,/"gameplayModified":False/);
  assert.match(source,/"A3RollModified":False/);
  assert.doesNotMatch(source,/save_as_mainfile|export_scene\.gltf|subprocess\.|requests\./);
});

test('A2.5 WebP encoder flips Y, crops independently and guards roundtrip without activating sprites',()=>{
  const source=readFileSync(new URL('../tools/art/encode_greyhaven_a25_xy_webp.py',import.meta.url),'utf8');
  assert.match(source,/Image\.Transpose\.FLIP_TOP_BOTTOM/);
  assert.match(source,/lossless=True,method=6,exact=True/);
  assert.match(source,/ImageChops\.difference\(restored,benchmark\)/);
  assert.match(source,/drawOffsetFromVisualDoorPixels/);
  assert.match(source,/visualDoorAnchorPixelsInCroppedImage/);
  assert.match(source,/"roofOcclusionRuntimeEnabled":False/);
  assert.match(source,/"doorPortalAuthorityVerified":False/);
  assert.match(source,/"browserPerformanceMeasured":False/);
  assert.doesNotMatch(source,/requests\.|subprocess\.|shutil\.rmtree/);
});


test('A2.6 preserves oblique 3/4 architectural view while isolating roof and facade layers',()=>{
  const src=readFileSync(new URL('../tools/art/render_greyhaven_a26_billboards.py',import.meta.url),'utf8');
  assert.match(src,/A2 \/ Red Lion hero \/ 3-4 angle/);
  assert.match(src,/camera\.rotation_euler=rotation/);
  assert.match(src,/camera\.data\.ortho_scale=scale/);
  assert.match(src,/camera\.location=anchor\+rotation\.to_quaternion\(\)@Vector\(\(0,0,40\)\)/);
  assert.match(src,/for layer in \("base","roof","whole"\)/);
  assert.match(src,/ORIGINAL\[ob\.name\] or not visible/);
  assert.match(src,/max\(mismatches\)>10/);
  assert.match(src,/"gameXYProjectionMatched":False/);
  assert.match(src,/"gameplayChanged":False/);
  assert.match(src,/"A3RollChanged":False/);
  assert.match(src,/"productionApproved":False/);
  assert.doesNotMatch(src,/save_as_mainfile|export_scene\.gltf|subprocess\.|requests\./);
});
test('A2.6 per-building lossless cropped roof/walls do not imply runtime game XY coordinates',()=>{
  const src=readFileSync(new URL('../tools/art/encode_greyhaven_a26_webp.py',import.meta.url),'utf8');
  assert.match(src,/lossless=True,method=6,exact=True/);
  assert.match(src,/ImageChops\.difference\(restored,original\)/);
  assert.match(src,/drawOffsetPixelsFromVisualDoor/);
  assert.match(src,/compositeForegroundRGBMeanAbsoluteErrorVsWholeRender/);
  assert.match(src,/"browserGameXYAligned":False/);
  assert.match(src,/"roofOcclusionValidated":False/);
  assert.match(src,/"gameWorldDoorPositionValidated":False/);
  assert.match(src,/"productionApproved":False/);
});
