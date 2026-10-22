#!/usr/bin/env node
// P53: STAGE a temporary read-only-authority stdout trace server outside git.
// Never write or patch repo runtime sources. Browser/QUIC gameplay unaffected.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {cp,readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const sourcePin="e8cb752ee31407534b4c2a0a32305b020a98c70d";
execFileSync("git",["-C",root,"merge-base","--is-ancestor",sourcePin,"HEAD"]);
const controlled=["server","web/online-game.mjs","web/authoritative-client.mjs",
 "web/network-transport.mjs","src/browser/smooth-motion.mjs",
 "src/browser/render-gap-telemetry.mjs","src/browser/authored-world-renderer.mjs"];
assert.equal(execFileSync("git",["-C",root,"diff","--name-only",sourcePin,"HEAD","--",...controlled],
 {encoding:"utf8"}).trim(),"","Refuse drift in original authoritative/game source");
const out=resolve(process.argv[2]||"");
assert.ok(out!==root && out.startsWith("/home/serj/.cache/"),"Only stage under private QA cache");
const sourceFile=join(root,"server/src/main.rs");
const source=await readFile(sourceFile,"utf8");
const sha=s=>createHash("sha256").update(s).digest("hex");
await mkdir(out,{recursive:true});
await cp(join(root,"server"),join(out,"server"),{recursive:true,force:true});
function insertAfterOnce(s,needle,addition){
 assert.equal(s.split(needle).length,2,"Pinned Rust anchor drift: "+needle);
 return s.replace(needle,needle+addition);
}
let instrumented=insertAfterOnce(source,
 `        if state.world.tick % SNAPSHOT_EVERY_SERVER_TICKS == 0 {
            state.refresh_replication_frame();`,
 `
            println!("P51_SIM tick={} epoch_us={}", state.world.tick,
              std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
               .expect("system clock monotonic for QA trace").as_micros());`);
instrumented=insertAfterOnce(instrumented,
 `                let server_tick = frame.server_tick();`,
 `
                println!("P53_READ player={} tick={} epoch_us={}",
                  player_id, server_tick,
                  std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
                   .expect("system clock for read-only QA").as_micros());`);
instrumented=insertAfterOnce(instrumented,
 `                    connection
                        .send_datagram(snapshot.bytes)
                        .context("send authoritative snapshot datagram")?;`,
 `
                    println!("P51_TX player={} tick={} epoch_us={}",
                      player_id, server_tick,
                      std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
                       .expect("system clock for QA trace").as_micros());`);
assert.ok(instrumented.includes("P51_SIM tick=")&&instrumented.includes("P51_TX player=")&&instrumented.includes("P53_READ player="));
assert.equal(await readFile(sourceFile,"utf8"),source,"Original checked-in Rust source must remain byte-identical");
await writeFile(join(out,"server/src/main.rs"),instrumented);
await writeFile(join(out,"trace-provenance.json"),JSON.stringify({
  originalGitHead:sourcePin,sourcePath:"server/src/main.rs",shaOriginal:sha(source),
  shaQAInstrumented:sha(instrumented),qaOnlyStdoutMarkers:["P51_SIM","P51_TX","P53_READ"],
  noProductionSourceModifications:true,stagingOutsideRepository:true
},null,2)+"\n");
console.log(JSON.stringify({stagedRust:join(out,"server/src/main.rs"),
  originalSHA256:sha(source),QAInstrumentedSHA256:sha(instrumented),
  cargoManifest:join(out,"server/Cargo.toml")}));
