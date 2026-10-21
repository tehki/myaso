import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
for(const path of ["src/world/alpha-armory.mjs","src/world/authored-maps.mjs","src/browser/armory-rack-visual.mjs","src/browser/armory-world493-visual-bridge.mjs","assets/environment/greyhaven/armory-p0/armory_rack.webp","assets/environment/greyhaven/armory-p0/armory_sword.webp"]){
 const original=readFileSync(path);
 const isText=path.endsWith(".mjs");
 const canonical=isText?Buffer.from(original.toString("utf8").replaceAll("\r\n","\n")):original;
 console.log(path,JSON.stringify({original:createHash("sha256").update(original).digest("hex"),gitCanonicalLF:createHash("sha256").update(canonical).digest("hex"),bytes:original.length,canonicalBytes:canonical.length}));
}