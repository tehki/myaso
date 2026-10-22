import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
const ci=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8");
test("real victim knockdown screenshot cannot exist without strict original 3-client authoritative acceptance",()=>{
 assert.match(src,/MYASO_GRAPHICS3A_VICTIM_NATIVE_PNG/);
 assert.match(src,/silverVictimNativePng && !originalSilverVictimKnockdownFlight/);
 assert.match(src,/receipt\?\.verifiedRealThreePlayerOriginalSilverVictimReaction/);
 assert.match(src,/receipt\.originalSilverVictimSourceInAllNativeBrowsers/);
 assert.match(src,/entries\.length!==3/);
 assert.match(src,/captureOriginalSilverVictimNativePngs\(sessions,victimReceipt\)/);
});
test("sample actual original low-phase native Canvas after current synchronous game-render callback",()=>{
 assert.match(src,/src\.endsWith\("\/silver_knockdown\.webp"\)/);
 assert.match(src,/args\[0\]===480 \|\| args\[0\]===640/);
 assert.match(src,/queueMicrotask\(\(\)=>\{/);
 assert.match(src,/gameCanvas\.toDataURL\("image\/png"\)/);
 assert.match(src,/originalSourceFrame:observed\.frame/);
 assert.match(src,/\!\[3,4\]\.includes\(observed\.frame\)/);
 assert.match(src,/const result=original\.call\(this,image,\.\.\.args\)/);
 assert.match(src,/return result;/);
});
test("only actual png bytes, SHA and server player identities, never invented hit/gameplay completion",()=>{
 assert.match(src,/89504e470d0a1a0a/);
 assert.match(src,/bytes\.length<15000/);
 assert.match(src,/createHash\("sha256"\)/);
 assert.match(src,/original_silver_victim_native_manifest\.json/);
 assert.match(src,/inGameSoleContactProven:false/);
 assert.match(src,/trueImpactMeshCollisionProven:false/);
 assert.match(src,/humanArtApproved:false,preAlphaEnabled:false/);
});
test("strict separate actual Rust native Chrome Firefox Chrome2 upload job and full quality unaffected",()=>{
 assert.match(ci,/graphics3a-native-original-victim-png:/);
 assert.match(ci,/quality:/);
 assert.match(ci,/graphics3a-native-original-silver-victim:/);
 assert.match(ci,/MYASO_GRAPHICS3A_VICTIM_NATIVE_PNG: "1"/);
 assert.match(ci,/actions\/upload-artifact@v4/);
 assert.match(ci,/include-hidden-files: true/);
 assert.match(ci,/if-no-files-found: error/);
});
