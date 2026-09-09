#!/usr/bin/env python3
"""Build and validate BackgroundSearch browser extension packages."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

COMMON_FILES = [
    "LICENSE",
    "INSTALL.html",
    "background.js",
    "content.js",
    "engines.json",
    "popup.html",
    "popup.js",
    "post.html",
    "post.js",
    "quickmenu.js",
    "privacy.html",
    "icons/16.png",
    "icons/32.png",
    "icons/48.png",
    "icons/128.png",
]

TARGETS = {
    "chrome": {
        "manifest": "manifest.json",
        "extra_files": ["sidepanel.html", "sidepanel.js"],
    },
    "firefox": {
        "manifest": "manifest.firefox.json",
        "extra_files": [],
    },
}


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{path.name}: invalid JSON: {exc}") from exc


def validate_manifest(target: str, manifest: dict) -> str:
    version = manifest.get("version")
    if not version:
        raise SystemExit(f"{target}: manifest has no version")

    if manifest.get("manifest_version") != 3:
        raise SystemExit(f"{target}: manifest_version must be 3")

    action_icons = manifest.get("action", {}).get("default_icon", {})
    root_icons = manifest.get("icons", {})
    for size in ("16", "32", "48", "128"):
        expected = f"icons/{size}.png"
        if action_icons.get(size) != expected or root_icons.get(size) != expected:
            raise SystemExit(f"{target}: icon {size} must reference {expected}")
        if not (ROOT / expected).is_file():
            raise SystemExit(f"{target}: missing {expected}")

    background = manifest.get("background", {})
    permissions = set(manifest.get("permissions", []))

    if target == "chrome":
        if "service_worker" not in background:
            raise SystemExit("chrome: background.service_worker is required")
        if "scripts" in background:
            raise SystemExit("chrome: background.scripts is not valid for this MV3 package")
        if "sidePanel" not in permissions or "tabGroups" not in permissions:
            raise SystemExit("chrome: sidePanel and tabGroups permissions are required")
        if "browser_specific_settings" in manifest:
            raise SystemExit("chrome: browser_specific_settings must stay out of the Chrome manifest")
    elif target == "firefox":
        gecko = manifest.get("browser_specific_settings", {}).get("gecko", {})
        if not gecko.get("id"):
            raise SystemExit("firefox: browser_specific_settings.gecko.id is required")
        data_permissions = gecko.get("data_collection_permissions", {})
        if data_permissions.get("required") != ["none"]:
            raise SystemExit("firefox: gecko.data_collection_permissions.required must be ['none']")
        if background.get("scripts") != ["background.js"]:
            raise SystemExit("firefox: background.scripts must load background.js")
        if "service_worker" in background:
            raise SystemExit("firefox: service_worker must stay out of the Firefox manifest")
        forbidden = {"sidePanel", "tabGroups"}
        if permissions & forbidden:
            raise SystemExit(f"firefox: unsupported permissions present: {sorted(permissions & forbidden)}")
        if "side_panel" in manifest:
            raise SystemExit("firefox: side_panel must stay out of the Firefox manifest")

    return version


def stage_target(target: str, version: str) -> Path:
    config = TARGETS[target]
    stage = DIST / f"BackgroundSearch-v{version}-{target}"
    stage.mkdir(parents=True, exist_ok=True)

    manifest = read_json(ROOT / config["manifest"])
    (stage / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    for rel in COMMON_FILES + config["extra_files"]:
        src = ROOT / rel
        if not src.is_file():
            raise SystemExit(f"{target}: missing package file {rel}")
        dst = stage / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    return stage


def zip_stage(stage: Path, version: str, target: str) -> Path:
    zip_path = DIST / f"BackgroundSearch-v{version}-{target}.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(stage.rglob("*")):
            if path.is_file():
                info = zipfile.ZipInfo(path.relative_to(stage).as_posix(), date_time=(2020, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, path.read_bytes())

    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
        for name in names:
            if "\\" in name:
                raise SystemExit(f"{target}: ZIP entry contains backslash: {name}")
        if "manifest.json" not in names:
            raise SystemExit(f"{target}: ZIP missing manifest.json")
        if archive.testzip() is not None:
            raise SystemExit(f"{target}: corrupt ZIP entry")

    return zip_path


def build(targets: list[str], validate_only: bool) -> None:
    manifests = {target: read_json(ROOT / TARGETS[target]["manifest"]) for target in targets}
    versions = {target: validate_manifest(target, manifest) for target, manifest in manifests.items()}
    if len(set(versions.values())) != 1:
        raise SystemExit(f"manifest versions do not match: {versions}")

    version = next(iter(versions.values()))
    if validate_only:
        print(f"Validated BackgroundSearch v{version}: {', '.join(targets)}")
        return

    redirected = DIST.exists() and bool(getattr(DIST.lstat(), "st_file_attributes", 0) & 0x400)
    if DIST.is_symlink() or redirected or DIST.resolve() != ROOT.resolve() / "dist":
        raise SystemExit("Refusing to clean an unexpected or redirected build directory.")
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    built = []
    for target in targets:
        stage = stage_target(target, version)
        built.append(zip_stage(stage, version, target))

    for path in built:
        print(path.relative_to(ROOT))


def main() -> int:
    parser = argparse.ArgumentParser(description="Build BackgroundSearch extension packages.")
    parser.add_argument(
        "--target",
        choices=sorted(TARGETS),
        action="append",
        help="Build one target. Repeat for multiple targets. Defaults to all targets.",
    )
    parser.add_argument("--validate-only", action="store_true", help="Validate manifests without writing dist/.")
    args = parser.parse_args()

    targets = args.target or sorted(TARGETS)
    build(targets, args.validate_only)
    return 0


if __name__ == "__main__":
    sys.exit(main())
