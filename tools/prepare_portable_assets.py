"""Prepare the portable PlayStunts DX runtime, including optional custom content.

Custom cars may live directly in ``Custom Cars`` next to the application or in
arbitrarily nested subdirectories. A CARxxxx.RES file defines a car; its
STxxxx.P3S, STDAxxxx.PVS and STDBxxxx.PVS companions are resolved recursively
from the same package first and then, when unique, from the full Custom Cars
tree. Custom ``.TRK`` files may likewise live directly in ``Custom Tracks`` or
in nested folders. Original Stunts files are never modified.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
import traceback
from pathlib import Path

import prepare_desktop_assets as desktop
from extract import resources, unpack

MAX_CARS = 32
STUNTS_TRACK_BYTES = 1802
MUTABLE_GAME_EXTENSIONS = {".TRK", ".RPL", ".HIG"}


def copy_portable_assets(files: dict[str, Path], output: Path) -> list[str]:
    """Copy direct assets while separating layout recipes from version checks.

    ``direct-asset-recipes.json`` says where a source file is needed in the
    runtime. It is not a trustworthy release fingerprint because it was built
    from a working game directory that may also contain setup helpers and user
    data. Only files explicitly present in ``original-file-checksums.json`` are
    eligible for strict release validation. Tracks, replays and high scores are
    mutable by design and are never used to identify the game release.
    """
    recipes = json.loads(desktop.bundled_file("direct-asset-recipes.json").read_text())
    canonical = json.loads(desktop.bundled_file("original-file-checksums.json").read_text()).get("files", {})
    missing: list[str] = []
    for row in recipes:
        name = row["source"].upper()
        file = files.get(name)
        if file is None:
            missing.append(name)
            continue

        data = file.read_bytes()
        extension = Path(name).suffix.upper()
        reference = canonical.get(name)
        if reference is not None and extension not in MUTABLE_GAME_EXTENSIONS:
            expected_size = reference.get("bytes")
            if expected_size is not None and len(data) != int(expected_size):
                raise ValueError(f"Unsupported reference file size: {name}")
            if desktop.digest(data) != reference["sha256"]:
                raise ValueError(f"Unsupported reference file checksum: {name}")
        elif extension == ".TRK" and len(data) != STUNTS_TRACK_BYTES:
            raise ValueError(f"Invalid Stunts track length: {name}")

        relative = Path(row["path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Invalid runtime output path")
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return sorted(set(missing))


def custom_car_candidates(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        (
            path
            for path in root.rglob("*")
            if path.is_file()
            and path.suffix.upper() == ".RES"
            and path.stem.upper().startswith("CAR")
            and len(path.stem) == 7
        ),
        key=lambda path: str(path.relative_to(root)).casefold(),
    )


def custom_track_candidates(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        (
            path
            for path in root.rglob("*")
            if path.is_file() and path.suffix.upper() == ".TRK"
        ),
        key=lambda path: str(path.relative_to(root)).casefold(),
    )


def recursive_file_index(root: Path) -> dict[str, list[Path]]:
    """Index custom content by DOS-style case-insensitive basename."""
    result: dict[str, list[Path]] = {}
    if not root.is_dir():
        return result
    for path in root.rglob("*"):
        if path.is_file():
            result.setdefault(path.name.upper(), []).append(path)
    for paths in result.values():
        paths.sort(key=lambda path: str(path.relative_to(root)).casefold())
    return result


def is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def resolve_custom_car_files(car_file: Path, custom_root: Path, index: dict[str, list[Path]]) -> dict[str, Path]:
    """Resolve one car pack without requiring every file to be a direct sibling.

    A companion inside the CAR file's package subtree wins. If a pack keeps its
    companion files elsewhere in Custom Cars, a unique basename is accepted.
    Ambiguous duplicates are rejected instead of silently mixing two car packs.
    """
    car_id = car_file.stem[3:].upper()
    car_name = f"CAR{car_id}.RES"
    required = [car_name, f"ST{car_id}.P3S", f"STDA{car_id}.PVS", f"STDB{car_id}.PVS"]
    files: dict[str, Path] = {car_name: car_file}
    missing: list[str] = []

    for name in required[1:]:
        matches = index.get(name, [])
        if not matches:
            missing.append(name)
            continue
        local = [path for path in matches if is_within(path, car_file.parent)]
        candidates = local or matches
        if len(candidates) != 1:
            locations = ", ".join(str(path.relative_to(custom_root)) for path in candidates)
            raise ValueError(f"ambiguous {name}: {locations}")
        files[name] = candidates[0]

    if missing:
        raise ValueError("missing " + ", ".join(missing))
    return files


def validate_custom_car(car_id: str, files: dict[str, Path]) -> None:
    car_name = f"CAR{car_id}.RES"
    model_name = f"ST{car_id}.P3S"
    dash_name = f"STDA{car_id}.PVS"
    gear_name = f"STDB{car_id}.PVS"

    car = resources(files[car_name].read_bytes())
    if not all(name in car for name in ["simd", "gnam", "edes"]):
        raise ValueError(f"{car_name} is missing required resources")

    model = resources(unpack(files[model_name].read_bytes()))
    model_required = ["car0", "car1", "car2", "exp0", "exp1", "exp2", "exp3"]
    if not all(name in model for name in model_required):
        raise ValueError(f"{model_name} is not a complete Stunts car model bank")

    dash = resources(unpack(files[dash_name].read_bytes()))
    dash_required = ["dash", "ins2", "inm1", "ins1", "inm3", "ins3"]
    if not all(name in dash for name in dash_required):
        raise ValueError(f"{dash_name} is missing required cockpit resources")

    gear = resources(unpack(files[gear_name].read_bytes()))
    gear_required = ["gbox", "gnab", "gnob", "dota", "dot "]
    if not all(name in gear for name in gear_required):
        raise ValueError(f"{gear_name} is missing required cockpit resources")


def merge_custom_cars(original: Path, custom_root: Path, merged: Path) -> dict[str, object]:
    original_files = desktop.source_files(original)
    merged.mkdir(parents=True, exist_ok=True)
    for name, path in original_files.items():
        shutil.copyfile(path, merged / name)

    candidates = custom_car_candidates(custom_root)
    index = recursive_file_index(custom_root)
    original_ids = {
        name[3:-4]
        for name in original_files
        if name.startswith("CAR") and name.endswith(".RES") and len(name) == 11
    }
    used_ids = set(original_ids)
    loaded: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []

    for car_file in candidates:
        car_id = car_file.stem[3:].upper()
        relative = str(car_file.relative_to(custom_root))
        if car_id in used_ids:
            skipped.append({"id": car_id, "file": relative, "reason": "duplicate car ID"})
            continue
        if len(used_ids) >= MAX_CARS:
            skipped.append({"id": car_id, "file": relative, "reason": "32-car limit reached"})
            continue

        try:
            files = resolve_custom_car_files(car_file, custom_root, index)
            validate_custom_car(car_id, files)
        except Exception as error:
            skipped.append({"id": car_id, "file": relative, "reason": str(error)})
            continue

        for name in [f"CAR{car_id}.RES", f"ST{car_id}.P3S", f"STDA{car_id}.PVS", f"STDB{car_id}.PVS"]:
            shutil.copyfile(files[name], merged / name)
        used_ids.add(car_id)
        loaded.append({"id": car_id, "folder": str(car_file.parent.relative_to(custom_root))})

    return {
        "limit": MAX_CARS,
        "original": len(original_ids),
        "discovered": len(candidates),
        "loaded": loaded,
        "skipped": skipped,
    }


def merge_custom_tracks(custom_root: Path, merged: Path) -> dict[str, object]:
    """Add valid external tracks without replacing supplied or earlier files."""
    candidates = custom_track_candidates(custom_root)
    used_names = {path.name.upper() for path in merged.iterdir() if path.is_file()}
    loaded: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []

    for track_file in candidates:
        relative = str(track_file.relative_to(custom_root))
        name = track_file.name.upper()
        data = track_file.read_bytes()
        if len(data) != STUNTS_TRACK_BYTES:
            skipped.append({
                "file": relative,
                "reason": f"invalid Stunts track length ({len(data)} bytes; expected {STUNTS_TRACK_BYTES})",
            })
            continue
        if name in used_names:
            skipped.append({"file": relative, "reason": f"duplicate track filename: {name}"})
            continue

        (merged / name).write_bytes(data)
        used_names.add(name)
        loaded.append({"file": relative, "name": name})

    return {
        "discovered": len(candidates),
        "loaded": loaded,
        "skipped": skipped,
    }


def extract_car_models(source: Path, output: Path) -> None:
    """Desktop extractor variant that accepts original plus custom model banks."""
    output.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {}
    for path in sorted(source.glob("ST*.P3S")):
        packed = path.read_bytes()
        blob = unpack(packed)
        entries = resources(blob)
        required = ["car0", "car1", "car2", "exp0", "exp1", "exp2", "exp3"]
        if not all(name in entries for name in required):
            continue
        car = path.stem[2:].upper()
        (output / f"{car.lower()}.bin").write_bytes(blob)
        manifest[car] = {
            "source": path.name,
            "packedSha256": desktop.digest(packed),
            "sha256": desktop.digest(blob),
            "bytes": len(blob),
            "shapes": list(entries),
        }

    expected = {path.stem[3:].upper() for path in source.glob("CAR*.RES")}
    missing = sorted(expected - set(manifest))
    if missing:
        raise ValueError("Missing car model bank for: " + ", ".join(missing))
    (output / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")))


def prepare(original: Path, custom_root: Path, output: Path) -> dict[str, object]:
    original = original.resolve()
    custom_root = custom_root.resolve()
    custom_tracks_root = custom_root.parent / "Custom Tracks"
    if not original.is_dir():
        raise ValueError(f"Gamedata directory does not exist: {original}")

    with tempfile.TemporaryDirectory(prefix="playstuntsdx-custom-content-") as temporary:
        merged = Path(temporary) / "merged"
        custom_car_report = merge_custom_cars(original, custom_root, merged)
        custom_track_report = merge_custom_tracks(custom_tracks_root, merged)
        desktop.copy_verified = copy_portable_assets
        desktop.extract_car_models = extract_car_models
        report = desktop.prepare(merged, output)

    report["customCars"] = custom_car_report
    report["customTracks"] = custom_track_report
    manifest = output / "desktop-preparation.json"
    manifest.write_text(json.dumps(report, indent=2) + "\n")
    return report


def self_test_unicorn() -> None:
    """Execute generated x86 code so CFG-incompatible frozen builds fail early."""
    from unicorn import Uc, UC_ARCH_X86, UC_MODE_16

    emulator = Uc(UC_ARCH_X86, UC_MODE_16)
    emulator.mem_map(0, 0x1000)
    emulator.mem_write(0, b"\x90\x90")
    emulator.emu_start(0, 2, count=2)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test-unicorn", action="store_true")
    parser.add_argument("--original", type=Path)
    parser.add_argument("--custom-cars", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    if args.self_test_unicorn:
        self_test_unicorn()
        print("Unicorn execution self-test passed.")
        return 0
    if args.original is None or args.output is None:
        parser.error("--original and --output are required unless --self-test-unicorn is used")

    custom_root = args.custom_cars or args.original.resolve().parent / "Custom Cars"
    custom_tracks_root = custom_root.parent / "Custom Tracks"
    try:
        custom_root.mkdir(parents=True, exist_ok=True)
        custom_tracks_root.mkdir(parents=True, exist_ok=True)
        report = prepare(args.original, custom_root, args.output)
        print(json.dumps(report, separators=(",", ":")))
        return 0
    except Exception as error:
        print(f"PlayStunts DX asset preparation failed: {error}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
