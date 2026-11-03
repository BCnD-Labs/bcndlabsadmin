#!/usr/bin/env python3
"""Keep local-only things out of the repo (Agents workflow and CI).

Usage: repo_guard.py          check what an agent changed (modified + new files)
       repo_guard.py --tree   check every tracked file (CI)

Fails (exit 1, one plain line per problem) when a change contains:
  - build output or caches: build/, .gradle/, node_modules/, .expo/, dist/ folders,
    *.apk, *.aab, *.aar, *.jks, *.keystore, *.p12, local.properties, .env files
  - a local home-directory path (/Users/<name>/ or /home/<name>/)
  - a Tailscale host name (*.ts.net) other than the documented placeholders
    (*.example.ts.net, *.your-tailnet.ts.net, *.tail1234.ts.net)
Standard library only.
"""

import pathlib
import re
import subprocess
import sys

BAD_DIRS = {"build", ".gradle", "node_modules", ".expo", "dist", "web-build", "__pycache__", ".agent"}
BAD_SUFFIXES = (".apk", ".aab", ".aar", ".jks", ".keystore", ".p12", ".pem")
BAD_NAMES = {"local.properties"}
HOME_PATH = re.compile(r"/(?:Users|home)/(?!node/|runner/)[A-Za-z0-9._-]+/")
TS_HOST = re.compile(r"[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.ts\.net", re.I)
# Placeholder tailnets used in docs and examples, and the fake names the address-validation
# tests use on purpose (some are invalid names).
PLACEHOLDER_TAILNETS = ("example.ts.net", "your-tailnet.ts.net", "tail1234.ts.net")
TS_FIXTURES = re.compile(r"^(?:-bad|bad-|bad|host)\.ts\.net$", re.I)
MAX_TEXT = 2_000_000


def bad_path(path: str):
    parts = path.split("/")
    if any(p in BAD_DIRS for p in parts[:-1]):
        return "is build output or a cache folder"
    name = parts[-1]
    if name in BAD_NAMES or name.lower().endswith(BAD_SUFFIXES):
        return "is a build, key or machine-specific file"
    if name.startswith(".env") and name != ".env.example":
        return "is an environment file"
    return None


def bad_text(text: str):
    """Plain-language problems found in a file's text (first of each kind)."""
    found = []
    m = HOME_PATH.search(text)
    if m:
        found.append(f"contains a local home-directory path ({m.group(0)}…)")
    for host in TS_HOST.findall(text):
        h = host.lower()
        if any(h == t or h.endswith("." + t) for t in PLACEHOLDER_TAILNETS) or TS_FIXTURES.match(h):
            continue
        found.append(f"contains a Tailscale host name ({host}); use blackwall.example.ts.net")
        break
    return found


def read_text(path: pathlib.Path):
    try:
        if not path.is_file() or path.stat().st_size > MAX_TEXT:
            return None
        data = path.read_bytes()
    except OSError:
        return None
    if b"\x00" in data[:4096]:
        return None  # binary (images, fonts)
    return data.decode("utf-8", "replace")


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def changed_paths():
    out = git("status", "--porcelain", "-z", "--untracked-files=all").split("\0")
    paths = []
    for entry in out:
        if len(entry) < 4:
            continue
        status, path = entry[:2], entry[3:]
        if "D" in status:
            continue
        paths.append(path)
    return paths


def tracked_paths():
    return [p for p in git("ls-files", "-z").split("\0") if p]


def check(paths, root="."):
    problems = []
    for path in paths:
        why = bad_path(path)
        if why:
            problems.append(f"{path} {why}.")
            continue
        text = read_text(pathlib.Path(root) / path)
        if text is None:
            continue
        for line in bad_text(text):
            problems.append(f"{path} {line}.")
    return problems


def main():
    paths = tracked_paths() if "--tree" in sys.argv[1:] else changed_paths()
    problems = check(paths)
    if problems:
        print("These must stay out of the repo:")
        for line in problems:
            print(f"- {line}")
        sys.exit(1)
    print(f"Guard passed ({len(paths)} files checked).")


if __name__ == "__main__":
    main()
