#!/usr/bin/env python3
"""Bounded two-host public WebTransport browser smoke using genuine W3C input.

Run simultaneously on two independent machines with --require-peer.
No fabricated packets, local-server stand-ins, coordinate logs, or deployment.
"""
import argparse
import json
import re
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ORIGIN = "https://game.open-trust-layer.org"
GAME_ENDPOINT = ORIGIN + ":4433/game"
ONLINE_RE = re.compile(r"Online - player #([0-9]+) - server tick ([0-9]+)")
WEB_DRIVER_STATUS = "/status"
DOM_READ = """
return {
  webtransport: typeof WebTransport === 'function',
  status: document.querySelector('#event-text')?.textContent ?? '',
  scoreboard: Array.from(document.querySelectorAll('#scoreboard-list li span'), el => el.textContent),
  netstats: document.querySelector('#network-diagnostics')?.textContent ?? ''
};
"""


def validate_public_config(raw):
    if not isinstance(raw, dict):
        raise ValueError("configuration is not an object")
    if raw.get("serverUrl") != GAME_ENDPOINT:
        raise ValueError("unexpected public WebTransport origin")
    if not re.fullmatch(r"[0-9a-fA-F]{64}", str(raw.get("certificateSha256", ""))):
        raise ValueError("missing/invalid pinned certificate hash")
    if type(raw.get("maxPlayers")) is not int or not 2 <= raw["maxPlayers"] <= 8:
        raise ValueError("public admission cap outside 2..8")
    return raw


def summarize_observations(samples, require_peer=False):
    own = None
    peer_ids = set()
    last_stats = ""
    latest_tick = None
    movement = any(s.get("w3c_movement") for s in samples)
    for sample in samples:
        match = ONLINE_RE.search(sample.get("status", ""))
        if match:
            own = own or int(match.group(1))
            if int(match.group(1)) != own:
                raise ValueError("session changed fighter identity")
            latest_tick = int(match.group(2))
        if sample.get("netstats"):
            last_stats = sample["netstats"]
        # The actual scoreboard is from browser DOM, not local position guesses.
        peer_ids.update(int(m.group(1)) for label in sample.get("scoreboard", [])
                        if (m := re.fullmatch(r"#([0-9]+)", label)))
    peer_ids.discard(own)
    values = {}
    for name, pattern in [
        ("ack_p50_ms", r"ACK p50 ([0-9]+)ms"),
        ("ack_p95_ms", r"p95 ([0-9]+)ms"),
        ("extra_render_p50_ms", r"Extra render lag p50 ([0-9]+)ms"),
        ("extra_render_p95_ms", r"Extra render lag p50 [0-9]+ms . p95 ([0-9]+)ms"),
        ("render_over_33_percent", r">33ms ([0-9.]+)%"),
    ]:
        m = re.search(pattern, last_stats)
        values[name] = float(m.group(1)) if m else None
    pass_checks = {
        "authoritative_player_online": own is not None and latest_tick is not None and latest_tick > 0,
        "native_webtransport_supported": any(s.get("webtransport") is True for s in samples),
        "genuine_w3c_movement_issued": movement,
        "real_input_ack_observed": values["ack_p50_ms"] is not None,
        "real_render_telemetry_observed": values["extra_render_p50_ms"] is not None,
    }
    if require_peer:
        pass_checks["remote_fighter_seen_in_scoreboard"] = bool(peer_ids)
    return {
        "pass": all(pass_checks.values()),
        "checks": pass_checks,
        "fighter_id": own,
        "peer_ids": sorted(peer_ids),
        "last_authoritative_tick": latest_tick,
        "samples": len(samples),
        "measurements": values,
    }


def _request(url, method="GET", data=None, timeout=12):
    payload = None if data is None else json.dumps(data).encode("utf-8")
    req = Request(url, payload, {"Content-Type": "application/json"}, method=method)
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    return json.loads(raw) if raw else {}


def _unused_loopback_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _webdriver(base, suffix, method="GET", data=None, timeout=12):
    reply = _request(base + suffix, method, data, timeout)
    if isinstance(reply.get("value"), dict) and reply["value"].get("error"):
        raise RuntimeError("WebDriver: " + reply["value"]["error"])
    return reply.get("value")


