"""Offline fail-closed checks for genuine public WAN acceptance."""
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("r2_public_wan_smoke", ROOT / "scripts" / "public_wan_smoke.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class PublicWanSmokeTests(unittest.TestCase):
    def test_strict_endpoint_cert_and_capacity(self):
        valid = {
            "serverUrl": "https://game.open-trust-layer.org:4433/game",
            "certificateSha256": "a" * 64,
            "maxPlayers": 8,
        }
        self.assertEqual(mod.validate_public_config(valid), valid)
        for update in [
            {"serverUrl": "https://evil.invalid:4433/game"},
            {"certificateSha256": "missing"},
            {"maxPlayers": 512},
            {"maxPlayers": True},
        ]:
            with self.subTest(update=update), self.assertRaises(ValueError):
                mod.validate_public_config({**valid, **update})

    def test_requires_real_online_state_and_ack(self):
        raw = [{"status": "Enter the arena.", "scoreboard": ["#11"],
                "webtransport": True, "w3c_movement": True}]
        out = mod.summarize_observations(raw, require_peer=True)
        self.assertFalse(out["pass"])
        self.assertFalse(out["checks"]["authoritative_player_online"])
        self.assertFalse(out["checks"]["real_input_ack_observed"])

    def test_authenticated_two_player_dom_observation(self):
        raw = [{"status": "Online - player #44 - server tick 1230",
                "scoreboard": ["#44", "#45"], "webtransport": True,
                "w3c_movement": True,
                "netstats": "Input->ACK p50 220ms · p95 400ms"
                            " | Jitter p95 55ms | Snapshots p50 49ms · p95 143ms"
                            " | Camera correction p95 0.7u | Stale-own ACKs 23"
                            " | Deferred reconciles 82 | Render catch-ups 109"
                            " | Extra render lag p50 2ms · p95 88ms"
                            " | >33ms 14.6% (96 samples)"}]
        out = mod.summarize_observations(raw, require_peer=True)
        self.assertTrue(out["pass"])
        self.assertEqual(out["fighter_id"], 44)
        self.assertEqual(out["peer_ids"], [45])
        self.assertEqual(out["measurements"]["ack_p50_ms"], 220)
        self.assertEqual(out["measurements"]["ack_p95_ms"], 400)
        self.assertEqual(out["measurements"]["ack_jitter_p95_ms"], 55)
        self.assertEqual(out["measurements"]["snapshot_p95_ms"], 143)
        self.assertEqual(out["measurements"]["camera_correction_p95_units"], 0.7)
        self.assertEqual(out["measurements"]["deferred_reconciles"], 82)
        self.assertEqual(out["measurements"]["extra_render_p95_ms"], 88)
        self.assertEqual(out["measurements"]["render_samples"], 96)

    def test_high_local_cpu_pressure_confounds_wan_quality_not_player_connectivity(self):
        quiet = mod.classify_host_pressure(4, 1.8)
        busy = mod.classify_host_pressure(4, 17.64)
        self.assertFalse(quiet["load_confounded"])
        self.assertTrue(busy["load_confounded"])
        self.assertEqual(busy["load_1m_per_cpu"], 4.41)
        for args in [(0, 5), (4, -1), (4, float("inf"))]:
            with self.assertRaises(ValueError):
                mod.classify_host_pressure(*args)

    def test_no_peer_fails_closed_and_identity_changes_refused(self):
        snap = {"status": "Online - player #3 - server tick 90",
                "scoreboard": ["#3"], "webtransport": True, "w3c_movement": True,
                "netstats": "ACK p50 10ms | Extra render lag p50 0ms"}
        self.assertFalse(mod.summarize_observations([snap], True)["pass"])
        self.assertTrue(mod.summarize_observations([snap], False)["pass"])
        with self.assertRaisesRegex(ValueError, "changed fighter identity"):
            mod.summarize_observations([
                snap, {**snap, "status": "Online - player #4 - server tick 100"},
            ], False)


if __name__ == "__main__":
    unittest.main()
