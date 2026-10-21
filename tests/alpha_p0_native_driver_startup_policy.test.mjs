import test from "node:test";
import assert from "node:assert/strict";
import {
  nativeDriverPortForAttempt,retryNativeFirefoxSession
} from "../scripts/alpha_p0_native_driver_startup_policy.mjs";

test("actual W3C Firefox Linux session timeout allows one distinct-port fresh driver only",()=>{
  const firefox={family:"firefox",name:"firefox-2",port:9652};
  const timeout=Object.assign(new Error("real W3C /session timed out"),{name:"TimeoutError"});
  assert.equal(nativeDriverPortForAttempt(firefox,0),9652);
  assert.equal(nativeDriverPortForAttempt(firefox,1),9752);
  assert.equal(retryNativeFirefoxSession(timeout,firefox,0,"linux"),true);
  assert.equal(retryNativeFirefoxSession(timeout,firefox,1,"linux"),false);
  assert.equal(retryNativeFirefoxSession(timeout,firefox,0,"win32"),false);
  assert.equal(retryNativeFirefoxSession(timeout,{...firefox,family:"chrome"},0,"linux"),false);
});
test("startup retry policy never masks malformed or successful W3C responses, synthetic admission failures",()=>{
  const browser={family:"firefox",port:9652};
  for(const error of [
    undefined,null,new Error("actual game admission failed"),
    Object.assign(new Error("session rejected"),{name:"WebDriverError"}),
    Object.assign(new Error("abort"),{name:"AbortError"}),
    {name:"SyntaxError"},
  ])assert.equal(retryNativeFirefoxSession(error,browser,0,"linux"),false);
  for(const invalid of [
    [null,0],[{port:0},0],[{port:65535},0],
    [{port:9652},-1],[{port:9652},2],[{port:9652},NaN],
  ])assert.throws(()=>nativeDriverPortForAttempt(...invalid));
});
