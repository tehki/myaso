import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {pinnedSourceLineEndingDigests} from "../tools/art/pinned-source-line-endings-p0.mjs";

const sha=(x)=>createHash("sha256").update(x).digest("hex");
const source="export const swords=4;\nexport const city='Greyhaven';\n";
const lf=Buffer.from(source);
const crlf=Buffer.from(source.replaceAll("\n","\r\n"));
test("LF Linux and CRLF Windows original bytes map to identical pinned Windows digest",()=>{
 const linux=pinnedSourceLineEndingDigests(lf,"X230i");
 const windows=pinnedSourceLineEndingDigests(crlf,"Windows");
 assert.equal(linux.lineEndings,"LF");
 assert.equal(windows.lineEndings,"CRLF");
 assert.notEqual(linux.nativeSha256,windows.nativeSha256);
 assert.equal(linux.nativeSha256,sha(lf));
 assert.equal(windows.nativeSha256,sha(crlf));
 assert.equal(linux.canonicalCrLfSha256,sha(crlf));
 assert.equal(windows.canonicalCrLfSha256,sha(crlf));
});
test("a semantic source mutation changes the canonical pinned SHA",()=>{
 const original=pinnedSourceLineEndingDigests(lf);
 const changed=pinnedSourceLineEndingDigests(Buffer.from(source.replace("swords=4","swords=5")));
 assert.notEqual(changed.canonicalCrLfSha256,original.canonicalCrLfSha256);
});
test("mixed line endings and bare CR fail closed",()=>{
 assert.throws(()=>pinnedSourceLineEndingDigests(Buffer.from("a\r\nb\n")),
  /Unexpected or mixed/);
 assert.throws(()=>pinnedSourceLineEndingDigests(Buffer.from("a\rb\n")),
  /Unexpected or mixed/);
});
test("non-UTF8 source bytes fail rather than bypass the pin",()=>{
 assert.throws(()=>pinnedSourceLineEndingDigests(Buffer.from([0xff,0xfe,10])),
  /Unexpected or mixed/);
});
