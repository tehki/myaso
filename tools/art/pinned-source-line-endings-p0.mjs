// P0 source-verification helper: exact LF or CRLF on-disk bytes only.
// Compare against the historical SHA256 pins of the original Windows CRLF
// files. Never normalize game runtime files or relax source-content checking.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";

const sha256=(bytes)=>createHash("sha256").update(bytes).digest("hex");

export function pinnedSourceLineEndingDigests(bytes,label="pinned source"){
 assert.ok(Buffer.isBuffer(bytes),"source must be raw Buffer");
 const canonicalLf=Buffer.from(bytes.toString("utf8").replaceAll("\r\n","\n"),"utf8");
 assert.ok(!canonicalLf.includes(13),"Unexpected or mixed source line endings: "+label);
 const canonicalCrLf=Buffer.from(canonicalLf.toString("utf8").replaceAll("\n","\r\n"),"utf8");
 assert.ok(bytes.equals(canonicalLf)||bytes.equals(canonicalCrLf),
  "Unexpected or mixed source line endings: "+label);
 return Object.freeze({
  nativeSha256:sha256(bytes),
  canonicalCrLfSha256:sha256(canonicalCrLf),
  lineEndings:bytes.equals(canonicalLf)?"LF":"CRLF"
 });
}
