"""Tests for repo_guard.py. Run: python3 -m unittest discover -s .github/agents"""

import unittest

import repo_guard as r

# Built at runtime so this file does not itself contain what the guard refuses.
USERS = "/Us" + "ers/"
HOME = "/ho" + "me/"
TS = ".ts" + ".net"


class Paths(unittest.TestCase):
    def test_build_output_and_caches_are_refused(self):
        for p in (
            "mobile/modules/site-data/android/build/outputs/aar/site-data-release.aar",
            "mobile/android/app/build/outputs/apk/release/app-release.apk",
            "blackwall-admin/node_modules/x/index.js",
            "mobile/.gradle/8.0/file.bin",
            "mobile/.expo/settings.json",
            ".agent/prompt.md",
        ):
            self.assertIsNotNone(r.bad_path(p), p)

    def test_keys_and_machine_files_are_refused(self):
        for p in ("a/release.keystore", "b/upload.jks", "mobile/android/local.properties", "x/.env", "x/.env.local", "k/cert.pem"):
            self.assertIsNotNone(r.bad_path(p), p)

    def test_normal_files_pass(self):
        for p in (
            "mobile/modules/site-data/android/build.gradle",  # a file named build.gradle is fine
            "blackwall-admin/src/features/productivity/planner.css",
            "docs/design/reference/ui-polish/after/planner-1440.png",
            "x/.env.example",
            "blackwall-admin/Dockerfile",
        ):
            self.assertIsNone(r.bad_path(p), p)


class Text(unittest.TestCase):
    def test_home_directory_paths_are_found(self):
        self.assertTrue(r.bad_text(f'dir="{USERS}someone/Desktop/repo/mobile"'))
        self.assertTrue(r.bad_text(f"cd {HOME}someone/project"))

    def test_runner_and_container_homes_are_allowed(self):
        self.assertEqual(r.bad_text("WORKDIR /home/node/app and /home/runner/work"), [])

    def test_tailscale_host_names_other_than_the_placeholder_are_found(self):
        self.assertTrue(r.bad_text(f"https://mikoshi.tail1a2b3{TS}/"))
        self.assertTrue(r.bad_text(f"https://fancy-animal{TS}"))

    def test_the_placeholder_and_test_fixtures_are_allowed(self):
        self.assertEqual(r.bad_text("https://blackwall.example.ts.net:8443/x https://example.ts.net"), [])
        self.assertEqual(r.bad_text('"https://-bad.ts.net", "https://bad-.ts.net", "https://bad.ts.net", "https://host.ts.net"'), [])
        self.assertEqual(r.bad_text("homelab.your-tailnet.ts.net and homelab.tail1234.ts.net"), [])

    def test_ordinary_text_passes(self):
        self.assertEqual(r.bad_text("Open /api/logout and src/home/ pages; see features/home/overview.tsx"), [])

    def test_check_reports_each_file_in_plain_words(self):
        import os
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            os.makedirs(f"{d}/a")
            with open(f"{d}/a/note.md", "w") as f:
                f.write(f"see {USERS}x/y")
            with open(f"{d}/a/ok.md", "w") as f:
                f.write("fine")
            out = r.check(["a/note.md", "a/ok.md", "a/build/out.bin"], root=d)
        self.assertEqual(len(out), 2)
        self.assertIn("a/note.md contains a local home-directory path", out[0])
        self.assertIn("a/build/out.bin is build output", out[1])


if __name__ == "__main__":
    unittest.main()
