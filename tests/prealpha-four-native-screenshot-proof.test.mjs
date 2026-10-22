import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
const ci=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8");
test("actual W3C browser PNG capture requires qualified real four-person roster",()=>{
 assert.match(runner,/MYASO_GRAPHICS3A_FOUR_NATIVE_PNG/);
 assert.match(runner,/if\(!receipt\?\.realAuthoritativeFourBrowserSilver\|\|entries\.length!==4\)/);
 assert.match(runner,/qualifyPrealphaFourSilverClients\(clients\)/);
 assert.match(runner,/\/screenshot/);
 assert.match(runner,/captureGraphics3aFourNativeScreenshots\(entries,receipt\)/);
 assert.match(runner,/prealpha_real_four_silver_/);
 assert.match(runner,/89504e470d0a1a0a/);
 assert.match(runner,/createHash\("sha256"\)/);
 assert.match(runner,/notHumanOperated:true/);
});
test("PNG job is separate and preserves mandatory quality and authentic 4P jobs",()=>{
 assert.match(ci,/graphics3a-silver-four-native-png:/);
 assert.match(ci,/graphics3a-silver-four-authenticated:/);
 assert.match(ci,/quality:/);
 assert.match(ci,/MYASO_GRAPHICS3A_FOUR_NATIVE_PNG: "1"/);
 assert.match(ci,/actions\/upload-artifact@v4/);
 assert.match(ci,/retention-days: 1/);
 assert.match(ci,/if-no-files-found: error/);
 assert.match(ci,/Prebuild exact authoritative/i);
});
