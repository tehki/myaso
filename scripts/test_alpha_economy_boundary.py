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


    def test_actual_alpha_lobby_module_is_discovered_from_html(self):
        self.write("web/alpha.html", '<script type="module" src="/web/alpha.mjs"></script>')
        self.write("web/alpha.mjs", 'import "./alpha-practice.mjs";')
        self.write("web/alpha-practice.mjs", "export const x = 1;")
        files = active_source_files(self.root, ("web/alpha.html",))
        self.assertEqual(
            {p.relative_to(self.root).as_posix() for p in files},
            {"web/alpha.html", "web/alpha.mjs", "web/alpha-practice.mjs"},
        )

    def test_economy_module_reachable_only_from_alpha_lobby_is_rejected(self):
        self.write("web/alpha.html", '<script type="module" src="/web/alpha.mjs"></script>')
        self.write("web/alpha.mjs", "import './wallet-fixture.mjs';")
        self.write("web/wallet-fixture.mjs", "export const unused = false;")
        self.assertTrue(violations(self.root, ("web/alpha.html",)))

    def test_added_secondary_html_module_is_checked(self):
        self.write("web/index.html",
                   '<script type="module" src="./bootstrap.mjs"></script>'
                   '<script type="module" src="./economics_ui.mjs"></script>')
        self.write("web/bootstrap.mjs", "export const ready = true;")
        self.write("web/economics_ui.mjs", "export const bad = true;")
        self.assertTrue(violations(self.root, ("web/index.html",)))

    def test_unreviewed_inline_html_runtime_script_fails_closed(self):
        self.write("web/alpha.html", '<script type="module">import "/web/wallet.mjs";</script>')
        with self.assertRaisesRegex(ValueError, "inline"):
            active_source_files(self.root, ("web/alpha.html",))

    def test_external_html_script_fails_closed(self):
        self.write("web/alpha.html",
                   '<script type="module" src="https://example.test/remote.mjs"></script>')
        with self.assertRaisesRegex(ValueError, "external"):
            active_source_files(self.root, ("web/alpha.html",))

    def test_missing_html_script_is_not_silently_accepted(self):
        self.write("web/alpha.html", "<div>Lobby without module</div>")
        with self.assertRaisesRegex(ValueError, "No runtime scripts"):
            active_source_files(self.root, ("web/alpha.html",))

    def test_root_relative_js_import_is_followed(self):
        self.write("web/bootstrap.mjs", 'await import("/web/secret-wallet.mjs");')
        self.write("web/secret-wallet.mjs", "export const x = 1;")
        self.assertTrue(violations(self.root, ("web/bootstrap.mjs",)))

    def test_html_js_query_suffix_resolves_actual_file(self):
        self.write("web/alpha.html",
                   '<script type="module" src="/web/alpha.mjs?v=3"></script>')
        self.write("web/alpha.mjs", "export const x = 1;")
        files = active_source_files(self.root, ("web/alpha.html",))
        self.assertEqual(len(files), 2)

    def test_rust_path_attribute_dependency_is_followed(self):
        self.write("server/src/lib.rs", '#[path = "alternate.rs"]\nmod wired;\n')
        self.write("server/src/alternate.rs", "fn f() { wallet::send(); }\n")
        self.assertTrue(violations(self.root, ("server/src/lib.rs",)))

    def test_rust_path_escape_repo_fails_closed(self):
        self.write("server/src/lib.rs",
                   '#[path = "../../../outside.rs"]\nmod unusual;\n')
        with self.assertRaisesRegex(ValueError, "escapes repository"):
            active_source_files(self.root, ("server/src/lib.rs",))

    def test_html_plain_text_mention_of_wallet_is_not_runtime_import(self):
        self.write("web/index.html",
                   '<p>No wallet is offered in first playable</p>'
                   '<script type="module" src="./bootstrap.mjs"></script>')
        self.write("web/bootstrap.mjs", "export const ready = true;")
        self.assertEqual(violations(self.root, ("web/index.html",)), [])


if __name__ == "__main__":
    unittest.main()
