// Graphics 3A — reusable adult human source-animation contract (A3).
// Review/source tooling only. This module is deliberately NOT imported by the
// live game renderer. Missing actions resolve to null; never disguise them as Idle.
export const ADULT_HUMAN_RIG_ID = "adult-human-22-v1";

export const ADULT_HUMAN_BODY_PRESENTATIONS = Object.freeze([
  "adult-masculine",
  "adult-feminine",
]);

export const ADULT_HUMAN_DIRECTIONS = Object.freeze([
  "south", "southwest", "west", "northwest",
  "north", "northeast", "east", "southeast",
]);

// Canonical names from the original A0 editable Blender source. A1, A2 and
// R4 must retain this same 22-bone deformation contract.
export const ADULT_HUMAN_RIG_V1_BONES = Object.freeze([
  "Hips", "Spine", "Spine1", "Spine2", "Neck", "Head",
  "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase",
  "RightShoulder", "RightArm", "RightForeArm", "RightHand",
  "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase",
]);

// The later R3 anatomical body reuses this same rig and already carries
// idle/walk/run actions, but has not yet received its own accepted locomotion
// atlases. Do not draw A0/A1 procedural-study atlases on this different mesh.
export const ADULT_HUMAN_ANATOMICAL_BASE_V1 = Object.freeze({
  source: "R3 MakeHuman anatomical source",
  sourceLicense: "CC0-1.0",
  rigId: ADULT_HUMAN_RIG_ID,
  rigBoneCount: 22,
  sourceBlendPathTemplate:
    "assets/characters/adult-anatomy-r3/{body}-anatomical-shoulderroll-r3.blend",
  sourceGlbPathTemplate:
    "assets/characters/adult-anatomy-r3/{body}-anatomical-shoulderroll-r3.glb",
  sourceActions: Object.freeze([
    "idle", "walk", "run", "roll_r3_shoulder_ground",
  ]),
  locomotionAtlasesAvailable: false,
  status: "editable-source-only-no-approved-locomotion-atlases",
  productionActive: false,
});

export function resolveAdultHumanAnatomicalBase(bodyPresentation) {
  if (!ADULT_HUMAN_BODY_PRESENTATIONS.includes(bodyPresentation)) return null;
  return Object.freeze({
    ...ADULT_HUMAN_ANATOMICAL_BASE_V1,
    bodyPresentation,
    sourceBlendPath: ADULT_HUMAN_ANATOMICAL_BASE_V1.sourceBlendPathTemplate
      .replaceAll("{body}", bodyPresentation),
    sourceGlbPath: ADULT_HUMAN_ANATOMICAL_BASE_V1.sourceGlbPathTemplate
      .replaceAll("{body}", bodyPresentation),
  });
}

const rollFrames = Object.freeze([1, 3, 5, 7, 9, 11, 15, 22]);
const rollTimes = Object.freeze(rollFrames.map(frame => (frame - 1) * 1000 / 60));

const previewClip = (source, clip, frameCount, sourceFrames) => Object.freeze({
  status: "procedural-study-preview-only",
  source,
  modelSource: "A0/A1 procedural body study",
  clip,
  sourceActionName: clip,
  atlasPathTemplate: "web/assets/adults/{body}_" + clip + ".webp",
  manifestPathTemplate: "web/assets/adults/{body}_" + clip + ".json",
  directionCount: 8,
  framesPerDirection: frameCount,
  framePx: 160,
  sourceFps: 60,
  sourceFrames: Object.freeze([...sourceFrames]),
  timingQualified: false,
  groundContactQualified: false,
  anatomicalAtlasAvailable: false,
  productionActive: false,
});

const rollVariant = (source, sourceActionName, atlasPathTemplate, manifestPathTemplate) => Object.freeze({
  status: "source-visual-hold",
  source,
  clip: "roll",
  sourceActionName,
  atlasPathTemplate,
  manifestPathTemplate,
  directionCount: 8,
  framesPerDirection: 8,
  framePx: 160,
  durationMs: 350,
  sourceFps: 60,
  sourceFrames: rollFrames,
  sourceFrameTimesMs: rollTimes,
  timingQualified: true,
  groundContactQualified: false,
  productionActive: false,
});

const missingClip = Object.freeze({status: "missing", productionActive: false});

// Current reusable library inventory. "Preview-only" and "visual-hold" are
// explicit quality states, not approvals. No entry enables a live renderer.
export const ADULT_HUMAN_CLIP_COVERAGE = Object.freeze({
  idle: previewClip("A0", "idle", 4, [1, 5, 9, 13]),
  walk: previewClip("A1", "walk", 4, [1, 5, 9, 13]),
  run: previewClip("A1", "run", 4, [1, 5, 9, 13]),
  roll: Object.freeze({
    status: "source-visual-hold",
    variants: Object.freeze({
      a2: rollVariant("A2", "roll", "web/assets/adults/{body}_roll.webp",
        "web/assets/adults/{body}_roll.json"),
      r4: rollVariant("R4", "roll_r4_real_mocap_candidate", "web/assets/adults-review-r4/{body}_roll.webp",
        "web/assets/adults-review-r4/{body}_roll.json"),
    }),
  }),
  start: missingClip,
  stop: missingClip,
  turn: missingClip,
  jump: missingClip,
  fall: missingClip,
  land: missingClip,
  attack: missingClip,
  block: missingClip,
  parry: missingClip,
  kick: missingClip,
  hitReaction: missingClip,
  stun: missingClip,
  knockdown: missingClip,
  death: missingClip,
  pickup: missingClip,
  equip: missingClip,
  unequip: missingClip,
  drop: missingClip,
});

function expandTemplate(template, bodyPresentation) {
  return template.replaceAll("{body}", bodyPresentation);
}

// Resolve only a source-backed clip. Roll intentionally requires an explicit
// A2/R4 variant because neither candidate has human visual approval.
export function resolveAdultHumanClip(bodyPresentation, clipName, variant = null) {
  if (!ADULT_HUMAN_BODY_PRESENTATIONS.includes(bodyPresentation)) return null;
  if (typeof clipName !== "string" ||
      !Object.hasOwn(ADULT_HUMAN_CLIP_COVERAGE, clipName)) return null;

  const entry = ADULT_HUMAN_CLIP_COVERAGE[clipName];
  if (entry.status === "missing") return null;

  let selected = entry;
  if (entry.variants) {
    if (typeof variant !== "string" || !Object.hasOwn(entry.variants, variant)) return null;
    selected = entry.variants[variant];
  } else if (variant !== null) {
    return null;
  }

  return Object.freeze({
    ...selected,
    bodyPresentation,
    atlasPath: expandTemplate(selected.atlasPathTemplate, bodyPresentation),
    manifestPath: expandTemplate(selected.manifestPathTemplate, bodyPresentation),
  });
}
