import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const script = readFileSync(new URL("../scripts/prealpha-package.sh", import.meta.url), "utf8");

test("Pre-Alpha packager has valid bash syntax and requires existing destination", () => {
  const check = spawnSync("bash", ["-n", new URL("../scripts/prealpha-package.sh", import.meta.url).pathname], {encoding:"utf8"});
  assert.equal(check.status, 0, check.stderr);
  const noTarget = spawnSync("bash", [new URL("../scripts/prealpha-package.sh", import.meta.url).pathname], {encoding:"utf8"});
  assert.equal(noTarget.status, 2);
  assert.match(noTarget.stderr, /Usage:/);
});

test("Pre-Alpha package locks exact HEAD, refuses dirty source/overwrites and is not a floating ZIP", () => {
  assert.match(script, /git -C "\$repo" rev-parse --verify HEAD/);
  assert.match(script, /git -C "\$repo" status --porcelain --untracked-files=normal/);
  assert.match(script, /Refusing release packaging from dirty/);
  assert.match(script, /Refusing to overwrite immutable candidate/);
  assert.match(script, /git -C "\$repo" archive --format=tar "\$revision" web src ops\/alpha/);
  assert.match(script, /cargo build --locked --release/);
  assert.match(script, /out\/REVISION/);
  assert.match(script, /out\/RELEASE-STATUS/);
  assert.match(script, /CONTENT-SHA256/);
  assert.match(script, /gzip -n/);
  assert.match(script, /sha256sum "\$archive_name" > "\$archive_name.sha256"/);
});

test("Pre-Alpha package has the existing nonactivating Alpha installer layout", () => {
  assert.match(script, /"\$scratch\/out\/bin"/);
  assert.match(script, /"\$scratch\/out\/public"/);
  assert.match(script, /"\$scratch\/out\/ops"/);
  assert.match(script, /mv "\$scratch\/web" "\$scratch\/src" "\$scratch\/out\/public\/"/);
  assert.match(script, /mv "\$scratch\/ops\/alpha" "\$scratch\/out\/ops\/"/);
  assert.doesNotMatch(script, /(^|\n)[^#\n]*(?:install-vps\.sh|systemctl|ufw|caddy|curl|scp|ssh)\s/);
  assert.match(script, /NOT APPROVED FOR PUBLIC CUTOVER/);
});

test("Pre-Alpha remains arena-only; no Greyhaven or canonical sword requirement is introduced", () => {
  assert.match(script, /web src ops\/alpha/);
  assert.doesNotMatch(script, /(?:git archive|cp|install|mv).*?(?:world\.json|sentinel|inventory|wallet)/i);
});