def _genuine_movement(base, session):
    root = "/session/" + session
    entry = _webdriver(base, root + "/element", "POST", {
        "using": "css selector", "value": "#arena",
    })
    element_id = entry["element-6066-11e4-a52e-4f735466cecf"]
    _webdriver(base, root + "/element/" + element_id + "/click", "POST", {})
    # Real W3C WebDriver keyboard request; never dispatch synthetic DOM events.
    try:
        _webdriver(base, root + "/actions", "POST", {"actions": [{
            "type": "key", "id": "public-smoke-keys", "actions": [
                {"type": "keyDown", "value": "w"},
                {"type": "pause", "duration": 240},
                {"type": "keyUp", "value": "w"},
            ],
        }]})
    finally:
        _webdriver(base, root + "/actions", "DELETE")


def run_probe(duration_seconds, require_peer):
    raw = _request(ORIGIN + "/game-config.json", timeout=8)
    cfg = validate_public_config(raw)
    port = _unused_loopback_port()
    base = "http://127.0.0.1:" + str(port)
    session = None
    driver = None
    observations = []
    with tempfile.TemporaryDirectory(prefix="myaso-r2-public-browser-") as profile:
        try:
            driver = subprocess.Popen(
                ["chromedriver", "--port=" + str(port), "--allowed-ips=127.0.0.1"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            for _ in range(50):
                try:
                    _webdriver(base, WEB_DRIVER_STATUS, timeout=1)
                    break
                except (OSError, URLError, ValueError):
                    time.sleep(0.1)
            else:
                raise RuntimeError("local ChromeDriver unavailable")
            created = _request(base + "/session", "POST", {
                "capabilities": {"alwaysMatch": {
                    "browserName": "chrome",
                    "goog:chromeOptions": {"args": [
                        "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
                        "--window-size=1280,800", "--disable-background-timer-throttling",
                        "--disable-backgrounding-occluded-windows",
                        "--disable-renderer-backgrounding", "--user-data-dir=" + profile,
                    ]},
                }},
            }, timeout=18)
            data = created.get("value", created)
            session = data["sessionId"]
            root = "/session/" + session
            path = "/web/?" + urlencode({
                "server": cfg["serverUrl"], "cert": cfg["certificateSha256"],
                "netstats": "1",
            })
            _webdriver(base, root + "/url", "POST", {"url": ORIGIN + path}, timeout=20)
            deadline = time.monotonic() + duration_seconds
            did_move = False
            while time.monotonic() < deadline:
                current = _webdriver(base, root + "/execute/sync", "POST", {
                    "script": DOM_READ, "args": [],
                }, timeout=10)
                if not isinstance(current, dict):
                    raise RuntimeError("browser returned no actual DOM state")
                current["w3c_movement"] = did_move
                observations.append(current)
                if not did_move and ONLINE_RE.search(current.get("status", "")):
                    _genuine_movement(base, session)
                    did_move = True
                    current["w3c_movement"] = True
                time.sleep(1)
            return summarize_observations(observations, require_peer)
        finally:
            if session:
                try:
                    _webdriver(base, "/session/" + session, "DELETE", timeout=3)
                except Exception:
                    pass
            if driver:
                driver.terminate()
                try:
                    driver.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    driver.kill()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--duration", type=int, default=25)
    parser.add_argument("--require-peer", action="store_true",
                        help="fail unless a separate actual fighter appears in the server scoreboard")
    args = parser.parse_args()
    if not 12 <= args.duration <= 60:
        parser.error("--duration must be in the bounded interval 12..60s")
    try:
        outcome = run_probe(args.duration, args.require_peer)
        print("R2_PUBLIC_WAN_SMOKE " + json.dumps(outcome, sort_keys=True), flush=True)
        return 0 if outcome["pass"] else 1
    except Exception as exc:
        print("R2_PUBLIC_WAN_SMOKE " + json.dumps({
            "pass": False, "error_type": type(exc).__name__,
            "error": str(exc)[:160],
        }), flush=True)
        return 2


if __name__ == "__main__":
    sys.exit(main())
