"""Portable asset entrypoint with an external, user-editable hires mirror.

The original runtime builder stays unchanged in prepare_portable_assets_core.
This wrapper prevents a second Runtime/game/hires tree, migrates the legacy
"High Res" folder to "hires", and seeds missing cockpit PNGs from Runtime.
"""
from __future__ import annotations

import filecmp
import shutil
import sys
from pathlib import Path

import prepare_portable_assets_core as portable


def _argument_path(name: str) -> Path | None:
    try:
        index = sys.argv.index(name)
    except ValueError:
        return None
    if index + 1 >= len(sys.argv):
        return None
    return Path(sys.argv[index + 1]).resolve()


def _external_root() -> Path | None:
    custom = _argument_path("--custom-cars")
    if custom is not None:
        return custom.parent
    original = _argument_path("--original")
    return original.parent if original is not None else None


def _copy_missing_tree(source: Path, target: Path) -> None:
    if not source.is_dir():
        return
    for path in sorted((item for item in source.rglob("*") if item.is_file()), key=lambda item: str(item.relative_to(source)).casefold()):
        destination = target / path.relative_to(source)
        if destination.exists():
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, destination)


def _same_tree(source: Path, target: Path) -> bool:
    if not source.is_dir():
        return True
    for path in (item for item in source.rglob("*") if item.is_file()):
        destination = target / path.relative_to(source)
        if not destination.is_file() or not filecmp.cmp(path, destination, shallow=False):
            return False
    return True


def _migrate_legacy_hires(root: Path) -> None:
    legacy = root / "High Res"
    hires = root / "hires"
    if not legacy.is_dir():
        return
    if not hires.exists():
        legacy.rename(hires)
        return
    _copy_missing_tree(legacy, hires)
    if _same_tree(legacy, hires):
        shutil.rmtree(legacy)


def _seed_hires_cockpits(_legacy_source: Path, output: Path) -> dict[str, object]:
    root = _legacy_source.parent
    hires = root / "hires" / "cockpit"
    source = output / "game" / "cockpit"
    copied: list[str] = []
    kept: list[str] = []
    hires.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        for path in sorted(source.rglob("*.png"), key=lambda item: str(item.relative_to(source)).casefold()):
            relative = path.relative_to(source)
            destination = hires / relative
            if destination.exists():
                kept.append(relative.as_posix())
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, destination)
            copied.append(relative.as_posix())
    return {"cockpitCopied": copied, "cockpitKept": kept}


def main() -> int:
    root = _external_root()
    if root is not None:
        _migrate_legacy_hires(root)
        (root / "hires" / "cockpit").mkdir(parents=True, exist_ok=True)

    # The core calls this after Runtime has been generated. Replace the old
    # Runtime/game/hires mirror with a missing-only external cockpit seed.
    portable.copy_high_res_assets = _seed_hires_cockpits
    result = portable.main()

    # The legacy core still creates High Res/cockpit before preparation. Remove
    # that compatibility directory when it contains no user data.
    if root is not None:
        legacy = root / "High Res"
        if legacy.is_dir() and not any(path.is_file() for path in legacy.rglob("*")):
            shutil.rmtree(legacy)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
