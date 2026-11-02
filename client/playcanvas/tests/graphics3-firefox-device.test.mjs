import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preferredGreyhavenDeviceTypes,createGreyhavenGraphicsDevice} from '../src/graphics-device.js';

const pc=Object.freeze({DEVICETYPE_WEBGPU:'webgpu',DEVICETYPE_WEBGL2:'webgl2'});
const FIREFOX='Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0';
const CHROME='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0 Safari/537.36';

test('Firefox starts with actual WebGL2, never attempts WebGPU first',()=>{
  assert.deepEqual(preferredGreyhavenDeviceTypes(pc,FIREFOX),['webgl2']);
  assert.deepEqual(preferredGreyhavenDeviceTypes(pc,CHROME),['webgpu','webgl2']);
  assert.throws(()=>preferredGreyhavenDeviceTypes(pc,null),TypeError);
});

test('native graphics device selection preserves Engine ownership and validates real result',async()=>{
  const calls=[];
  const engine={...pc,async createGraphicsDevice(canvas,options){
    calls.push({canvas,deviceTypes:[...options.deviceTypes]});
    return {deviceType:options.deviceTypes[0]==='webgl2'?'webgl2':'webgpu'};
  }};
  const canvas={};
  const firefox=await createGreyhavenGraphicsDevice(engine,canvas,FIREFOX);
  assert.equal(firefox.deviceType,'webgl2');
  assert.deepEqual(calls[0],{canvas,deviceTypes:['webgl2']});
  assert.equal((await createGreyhavenGraphicsDevice(engine,canvas,CHROME)).deviceType,'webgpu');
  assert.deepEqual(calls[1].deviceTypes,['webgpu','webgl2']);
});

test('Firefox does not silently call a fake WebGPU device or downgrade below WebGL2',async()=>{
  const wrong={...pc,async createGraphicsDevice(){return{deviceType:'webgpu'}}};
  await assert.rejects(createGreyhavenGraphicsDevice(wrong,{},FIREFOX),/genuine WebGL2/);
  const fail={...pc,async createGraphicsDevice(){throw Error('Failed to create a graphics device')}};
  await assert.rejects(createGreyhavenGraphicsDevice(fail,{},FIREFOX),/Failed to create a graphics device/);
});

test('real runtime calls the shared native selector and leaves World/Rust/Combat authority alone',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/createGreyhavenGraphicsDevice\(pc, canvas, navigator\.userAgent\)/);
  assert.match(main,/dataset\.graphicsDeviceType = device\.deviceType/);
  assert.match(main,/buildGreyhavenBlockout\(app, pc\)/);
  assert.match(main,/connectDevRustActors/);
});
