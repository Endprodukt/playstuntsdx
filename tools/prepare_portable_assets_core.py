"""Prepare the portable PlayStunts DX runtime, including optional custom content.

Custom cars may live directly in ``Custom Cars`` next to the application, in
nested folders, or in ZIP archives. Both original packed graphics (P3S/PVS) and
the uncompressed community formats (3SH/VSH) are accepted. Custom ``.TRK``
files may likewise live directly in ``Custom Tracks`` or in nested folders.
Original Stunts files are never modified.
"""
from __future__ import annotations

import argparse
import json
import shutil
import struct
import sys
import tempfile
import traceback
import zipfile
from pathlib import Path

from PIL import Image

import prepare_desktop_assets as desktop
from extract import resources, shape_pixels, unpack

STUNTS_TRACK_BYTES = 1802
MUTABLE_GAME_EXTENSIONS = {".TRK", ".RPL", ".HIG"}
PACKED_GRAPHICS_EXTENSIONS = {".P3S", ".PVS"}
PROGRESS_PREFIX = "PLAYSTUNTS_PROGRESS\t"


def emit_progress(stage: str, detail: str = "") -> None:
    print(f"{PROGRESS_PREFIX}{stage}\t{detail}", flush=True)


def copy_portable_assets(files: dict[str, Path], output: Path) -> list[str]:
    """Copy direct assets while separating layout recipes from version checks."""
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
        (path for path in root.rglob("*") if path.is_file() and path.suffix.upper() == ".TRK"),
        key=lambda path: str(path.relative_to(root)).casefold(),
    )


def materialize_custom_car_source(root: Path, output: Path) -> dict[str, object]:
    """Copy loose files and safely expand ZIP packages into one temporary tree."""
    output.mkdir(parents=True, exist_ok=True)
    archives = sorted(
        (path for path in root.rglob("*") if path.is_file() and path.suffix.lower() == ".zip"),
        key=lambda path: str(path.relative_to(root)).casefold(),
    ) if root.is_dir() else []
    emit_progress("Scanning custom cars", f"{len(archives)} ZIP package{'s' if len(archives) != 1 else ''}")
    loaded: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []

    if root.is_dir():
        for path in sorted((p for p in root.rglob("*") if p.is_file() and p.suffix.lower() != ".zip"), key=lambda p: str(p.relative_to(root)).casefold()):
            relative = path.relative_to(root)
            target = output / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)

    for number, archive in enumerate(archives):
        relative = str(archive.relative_to(root))
        emit_progress("Unpacking custom car package", relative)
        destination = output / "_archives" / f"{number:03d}-{archive.stem}"
        try:
            with zipfile.ZipFile(archive) as package:
                for member in package.infolist():
                    if member.is_dir():
                        continue
                    relative_member = Path(member.filename.replace("\\", "/"))
                    if relative_member.is_absolute() or ".." in relative_member.parts:
                        raise ValueError(f"unsafe archive member: {member.filename}")
                    target = destination / relative_member
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with package.open(member) as source, target.open("wb") as sink:
                        shutil.copyfileobj(source, sink)
            loaded.append({"file": relative})
        except Exception as error:
            skipped.append({"file": relative, "reason": str(error)})

    return {"discovered": len(archives), "loaded": loaded, "skipped": skipped}


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


def resolve_variant(
    names: list[str], car_file: Path, custom_root: Path, index: dict[str, list[Path]], label: str
) -> Path:
    """Prefer Stunts' packed variant, then accept the uncompressed community one."""
    for local_only in (True, False):
        for name in names:
            matches = index.get(name, [])
            candidates = [path for path in matches if is_within(path, car_file.parent)] if local_only else matches
            if not candidates:
                continue
            if len(candidates) != 1:
                locations = ", ".join(str(path.relative_to(custom_root)) for path in candidates)
                raise ValueError(f"ambiguous {label}: {locations}")
            return candidates[0]
    raise ValueError("missing " + " or ".join(names))


def resolve_custom_car_files(car_file: Path, custom_root: Path, index: dict[str, list[Path]]) -> dict[str, Path]:
    car_id = car_file.stem[3:].upper()
    return {
        "car": car_file,
        "model": resolve_variant([f"ST{car_id}.P3S", f"ST{car_id}.3SH"], car_file, custom_root, index, "3D model"),
        "dash": resolve_variant([f"STDA{car_id}.PVS", f"STDA{car_id}.VSH"], car_file, custom_root, index, "dashboard"),
        "gear": resolve_variant([f"STDB{car_id}.PVS", f"STDB{car_id}.VSH"], car_file, custom_root, index, "dashboard controls"),
    }


