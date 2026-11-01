import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceHumanTimeline,sampleAdultHumanSourceMotion
} from '../src/browser/adult-human-source-motion.mjs';
import {
  ADULT_HUMAN_BODY_PRESENTATIONS,ADULT_HUMAN_DIRECTIONS,resolveAdultHumanClip
} from '../src/browser/adult-human-animation-contract.mjs';

test('existing A0/A1 original human source frames form a bounded looping timeline',()=>{
  for(const bodyPresentation of ADULT_HUMAN_BODY_PRESENTATIONS){
    for(const clipName of ['idle','walk','run']){
      const clip=resolveAdultHumanClip(bodyPresentation,clipName);
      const timeline=sourceHumanTimeline(clip);
      assert.equal(timeline.loop,true);
      assert.equal(timeline.frameTimesMs.length,4);
      assert.ok(Math.abs(timeline.durationMs-800/3)<1e-9);
      assert.deepEqual(clip.sourceFrames,[1,5,9,13]);
      for(const direction of ADULT_HUMAN_DIRECTIONS){
        const result=sampleAdultHumanSourceMotion({
          bodyPresentation,clipName,direction,elapsedMs:timeline.durationMs+1
        });
        assert.equal(result.frame,0);
        assert.equal(result.originalSourceFrame,1);
        assert.equal(result.direction,direction);
        assert.equal(result.productionActive,false);
        assert.equal(result.footContactQualified,false);
      }
    }
  }
});

test('A2 vs R4 roll choices remain explicit and sample real nonuniform source time',()=>{
  for(const bodyPresentation of ADULT_HUMAN_BODY_PRESENTATIONS) {
    assert.equal(sampleAdultHumanSourceMotion({
      bodyPresentation,clipName:'roll',direction:'south',elapsedMs:0
    }),null);
    for(const variant of ['a2','r4']) {
      const opts={bodyPresentation,clipName:'roll',variant,direction:'northwest'};
      assert.equal(sampleAdultHumanSourceMotion({...opts,elapsedMs:0}).originalSourceFrame,1);
      assert.equal(sampleAdultHumanSourceMotion({...opts,elapsedMs:170}).originalSourceFrame,11);
      assert.equal(sampleAdultHumanSourceMotion({...opts,elapsedMs:234}).originalSourceFrame,15);
      const end=sampleAdultHumanSourceMotion({...opts,elapsedMs:400});
      assert.equal(end.originalSourceFrame,22);
      assert.equal(end.complete,true);
      assert.equal(end.loop,false);
      assert.equal(end.productionActive,false);
    }
  }
});

test('un-authored Jump/Fall/Land and Combat/Items animations stay NULL, never silently use Idle',()=>{
  for(const bodyPresentation of ADULT_HUMAN_BODY_PRESENTATIONS)
    for(const clipName of ['jump','fall','land','attack','block','parry','kick','death','pickup']){
      assert.equal(sampleAdultHumanSourceMotion({
        bodyPresentation,clipName,direction:'south',elapsedMs:100
      }),null,bodyPresentation+' '+clipName);
    }
  assert.equal(sampleAdultHumanSourceMotion({
    bodyPresentation:'adult-masculine',clipName:'walk',direction:'bad',elapsedMs:100
  }),null);
  assert.equal(sampleAdultHumanSourceMotion({
    bodyPresentation:'adult-masculine',clipName:'walk',direction:'south',elapsedMs:-1
  }),null);
  assert.equal(sampleAdultHumanSourceMotion({
    bodyPresentation:'adult-masculine',clipName:'walk',direction:'south',elapsedMs:NaN
  }),null);
});

test('A3 sampling is purely source-time art code; source cannot create Silver gameplay actions',()=>{
  assert.equal(sourceHumanTimeline(null),null);
  assert.equal(sourceHumanTimeline({productionActive:true,sourceFrames:[1],sourceFps:60}),null);
  assert.equal(sourceHumanTimeline({productionActive:false,sourceFrames:[1,1],sourceFps:60,clip:'walk'}),null);
});
