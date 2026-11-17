#!/usr/bin/env python3
"""Regenerate the offline cache manifest and the service worker cache id.

Run this after changing any game file:

    python3 tools/refresh-cache.py

It rewrites manifest.appcache and the CACHE/CORE constants in sw.js so
KaiOS 2.5 (AppCache) and KaiOS 3+ (Service Worker) both pick up the new
files on the next online visit.
"""

import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_DIRS = {".git", ".github", "node_modules", "tools", ".vscode", ".idea"}
SKIP_FILES = {"manifest.appcache", "sw.js", ".nojekyll"}
WEB_EXT = {
    ".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".jpeg",
    ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".otf",
    ".mp3", ".ogg", ".wav", ".webm", ".mp4",
}


def collect_files():
    found = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            if name in SKIP_FILES or name.startswith("."):
                continue
            if os.path.splitext(name)[1].lower() not in WEB_EXT:
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), ROOT)
            found.append(rel.replace(os.sep, "/"))
    return sorted(found)


def main():
    files = collect_files()
    digest = hashlib.sha1()
    for rel in files:
        with open(os.path.join(ROOT, rel), "rb") as handle:
            digest.update(handle.read())
    version = "wg-" + digest.hexdigest()[:10]

    lines = [
        "CACHE MANIFEST",
        "# Offline Web Games " + version,
        "",
        "CACHE:",
    ]
    lines.extend(files)
    lines.extend(["", "NETWORK:", "*", "http://*", "https://*"])

    game_dirs = sorted({
        rel.rsplit("/", 1)[0]
        for rel in files
        if rel.startswith("games/") and rel.endswith("/index.html")
    })
    if game_dirs:
        lines.extend([""])
        lines.append("FALLBACK:")
        for game_dir in game_dirs:
            lines.append("%s/ %s/index.html" % (game_dir, game_dir))

    manifest_text = "\n".join(lines) + "\n"
    manifest_path = os.path.join(ROOT, "manifest.appcache")
    old_manifest = ""
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8") as handle:
            old_manifest = handle.read()
    if old_manifest != manifest_text:
        with open(manifest_path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(manifest_text)
        print("manifest.appcache updated ->", version)
    else:
        print("manifest.appcache unchanged ->", version)

    sw_path = os.path.join(ROOT, "sw.js")
    if os.path.exists(sw_path):
        with open(sw_path, encoding="utf-8") as handle:
            sw = handle.read()
        old_sw = sw

        core_entries = ["'./'", "'./manifest.appcache'"]
        core_entries.extend("'./%s'" % rel for rel in files)
        new_core = "const CORE=[\n  " + ",\n  ".join(core_entries) + "\n];"
        sw = re.sub(r"const CORE=\[.*?\n\];", new_core, sw, count=1, flags=re.S)
        sw = re.sub(r"const CACHE='[^']*';", "const CACHE='%s';" % version, sw, count=1)

        if sw != old_sw:
            with open(sw_path, "w", encoding="utf-8", newline="\n") as handle:
                handle.write(sw)
            print("sw.js updated ->", version)
        else:
            print("sw.js unchanged ->", version)

    print("cached files:", len(files))


if __name__ == "__main__":
    main()
