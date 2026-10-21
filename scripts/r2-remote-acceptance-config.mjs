// R2 independent-host *staging only* acceptance configuration.
// This module cannot start a server, open a firewall, or accept a live realm.
const hex=/^[0-9a-f]{64}$/i;
export function parseR2RemoteConfig(env) {
  if(env.MYASO_R2_REMOTE_TEST_ONLY!=="1" || env.MYASO_R2_STAGING_OWNER_ATTESTED!=="YES") {
    throw new Error("independent-host R2 tests require explicit staging-only attestation");
  }
  if(env.MYASO_R2_REMOTE_PLAYER_CAP!=="2") {
    throw new Error("independent-host R2 acceptance requires isolated player cap exactly 2");
  }
  const expectedHost=env.MYASO_R2_REMOTE_ALLOW_HOST;
  if(typeof expectedHost!=="string" || !expectedHost || /[/:@?#\s]/.test(expectedHost)) {
    throw new Error("expected staging hostname or IP must be explicitly allowlisted");
  }
  let url;
  try { url=new URL(env.MYASO_R2_REMOTE_URL); }
  catch { throw new Error("staging game URL is invalid"); }
  if(url.protocol!=="https:" || url.hostname!==expectedHost || url.pathname!=="/game"
    || !url.port || !/^\d+$/.test(url.port) || Number(url.port)<1 || Number(url.port)>65535
    || url.username || url.password || url.search || url.hash) {
    throw new Error("staging game URL must match the allowed HTTPS host, explicit port and /game path");
  }
  if(expectedHost==="localhost" || expectedHost==="127.0.0.1" || expectedHost==="::1"
    || expectedHost==="game.open-trust-layer.org" || expectedHost.endsWith(".open-trust-layer.org")) {
    throw new Error("loopback and production game hosts are forbidden in two-host acceptance");
  }
  const cert=env.MYASO_R2_REMOTE_CERT_SHA256;
  if(typeof cert!=="string" || !hex.test(cert)) {
    throw new Error("staging certificate must be explicitly SHA-256 pinned");
  }
  return Object.freeze({
    gameUrl:url.href, certificateSha256:cert.toLowerCase(), expectedHost,
    playerCap:2, stagingOnly:true,
  });
}
