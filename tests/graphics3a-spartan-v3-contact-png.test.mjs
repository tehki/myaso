import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
const ci=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8");
test("V3 real in-game PNG requires BOTH independent native server authentication and actual active V3 Canvas source",()=>{
 assert.match(src,/MYASO_GRAPHICS3A_V3_CONTACT_PNG/);
 assert.match(src,/spartanV3ContactPng && !spartanV3Flight/);
 assert.match(src,/src.endsWith\("\/silver_kick_v3\.webp"\)/);
 assert.match(src,/args\[0\]===480 \|\| args\[0\]===640/);
 assert.match(src,/queueMicrotask\(\(\)=>\{/);
 assert.match(src,/gameCanvas\.toDataURL\("image\/png"\)/);
 assert.match(src,/contactPending:true|contactPending:false/);
 assert.match(src,/const result=original\.call\(this,image,\.\.\.args\)/);
 assert.match(src,/captureSpartanV3RealContactPngs\(/);
 assert.match(src,/receipt\.authenticOriginalSilverV3AtlasBothBrowsers!==true/);
 assert.match(src,/actualServerHitReceiptValidated:false,fullFrameAfterRenderLoopValidated:false/);
});
test("Screenshot evidence refuses missing or malformed PNG and hashes exact native data",()=>{
 assert.match(src,/if\(typeof value!=="string"\|\|!value\.startsWith\("data:image\/png;base64,"\)\)/);
 assert.match(src,/bytes\.length<15000/);
 assert.match(src,/89504e470d0a1a0a/);
 assert.match(src,/bytes\.readUInt32BE\(16\)<400/);
 assert.match(src,/bytes\.readUInt32BE\(20\)<300/);
 assert.match(src,/createHash\("sha256"\)/);
 assert.match(src,/native_v3_contact_manifest\.json/);
});
test("new source-only contact PNG job is independent, artifact strict, full quality intact",()=>{
 assert.match(ci,/graphics3a-spartan-v3-contact-png:/);
 assert.match(ci,/graphics3a-native-spartan-v3-connected:/);
 assert.match(ci,/quality:/);
 assert.match(ci,/MYASO_GRAPHICS3A_V3_CONTACT_PNG: "1"/);
 assert.match(ci,/include-hidden-files: true/);
 assert.match(ci,/if-no-files-found: error/);
 assert.match(ci,/actions\/upload-artifact@v4/);
});
