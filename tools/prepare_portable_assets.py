"""Portable asset entrypoint with an external, user-editable hires mirror.

The original runtime builder stays unchanged in prepare_portable_assets_core.
This wrapper prevents a second Runtime/game/hires tree, migrates the legacy
"High Res" folder to "hires", exports lossless original reference artwork,
and seeds missing external hires files from those Runtime references.
"""
from __future__ import annotations

import filecmp
import shutil
import struct
import sys
from pathlib import Path

from PIL import Image

import prepare_portable_assets_core as portable
from extract import resources, shape_pixels, unpack


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


def _copy_missing_tree(source: Path, target: Path) -> tuple[list[str], list[str]]:
    copied: list[str] = []
    kept: list[str] = []
    if not source.is_dir():
        return copied, kept
    for path in sorted((item for item in source.rglob("*") if item.is_file()), key=lambda item: str(item.relative_to(source)).casefold()):
        destination = target / path.relative_to(source)
        relative = path.relative_to(source).as_posix()
        if destination.exists():
            kept.append(relative)
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, destination)
        copied.append(relative)
    return copied, kept


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


def _case_file(source: Path, name: str) -> Path:
    direct = source / name
    if direct.is_file():
        return direct
    wanted = name.casefold()
    for path in source.iterdir():
        if path.is_file() and path.name.casefold() == wanted:
            return path
    raise FileNotFoundError(name)


def _pvs_entries(source: Path, name: str) -> dict[str, bytes]:
    return resources(unpack(_case_file(source, name).read_bytes()))


def _palette_from(entries: dict[str, bytes], fallback: list[int]) -> list[int]:
    raw = entries.get("!pal")
    if raw is None:
        return fallback
    values = raw[16:]
    if len(values) < 768:
        return fallback
    # Match the original runtime palette conversion exactly. This is a direct
    # indexed-colour expansion only; it performs no interpolation or filtering.
    return [min(255, value * 4) for value in values[:768]]


def _save_original_frame(frame: bytes, palette: list[int], target: Path) -> None:
    if len(frame) < 16:
        raise ValueError(f"Invalid original bitmap resource for {target.name}")
    width, height = struct.unpack_from("<HH", frame)
    pixels = shape_pixels(frame)
    if len(pixels) != width * height:
        raise ValueError(f"Invalid original bitmap dimensions for {target.name}")
    image = Image.frombytes("P", (width, height), pixels)
    image.putpalette(palette)
    target.parent.mkdir(parents=True, exist_ok=True)
    # Keep the original indexed pixels. Pillow's PNG writer is lossless and no
    # resize/resample operation occurs anywhere in this export path.
    image.save(target, format="PNG", optimize=False)


def _export_original_references(source: Path, runtime: Path) -> dict[str, list[str]]:
    """Export reference PNGs straight from the original PVS pixel data.

    These files are deliberately independent of live texture filtering. They
    are reference/source images only and must never contain a rendered or
    smoothed canvas capture.
    """
    game = runtime / "game"
    exported: dict[str, list[str]] = {"menu": [], "intro": [], "backgrounds": []}

    base_entries = _pvs_entries(source, "SDMAIN.PVS")
    base_palette = _palette_from(base_entries, [0] * 768)

    menu_entries = _pvs_entries(source, "SDMSEL.PVS")
    menu_palette = _palette_from(menu_entries, base_palette)
    if "scrn" in menu_entries:
        target = game / "menu" / "main-menu.png"
        _save_original_frame(menu_entries["scrn"], menu_palette, target)
        exported["menu"].append(target.name)

    title_entries = _pvs_entries(source, "SDTITL.PVS")
    title_palette = _palette_from(title_entries, base_palette)
    title_names = {"prod": "mindscape.png", "titl": "title.png"}
    for resource_name, filename in title_names.items():
        if resource_name not in title_entries:
            continue
        target = game / "intro" / filename
        _save_original_frame(title_entries[resource_name], title_palette, target)
        exported["intro"].append(target.name)

    for environment in ["DESERT", "TROPICAL", "ALPINE", "CITY", "COUNTRY"]:
        entries = _pvs_entries(source, f"{environment}.PVS")
        palette = _palette_from(entries, base_palette)
        for resource_name in ["scen", "sce2", "sce3", "sce4"]:
            if resource_name not in entries:
                continue
            filename = f"{environment.lower()}-{resource_name}.png"
            target = game / "backgrounds" / filename
            _save_original_frame(entries[resource_name], palette, target)
            exported["backgrounds"].append(target.name)

    return exported


def _seed_hires_references(_legacy_source: Path, output: Path) -> dict[str, object]:
    root = _legacy_source.parent
    hires = root / "hires"
    copied: dict[str, list[str]] = {}
    kept: dict[str, list[str]] = {}
    for category in ["cockpit", "backgrounds", "intro", "menu"]:
        category_copied, category_kept = _copy_missing_tree(output / "game" / category, hires / category)
        copied[category] = category_copied
        kept[category] = category_kept
    return {"copied": copied, "kept": kept}


def main() -> int:
    root = _external_root()
    original = _argument_path("--original")
    output = _argument_path("--output")
    if root is not None:
        _migrate_legacy_hires(root)
        for category in ["cockpit", "backgrounds", "intro", "menu"]:
            (root / "hires" / category).mkdir(parents=True, exist_ok=True)

    # Let the core finish the runtime first. Its high-res callback now mirrors
    # all Runtime reference categories externally, without overwriting user art.
    portable.copy_high_res_assets = _seed_hires_references
    result = portable.main()

    # The core callback runs before this wrapper regains control. Export the
    # remaining original reference categories now, then seed only missing files.
    if result == 0 and original is not None and output is not None and output.is_dir():
        _export_original_references(original, output)
        if root is not None:
            _seed_hires_references(root / "High Res", output)

    # The legacy core still creates High Res/cockpit before preparation. Remove
    # that compatibility directory when it contains no user data.
    if root is not None:
        legacy = root / "High Res"
        if legacy.is_dir() and not any(path.is_file() for path in legacy.rglob("*")):
            shutil.rmtree(legacy)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