def graphics_blob(path: Path) -> bytes:
    data = path.read_bytes()
    return unpack(data) if path.suffix.upper() in PACKED_GRAPHICS_EXTENSIONS else data


def graphics_resources(path: Path) -> dict[str, bytes]:
    return resources(graphics_blob(path))


def validate_custom_car(car_id: str, files: dict[str, Path]) -> None:
    car = resources(files["car"].read_bytes())
    if not all(name in car for name in ["simd", "gnam", "edes"]):
        raise ValueError(f"CAR{car_id}.RES is missing required resources")

    model = graphics_resources(files["model"])
    model_required = ["car0", "car1", "car2", "exp0", "exp1", "exp2", "exp3"]
    if not all(name in model for name in model_required):
        raise ValueError(f"{files['model'].name} is not a complete Stunts car model bank")

    # STDA contains the static dashboard, instrument reference and gear-stick
    # base. The left/right uncovered instrument overlays are optional in the
    # Stunts format and are not present in every custom dashboard.
    dash = graphics_resources(files["dash"])
    dash_required = ["dash", "ins2", "gbox"]
    if not all(name in dash for name in dash_required):
        raise ValueError(f"{files['dash'].name} is missing required cockpit resources")

    # STDB contains moving dashboard parts. gbox deliberately is not checked
    # here: it belongs to STDA, while gnob/gnab and dot/dota live in STDB.
    gear = graphics_resources(files["gear"])
    gear_required = ["gnab", "gnob", "dota", "dot "]
    if not all(name in gear for name in gear_required):
        raise ValueError(f"{files['gear'].name} is missing required cockpit resources")


def merge_custom_cars(original: Path, custom_root: Path, merged: Path) -> dict[str, object]:
    original_files = desktop.source_files(original)
    merged.mkdir(parents=True, exist_ok=True)
    for name, path in original_files.items():
        shutil.copyfile(path, merged / name)

    candidates = custom_car_candidates(custom_root)
    emit_progress("Checking custom cars", f"{len(candidates)} car{'s' if len(candidates) != 1 else ''} discovered")
    index = recursive_file_index(custom_root)
    original_ids = {
        name[3:-4]
        for name in original_files
        if name.startswith("CAR") and name.endswith(".RES") and len(name) == 11
    }
    used_ids = set(original_ids)
    loaded: list[dict[str, object]] = []
    skipped: list[dict[str, str]] = []

    for car_file in candidates:
        car_id = car_file.stem[3:].upper()
        relative = str(car_file.relative_to(custom_root))
        emit_progress("Validating custom car", f"{car_id} · {relative}")
        if car_id in used_ids:
            skipped.append({"id": car_id, "file": relative, "reason": "duplicate car ID"})
            continue
        try:
            files = resolve_custom_car_files(car_file, custom_root, index)
            validate_custom_car(car_id, files)
        except Exception as error:
            skipped.append({"id": car_id, "file": relative, "reason": str(error)})
            continue

        shutil.copyfile(files["car"], merged / f"CAR{car_id}.RES")
        for role in ["model", "dash", "gear"]:
            shutil.copyfile(files[role], merged / files[role].name.upper())
        used_ids.add(car_id)
        emit_progress("Custom car ready", car_id)
        loaded.append({
            "id": car_id,
            "folder": str(car_file.parent.relative_to(custom_root)),
            "graphics": [files[role].name for role in ["model", "dash", "gear"]],
        })

    return {
        "original": len(original_ids),
        "discovered": len(candidates),
        "loaded": loaded,
        "skipped": skipped,
    }


def merge_custom_tracks(custom_root: Path, merged: Path) -> dict[str, object]:
    """Add valid external tracks without replacing supplied or earlier files."""
    candidates = custom_track_candidates(custom_root)
    emit_progress("Scanning custom tracks", f"{len(candidates)} track{'s' if len(candidates) != 1 else ''} discovered")
    used_names = {path.name.upper() for path in merged.iterdir() if path.is_file()}
    loaded: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []

    for track_file in candidates:
        relative = str(track_file.relative_to(custom_root))
        emit_progress("Adding custom track", relative)
        name = track_file.name.upper()
        data = track_file.read_bytes()
        if len(data) < STUNTS_TRACK_BYTES or len(data) > 13802:
            skipped.append({
                "file": relative,
                "reason": f"invalid Stunts/Bliss track length ({len(data)} bytes; expected 1802..13802)",
            })
            continue
        if name in used_names:
            skipped.append({"file": relative, "reason": f"duplicate track filename: {name}"})
            continue

        # Runtime/gameplay uses the canonical Stunts payload. Preserve any Bliss
        # metadata tail only in the physical Custom Tracks file.
        (merged / name).write_bytes(data[:STUNTS_TRACK_BYTES])
        used_names.add(name)
        loaded.append({"file": relative, "name": name})

    return {"discovered": len(candidates), "loaded": loaded, "skipped": skipped}


