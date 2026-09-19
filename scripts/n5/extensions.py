"""Install/verify only the locked N5 VSIX set, including exact extracted bytes."""
import hashlib
import io
import json
from pathlib import Path
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "examples/ivory-n5-browser"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    mode = sys.argv[1] if len(sys.argv) == 2 else ""
    if mode not in ("install", "verify"):
        raise ValueError("Usage: extensions.py install|verify")
    lock = json.loads((APP / "extensions.lock.json").read_text())
    entries = lock["extensions"]
    ids = {entry["id"].lower() for entry in entries}
    if len(ids) != len(entries):
        raise ValueError("Duplicate extension ID")
    plugins = APP / "plugins"
    if mode == "install":
        plugins.mkdir(exist_ok=True)
    expected_dirs = {entry["id"] for entry in entries}
    if plugins.exists() and set(p.name for p in plugins.iterdir()) - expected_dirs:
        raise ValueError("Unapproved entries in isolated plugin directory")
    for entry in entries:
        archive = ROOT / "artifacts/n5/vsix" / (entry["id"] + ".vsix")
        if mode == "install" and not archive.exists():
            archive.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(entry["url"], timeout=60) as response:
                data = response.read()
            if digest(data) != entry["sha256"]:
                raise ValueError("Download digest mismatch: " + entry["id"])
            archive.write_bytes(data)
        data = archive.read_bytes()
        if digest(data) != entry["sha256"]:
            raise ValueError("Archive digest mismatch: " + entry["id"])
        with zipfile.ZipFile(io.BytesIO(data)) as bundle:
            manifest = json.loads(bundle.read("extension/package.json"))
            if manifest["publisher"] + "." + manifest["name"] != entry["id"] or manifest["version"] != entry["version"]:
                raise ValueError("Manifest identity mismatch")
            dependencies = manifest.get("extensionDependencies", [])
            if dependencies != entry["dependencies"] or not {d.lower() for d in dependencies} <= ids:
                raise ValueError("Unpinned required extension dependency")
            if manifest.get("extensionPack", []) != entry["optionalPackExcluded"]:
                raise ValueError("Extension pack changed")
            target = plugins / entry["id"]
            expected_files = set()
            for name in bundle.namelist():
                if not name.startswith("extension/") or name.endswith("/"):
                    continue
                relative = Path(name[len("extension/"):])
                destination = (target / relative).resolve()
                if not destination.is_relative_to(target.resolve()):
                    raise ValueError("Unsafe archive path")
                if str(relative) in expected_files:
                    raise ValueError("Duplicate archive path")
                expected_files.add(str(relative))
                content = bundle.read(name)
                if mode == "install":
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(content)
                if destination.read_bytes() != content:
                    raise ValueError("Installed extension differs: " + str(relative))
            actual_files = {str(p.relative_to(target)) for p in target.rglob("*") if p.is_file()}
            if actual_files != expected_files:
                raise ValueError("Unexpected installed files: " + entry["id"])
        print(entry["id"] + "@" + entry["version"] + " verified " + entry["sha256"])


if __name__ == "__main__":
    main()
