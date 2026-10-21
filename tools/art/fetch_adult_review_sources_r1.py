"""Fetch pinned PR326 Knight & PR350 Greyhaven reference images as review-only inputs.
Must NOT be interpreted as live game assets / approved Greyhaven integration.
Requires authenticated gh CLI; SHA256 independently recorded.
"""
import pathlib,subprocess,base64,json,hashlib
root=pathlib.Path(__file__).resolve().parents[2]
destination=root/"web"/"assets"/"review-r1";destination.mkdir(parents=True,exist_ok=True)
files=[
 ("c712679c50644e2af5a7b5ac41323c5ffc792a14","web/assets/knights/silver_idle.webp","knight_silver_idle.webp"),
 ("c712679c50644e2af5a7b5ac41323c5ffc792a14","web/assets/knights/silver_walk.webp","knight_silver_walk.webp"),
 ("c712679c50644e2af5a7b5ac41323c5ffc792a14","web/assets/knights/silver_sprint.webp","knight_silver_sprint.webp"),
 ("c712679c50644e2af5a7b5ac41323c5ffc792a14","web/assets/knights/silver_roll.webp","knight_silver_roll.webp"),
 ("c07c6e8bf1dca3941bed805e87d1fc9ff44a1dd7","assets/environment/greyhaven/a224-review/red_lion_a224_base.webp","greyhaven_red_lion_base.webp"),
 ("c07c6e8bf1dca3941bed805e87d1fc9ff44a1dd7","assets/environment/greyhaven/a224-review/red_lion_a224_roof.webp","greyhaven_red_lion_roof.webp"),
]
items=[]
for ref,path,name in files:
 endpoint=f"repos/tehki/myaso/contents/{path}?ref={ref}"
 result=subprocess.run(["gh","api",endpoint],check=True,capture_output=True,text=True,timeout=120)
 metadata=json.loads(result.stdout)
 assert metadata.get("encoding")=="base64" and metadata.get("content"),(ref,path,metadata.keys())
 data=base64.b64decode(metadata["content"])
 assert len(data)==metadata.get("size")
 assert data[:4]==b"RIFF" and data[8:12]==b"WEBP"
 sha=hashlib.sha256(data).hexdigest()
 (destination/name).write_bytes(data)
 items.append(dict(local=name,ref=ref,path=path,sha256=sha,bytes=len(data),
  purpose="cross-PR standalone browser review only; NOT production asset"))
 print("REVIEW_SOURCE_VERIFIED",name,len(data),sha,flush=True)
(destination/"source-provenance.json").write_text(json.dumps({
 "artMilestone":"Graphics 3A adult motion review R1",
 "assetRole":"pinned evidence fixtures, nonactivated, no runtime registration",
 "liveGreyhavenIntegrated":False,"gameplayFootContactVerified":False,
 "sourceFiles":items},indent=2),encoding="utf8")
print("REVIEW_FIXTURES_COMPLETE",len(items),flush=True)