def car_graphics_path(source: Path, stem: str, packed_extension: str, raw_extension: str) -> Path:
    packed = source / f"{stem}.{packed_extension}"
    if packed.is_file():
        return packed
    raw = source / f"{stem}.{raw_extension}"
    if raw.is_file():
        return raw
    raise FileNotFoundError(f"Missing {stem}.{packed_extension} or {stem}.{raw_extension}")


def extract_car_models(source: Path, output: Path) -> None:
    """Extract both packed P3S and uncompressed 3SH model banks."""
    output.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {}
    for car_file in sorted(source.glob("CAR*.RES")):
        car = car_file.stem[3:].upper()
        emit_progress("Extracting 3D car model", car)
        path = car_graphics_path(source, f"ST{car}", "P3S", "3SH")
        packed = path.read_bytes()
        blob = graphics_blob(path)
        entries = resources(blob)
        required = ["car0", "car1", "car2", "exp0", "exp1", "exp2", "exp3"]
        if not all(name in entries for name in required):
            raise ValueError(f"{path.name} is not a complete Stunts car model bank")
        (output / f"{car.lower()}.bin").write_bytes(blob)
        manifest[car] = {
            "source": path.name,
            "packedSha256": desktop.digest(packed),
            "sha256": desktop.digest(blob),
            "bytes": len(blob),
            "shapes": list(entries),
        }
    (output / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")))


def extract_cockpits(source: Path, output: Path) -> None:
    """Desktop cockpit extractor with PVS/VSH fallback for community cars."""
    palette = resources(unpack((source / "SDMAIN.PVS").read_bytes()))["!pal"][16:]
    palette = [min(255, value * 4) for value in palette]
    index: dict[str, object] = {}
    for carfile in sorted(source.glob("CAR*.RES")):
        car = carfile.stem[3:].upper()
        emit_progress("Preparing cockpit", car)
        frames: dict[str, dict[str, object]] = {}
        hashes: dict[str, str] = {}
        directory = output / car
        directory.mkdir(parents=True, exist_ok=True)
        for prefix in ["STDA", "STDB"]:
            path = car_graphics_path(source, f"{prefix}{car}", "PVS", "VSH")
            data = path.read_bytes()
            hashes[path.name] = desktop.digest(data)
            for name, frame in resources(graphics_blob(path)).items():
                if name.startswith("!"):
                    continue
                width, height = struct.unpack_from("<HH", frame)
                x, y = struct.unpack_from("<hh", frame, 8)
                if len(frame) != 16 + width * height:
                    raise ValueError(f"Invalid cockpit frame: {path.name}/{name}")
                image = Image.frombytes("P", (width, height), shape_pixels(frame))
                image.putpalette(palette)
                filename = name.strip() + ".png"
                image.convert("RGBA").save(directory / filename)
                frames[name] = {"file": filename, "width": width, "height": height, "x": x, "y": y, "source": path.name}
        if "dash" not in frames:
            raise ValueError(f"Missing dashboard for {car}")
        dash = frames["dash"]
        dashboard_top = int(dash["y"])
        composite = Image.new("RGBA", (320, 200 - dashboard_top), (0, 0, 0, 0))
        for name in ["dash", "gbox", "whl1"]:
            if name not in frames:
                continue
            frame = frames[name]
            with Image.open(directory / str(frame["file"])) as image:
                composite.paste(image, (int(frame["x"]), int(frame["y"]) - dashboard_top))
        composite.save(directory / "dashboard.png")
        index[car] = {"sourceSHA256": hashes, "frames": frames, "dashboardTop": dashboard_top}
    output.mkdir(parents=True, exist_ok=True)
    (output / "index.json").write_text(json.dumps(index, indent=2))


def extract_instrument_panel(source: Path, target: Path, car: str) -> None:
    """Generate panel metadata from packed or raw custom dashboard resources."""
    dash_path = car_graphics_path(source, f"STDA{car}", "PVS", "VSH")
    raw = dash_path.read_bytes()
    frames = resources(graphics_blob(dash_path))
    palette_raw = (source / "SDMAIN.PVS").read_bytes()

    def layer(name: str, selected=None) -> dict[str, object]:
        selected = frames if selected is None else selected
        blob = selected[name]
        width, height = struct.unpack_from("<HH", blob)
        x, y = struct.unpack_from("<hh", blob, 8)
        anchor_x, anchor_y = struct.unpack_from("<hh", blob, 4)
        if len(blob) != 16 + width * height:
            raise ValueError(f"Invalid cockpit layer {car}/{name}")
        return {"x": x, "y": y, "width": width, "height": height, "anchorX": anchor_x, "anchorY": anchor_y, "pixels": list(shape_pixels(blob))}

    def optional_layer(name: str) -> dict[str, object]:
        if name in frames:
            return layer(name)
        # Missing side overlays are legal in Stunts. A zero-sized layer is a
        # true no-op for the palette AND/OR compositor used by the runtime.
        return {"x": 0, "y": 0, "width": 0, "height": 0, "anchorX": 0, "anchorY": 0, "pixels": []}

    data: dict[str, object] = {
        "source": dash_path.name,
        "sha256": desktop.digest(raw),
        "paletteSource": "SDMAIN.PVS",
        "paletteSHA256": desktop.digest(palette_raw),
        "palette": [min(255, value * 4) for value in resources(unpack(palette_raw))["!pal"][16:]],
        "layers": {
            "ins2": layer("ins2"),
            "inm1": optional_layer("inm1"),
            "ins1": optional_layer("ins1"),
            "inm3": optional_layer("inm3"),
            "ins3": optional_layer("ins3"),
        },
    }
    gear_path = car_graphics_path(source, f"STDB{car}", "PVS", "VSH")
    gear_raw = gear_path.read_bytes()
    gear = resources(graphics_blob(gear_path))
    data["gear"] = {"source": gear_path.name, "sha256": desktop.digest(gear_raw), "base": layer("gbox"), "mask": layer("gnab", gear), "art": layer("gnob", gear)}
    car_raw = (source / f"CAR{car}.RES").read_bytes()
    simulation = resources(car_raw)["simd"]
    data["marker"] = {"source": f"CAR{car}.RES", "sha256": desktop.digest(car_raw), "points": [list(simulation[i:i + 2]) for i in range(234, 296, 2)], "mask": layer("dota", gear), "art": layer("dot ", gear)}
    if "dast" in frames and "dasm" in frames:
        data["extension"] = {"mask": layer("dasm"), "art": layer("dast")}
    if all(f"dig{i}" in gear for i in range(10)):
        data["digits"] = [layer(f"dig{i}", gear) for i in range(10)]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, separators=(",", ":")))


