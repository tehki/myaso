// Graphics 3A — reusable adult-human animation playback planning.
// SOURCE/REVIEW ONLY. Never imported by Silver Knight or the live Combat client.
// Missing source actions return null; no procedural substitute is invented.
import {
  ADULT_HUMAN_DIRECTIONS,
  resolveAdultHumanClip
} from './adult-human-animation-contract.mjs';
import {sampleAnimationFrame} from './human-animation-timeline.mjs';

export function sourceHumanTimeline(clip) {
  if (!clip || clip.productionActive !== false ||
    !Number.isFinite(clip.sourceFps) || clip.sourceFps <= 0 ||
    !Array.isArray(clip.sourceFrames) || clip.sourceFrames.length === 0) return null;

  if (clip.clip === 'roll' && clip.durationMs === 350 &&
    Array.isArray(clip.sourceFrameTimesMs)) {
    return Object.freeze({
      durationMs: clip.durationMs,
      frameTimesMs: Object.freeze([...clip.sourceFrameTimesMs]),
      loop: false, origin: 'original-Blender-roll-keyframe-times'
    });
  }

  if (!['idle','walk','run'].includes(clip.clip)) return null;
  const frames=clip.sourceFrames;
  if (frames.some((n,i)=>!Number.isInteger(n) || n<1 ||
    (i>0 && n<=frames[i-1]))) return null;
  const step=frames.length>1?frames[1]-frames[0]:null;
  if (!step || frames.some((n,i)=>n!==frames[0]+i*step)) return null;
  // A0/A1 render-study source atlas timing; derived from its actual declared
  // uniformly-spaced frame indexes, NOT a new Blender animation or approval.
  const frameTimesMs=frames.map(frame=>(frame-frames[0])*1000/clip.sourceFps);
  const durationMs=(frames[frames.length-1]-frames[0]+step)*1000/clip.sourceFps;
  return Object.freeze({
    durationMs,frameTimesMs:Object.freeze(frameTimesMs),loop:true,
    origin:'declared-A0-A1-source-frame-index'
  });
}

export function sampleAdultHumanSourceMotion({
  bodyPresentation,
  clipName,
  variant=null,
  direction,
  elapsedMs
}={}) {
  if (!ADULT_HUMAN_DIRECTIONS.includes(direction)) return null;
  const clip=resolveAdultHumanClip(bodyPresentation,clipName,variant);
  const timeline=sourceHumanTimeline(clip);
  if (!timeline) return null;
  const sampled=sampleAnimationFrame({elapsedMs,...timeline});
  if (!sampled) return null;
  return Object.freeze({
    bodyPresentation,clipName,variant,direction,
    source:clip.source,sourceActionName:clip.sourceActionName,
    frame:sampled.frame,
    originalSourceFrame:clip.sourceFrames[sampled.frame],
    originalSourceTimeMs:sampled.sourceTimeMs,
    elapsedMs:sampled.elapsedMs,
    complete:sampled.complete,
    loop:sampled.loop,
    atlasPath:clip.atlasPath,
    modelSource:clip.modelSource ?? 'source-visual-hold',
    sourceStatus:clip.status,
    footContactQualified:Boolean(clip.groundContactQualified),
    productionActive:false
  });
}
