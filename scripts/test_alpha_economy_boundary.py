"""Independent safety tests for P0 First Playable Economics scope guard."""
import tempfile
from pathlib import Path
import unittest

from verify_alpha_economy_boundary import active_source_files, violations


class AlphaEconomyPerimeterTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="myaso-alpha-econ-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)

    def write(self, path, text):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")

    def test_clean_multiplayer_entrypoints_pass(self):
        self.write("server/src/lib.rs", "pub mod simulation;\n")
        self.write("server/src/simulation.rs", "pub fn tick() {}\n")
        self.write("web/bootstrap.mjs", 'await import("./online-game.mjs");\n')
        self.write("web/online-game.mjs", 'import "../src/browser/dash.mjs";\n')
        self.write("src/browser/dash.mjs", "export const dash = true;\n")
        self.assertEqual(violations(self.root, ("server/src/lib.rs", "web/bootstrap.mjs")), [])
        self.assertEqual(len(active_source_files(self.root, ("server/src/lib.rs", "web/bootstrap.mjs"))), 5)

    def test_forbid_direct_live_wallet_in_browser(self):
        self.write("web/bootstrap.mjs", "const endpoint = '/wallet/transfer';\n")
        self.assertTrue(violations(self.root, ("web/bootstrap.mjs",)))

    def test_forbid_dynamic_import_of_economy(self):
        self.write("web/bootstrap.mjs", 'await import("./economics_core_gateway.mjs");\n')
        self.write("web/economics_core_gateway.mjs", "export const x = 1;\n")
        self.assertTrue(violations(self.root, ("web/bootstrap.mjs",)))

    def test_forbid_indirect_wallet_in_transitive_module(self):
        self.write("web/bootstrap.mjs", 'import "./good.mjs";\n')
        self.write("web/good.mjs", "export {x} from './economics_ui.mjs';\n")
        self.write("web/economics_ui.mjs", "export const x = true;\n")
        self.assertTrue(violations(self.root, ("web/bootstrap.mjs",)))

    def test_forbid_indirect_rust_economy_use(self):
        self.write("server/src/lib.rs", "mod simulation;\n")
        self.write("server/src/simulation.rs", "fn f() { ledger::credit(); }\n")
        self.assertTrue(violations(self.root, ("server/src/lib.rs",)))

    def test_fail_closed_when_runtime_entrypoint_missing(self):
        with self.assertRaisesRegex(ValueError, "missing"):
            active_source_files(self.root, ("web/online-game.mjs",))

    def test_fail_closed_on_unresolved_local_import(self):
        self.write("web/bootstrap.mjs", 'import "./missing.mjs";\n')
        with self.assertRaisesRegex(ValueError, "missing"):
            active_source_files(self.root, ("web/bootstrap.mjs",))

    def test_fail_closed_on_unresolved_rust_module(self):
        self.write("server/src/lib.rs", "pub mod missing;\n")
        with self.assertRaisesRegex(ValueError, "Unresolved"):
            active_source_files(self.root, ("server/src/lib.rs",))

    def test_ordinary_combat_terms_are_not_blocked(self):
        self.write("server/src/main.rs", "fn attack_and_respawn() {}\n")
        self.assertEqual(violations(self.root, ("server/src/main.rs",)), [])

    def test_research_module_not_reachable_is_outside_runtime_guard(self):
        self.write("server/src/lib.rs", "pub mod simulation;\n")
        self.write("server/src/simulation.rs", "fn play() {}\n")
        self.write("scripts/economics_sqlite_lab.py", "wallet = 'test'\n")
        self.assertEqual(violations(self.root, ("server/src/lib.rs",)), [])

    def test_syntax_error_not_misrepresented_as_runtime_acceptance(self):
        self.write("web/bootstrap.mjs", "/* source text only: no browser verified */\n")
        self.assertEqual(violations(self.root, ("web/bootstrap.mjs",)), [])


if __name__ == "__main__":
    unittest.main()
