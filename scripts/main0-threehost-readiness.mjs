// Main0 Alpha 0.2 nonrelease acceptance PRE-FLIGHT only.
// Read local Chrome/Chromium and matching ChromeDriver versions. This tool
// never opens a socket, launches a browser/server, changes a machine,
// sends an input, tests a live endpoint, or declares runtime acceptance.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { platform } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parsedVersion(label, pattern, text) {
  if (typeof text !== "string") return null;
  const m = text.trim().match(pattern);
  return m ? { name: label, version: m[1], major: Number(m[1].split(".")[0]) } : null;
}

export function parseBrowserVersion(raw) {
  return parsedVersion("google-chrome-stable", /^Google Chrome\s+(\d+\.\d+\.\d+\.\d+)/, raw)
    ?? parsedVersion("chromium", /^Chromium\s+(\d+\.\d+\.\d+\.\d+)/, raw);
}
export function parseChromeDriverVersion(raw) {
  return parsedVersion("chromedriver", /^ChromeDriver\s+(\d+\.\d+\.\d+\.\d+)/, raw);
}

function versionFromCommand(binary) {
  if (!binary) return null;
  try {
    return execFileSync(binary, ["--version"], {
      encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { return null; }
}

function candidateChromePaths(os, env) {
  if (env.CHROME_BIN) return [env.CHROME_BIN];
  if (os === "win32") {
    return [
      env.ProgramFiles && resolve(env.ProgramFiles, "Google/Chrome/Application/chrome.exe"),
      env["ProgramFiles(x86)"] && resolve(env["ProgramFiles(x86)"], "Google/Chrome/Application/chrome.exe"),
      env.LOCALAPPDATA && resolve(env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    ].filter(Boolean);
  }
  return ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/usr/bin/chromium"];
}

function windowsChromeVersion(executable) {
  // Windows chrome.exe --version may start a browser rather than print a
  // version. Read the PE ProductVersion only; never launch the application.
  const quoted = executable.replaceAll("'", "''");
  try {
    const value = execFileSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      "(Get-Item -LiteralPath '" + quoted + "').VersionInfo.ProductVersion",
    ], { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] }).trim();
    return /^\d+\.\d+\.\d+\.\d+$/.test(value) ? "Google Chrome " + value : null;
  } catch { return null; }
}

export function inspectLocalHost(alias, { os = platform(), env = process.env } = {}) {
  if (!/^[a-z0-9-]{1,32}$/.test(alias))
    throw new Error("host alias must be a non-sensitive lowercase machine label");
  const binaries = candidateChromePaths(os, env);
  let browser = null;
  for (const binary of binaries) {
    if (binary.startsWith("/") || /^[A-Za-z]:[\\/]/.test(binary)) {
      if (!existsSync(binary)) continue;
    }
    const found = parseBrowserVersion(os === "win32"
      ? windowsChromeVersion(binary) : versionFromCommand(binary));
    if (found) { browser = found; break; }
  }
  // A PATH driver may be present but mismatched; never silently install one.
  const driver = parseChromeDriverVersion(
    versionFromCommand(env.MYASO_CHROMEDRIVER_BIN || "chromedriver"),
  );
  return {
    alias, browser, driver, os,
    browserVerified: !!browser, driverVerified: !!driver,
    driverMatchesBrowser: !!(browser && driver && browser.major === driver.major),
    acceptance: "NOT_RUN",
  };
}

export function assessThreeHostPlan(hosts) {
  if (!Array.isArray(hosts) || hosts.length !== 3)
    throw new Error("owner-approved topology requires exactly three distinct physical host records");
  const aliases = new Set();
  const failures = [];
  let chromeSeats = 0, chromeHosts = 0, networkHosts = 0, chromiumHosts = 0;
  for (const host of hosts) {
    if (!host || typeof host.alias !== "string" || !/^[a-z0-9-]{1,32}$/.test(host.alias)
      || aliases.has(host.alias))
      throw new Error("missing, repeated or invalid physical host alias");
    aliases.add(host.alias);
    if (!Number.isInteger(host.chromeSeats) || host.chromeSeats < 0 || host.chromeSeats > 2)
      throw new Error("Chrome seats must be an explicit integer 0..2 per machine");
    const browser = host.browser;
    const driver = host.driver;
    const isChrome = browser?.name === "google-chrome-stable";
    if (isChrome) chromeHosts++;
    if (browser && host.browserVerified !== true)
      failures.push(host.alias + ": browser version is not independently verified");
    if (browser?.name === "chromium") chromiumHosts++;
    if (host.chromeSeats > 0) {
      chromeSeats += host.chromeSeats;
      if (!isChrome) failures.push(host.alias + ": Chrome seats require Google Chrome Stable, not Chromium");
      if (host.chromeSeats !== 2) failures.push(host.alias + ": plan requires two Chrome seats on each Chrome host");
      if (!driver || !Number.isInteger(driver.major) || browser?.major !== driver.major
        || host.driverVerified !== true)
        failures.push(host.alias + ": executable matching-major ChromeDriver not verified");
    }
    if (host.networkSeat === true) {
      networkHosts++;
      if (!browser || !driver || browser.major !== driver.major || host.driverVerified !== true)
        failures.push(host.alias + ": native network witness needs an executable matching browser driver");
    }
    if (host.networkSeat !== true && host.networkSeat !== false)
      throw new Error("each host must explicitly declare its network witness seat");
  }
  if (chromeSeats !== 4) failures.push("four genuine Chrome Stable sessions have not been provisioned");
  if (chromeHosts < 2) failures.push("at least two separate Google Chrome Stable machines required");
  if (networkHosts !== 3) failures.push("three physical network witnesses required (including Serj)");
  const topologyReady = failures.length === 0;
  return {
    physicalHostsRecorded: hosts.length,
    chromeStableHostsRecorded: chromeHosts,
    chromiumWitnessHostsRecorded: chromiumHosts,
    plannedChromeSessions: chromeSeats,
    plannedNetworkHostSessions: networkHosts,
    topologyReady,
    // Explicitly separate executable prerequisites from actual evidence.
    originalRustWorldAcceptance: "NOT_RUN",
    fourChromeSessionAcceptance: "NOT_RUN",
    threePhysicalHostNetworkAcceptance: "NOT_RUN",
    authenticatedQuicTlsStage: "NOT_AUTHORIZED_OR_VERIFIED",
    releaseDecision: "HOLD",
    blockers: failures,
  };
}

function main(argv) {
  const [mode, target] = argv;
  if (mode === "--self") {
    const local = inspectLocalHost(target);
    console.log(JSON.stringify(local, null, 2));
  } else if (mode === "--matrix" && target) {
    const json = JSON.parse(readFileSync(resolve(target), "utf8"));
    console.log(JSON.stringify(assessThreeHostPlan(json.hosts), null, 2));
  } else {
    throw new Error("Usage: node scripts/main0-threehost-readiness.mjs --self <alias> | --matrix <json-file>");
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2));
