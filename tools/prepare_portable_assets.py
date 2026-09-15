"""Prepare the portable PlayStunts DX runtime, including optional custom cars.

Custom cars may live directly in ``Custom Cars`` next to the application or in
arbitrarily nested subdirectories. A CARxxxx.RES file defines a car and its
STxxxx.P3S, STDAxxxx.PVS and STDBxxxx.PVS companions must live in the same
folder. Original Stunts files are never modified.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path

import prepare_desktop_assets as desktop
from extract import resources, unpack

MAX_CARS = 32


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


def directory_files(directory: Path) -> dict[str, Path]:
    result: dict[str, Path] = {}
    for path in directory.iterdir():
        if not path.is_file():
            continue
        key = path.name.upper()
        if key in result:
            raise ValueError(f"Duplicate case-insensitive filename in {directory}: {key}")
        result[key] = path
    return result


def validate_custom_car(car_id: str, files: dict[str, Path]) -> None:
    car_name = f"CAR{car_id}.RES"
    model_name = f"ST{car_id}.P3S"
    dash_name = f"STDA{car_id}.PVS"
    gear_name = f"STDB{car_id}.PVS"
    required = [car_name, model_name, dash_name, gear_name]
    missing = [name for name in required if name not in files]
    if missing:
        raise ValueError("missing " + ", ".join(missing))

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

    original_ids = {
        name[3:-4]
        for name in original_files
        if name.startswith("CAR") and name.endswith(".RES") and len(name) == 11
    }
    used_ids = set(original_ids)
    loaded: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []

    for car_file in custom_car_candidates(custom_root):
        car_id = car_file.stem[3:].upper()
        relative = str(car_file.relative_to(custom_root))
        if car_id in used_ids:
            skipped.append({"id": car_id, "file": relative, "reason": "duplicate car ID"})
            continue
        if len(used_ids) >= MAX_CARS:
            skipped.append({"id": car_id, "file": relative, "reason": "32-car limit reached"})
            continue

        try:
            files = directory_files(car_file.parent)
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
        "discovered": len(custom_car_candidates(custom_root)),
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
    if not original.is_dir():
        raise ValueError(f"Gamedata directory does not exist: {original}")

    with tempfile.TemporaryDirectory(prefix="playstuntsdx-custom-cars-") as temporary:
        merged = Path(temporary) / "merged"
        custom_report = merge_custom_cars(original, custom_root, merged)
        desktop.extract_car_models = extract_car_models
        report = desktop.prepare(merged, output)

    report["customCars"] = custom_report
    manifest = output / "desktop-preparation.json"
    manifest.write_text(json.dumps(report, indent=2) + "\n")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original", required=True, type=Path)
    parser.add_argument("--custom-cars", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    custom_root = args.custom_cars or args.original.resolve().parent / "Custom Cars"
    try:
        custom_root.mkdir(parents=True, exist_ok=True)
        report = prepare(args.original, custom_root, args.output)
        print(json.dumps(report, separators=(",", ":")))
        return 0
    except Exception as error:
        print(f"PlayStunts DX asset preparation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