def copy_high_res_assets(source: Path, output: Path) -> dict[str, object]:
    """Mirror user-supplied High Res files beneath /game/hires in the runtime."""
    copied: list[str] = []
    if not source.is_dir():
        return {"files": copied}
    target_root = output / "game" / "hires"
    for path in sorted((item for item in source.rglob("*") if item.is_file()), key=lambda item: str(item.relative_to(source)).casefold()):
        relative = path.relative_to(source)
        target = target_root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        copied.append(relative.as_posix())
    return {"files": copied}


def prepare(original: Path, custom_root: Path, output: Path) -> dict[str, object]:
    original = original.resolve()
    custom_root = custom_root.resolve()
    custom_tracks_root = custom_root.parent / "Custom Tracks"
    high_res_root = custom_root.parent / "High Res"
    if not original.is_dir():
        raise ValueError(f"Gamedata directory does not exist: {original}")

    emit_progress("Preparing game files", "Scanning Gamedata and custom content")
    desktop.report_progress = emit_progress
    with tempfile.TemporaryDirectory(prefix="playstuntsdx-custom-content-") as temporary:
        temporary_root = Path(temporary)
        expanded_custom = temporary_root / "custom-cars"
        archive_report = materialize_custom_car_source(custom_root, expanded_custom)
        merged = temporary_root / "merged"
        custom_car_report = merge_custom_cars(original, expanded_custom, merged)
        custom_car_report["archives"] = archive_report
        custom_track_report = merge_custom_tracks(custom_tracks_root, merged)
        desktop.copy_verified = copy_portable_assets
        desktop.extract_car_models = extract_car_models
        desktop.extract_cockpits = extract_cockpits
        desktop.extract_instrument_panel = extract_instrument_panel
        emit_progress("Building runtime", "Creating native and enhanced game assets")
        report = desktop.prepare(merged, output)

    report["customCars"] = custom_car_report
    report["customTracks"] = custom_track_report
    report["highRes"] = copy_high_res_assets(high_res_root, output)
    manifest = output / "desktop-preparation.json"
    manifest.write_text(json.dumps(report, indent=2) + "\n")
    emit_progress("Runtime ready", f"{len(custom_car_report['loaded'])} custom cars · {len(custom_track_report['loaded'])} custom tracks")
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
    high_res_root = custom_root.parent / "High Res"
    try:
        custom_root.mkdir(parents=True, exist_ok=True)
        custom_tracks_root.mkdir(parents=True, exist_ok=True)
        (high_res_root / "cockpit").mkdir(parents=True, exist_ok=True)
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