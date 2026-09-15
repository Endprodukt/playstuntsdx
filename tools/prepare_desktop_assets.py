"""Prepare PlayStunts DX desktop runtime assets from a user-supplied Stunts install.

This entrypoint is designed to be frozen into the Windows application build.
It never downloads, modifies, or redistributes the user's original game files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
import sys
import tempfile
from pathlib import Path

from PIL import Image

from extract import extract, resources, shape, shape_pixels, unpack
from extract_auxiliary_assets import generate as auxiliary_assets
from extract_editor_catalogs import generate as editor_catalogs
from extract_menu_assets import convert_frame, generate as menu_assets
from extract_music_seeds import generate as music_seeds
from extract_scene_catalogs import generate as scene_catalogs
from extract_setup import extract as setup_text
from extract_static_tables import generate as static_tables
from unpack_executables import assemble, unpack_exe


def bundled_file(name: str) -> Path:
    roots = []
    frozen = getattr(sys, "_MEIPASS", None)
    if frozen:
        roots.append(Path(frozen))
    roots.extend([Path(__file__).resolve().parent, Path(__file__).resolve().parents[1] / "docs"])
    for root in roots:
        candidate = root / name
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"Bundled preparation data is missing: {name}")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_files(source: Path) -> dict[str, Path]:
    result: dict[str, Path] = {}
    for file in source.iterdir():
        if not file.is_file():
            continue
        key = file.name.upper()
        if key in result:
            raise ValueError(f"Duplicate case-insensitive filename: {key}")
        result[key] = file
    return result


def copy_verified(files: dict[str, Path], output: Path) -> list[str]:
    recipes = json.loads(bundled_file("direct-asset-recipes.json").read_text())
    missing: list[str] = []
    for row in recipes:
        name = row["source"].upper()
        file = files.get(name)
        if file is None:
            missing.append(name)
            continue
        data = file.read_bytes()
        if digest(data) != row["sha256"]:
            raise ValueError(f"Unsupported reference file checksum: {name}")
        relative = Path(row["path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Invalid runtime output path")
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return sorted(set(missing))


def build_unpacked(source: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    for mode in ["MCGA", "EGA", "CGA", "TDY"]:
        (output / f"{mode}-unpacked.bin").write_bytes(unpack_exe(assemble(source, mode)))
    (output / "setup-unpacked.bin").write_bytes(unpack_exe((source / "SETUP.EXE").read_bytes(), 0x1000))


def extract_cockpits(source: Path, output: Path) -> None:
    palette = resources(unpack((source / "SDMAIN.PVS").read_bytes()))["!pal"][16:]
    palette = [min(255, value * 4) for value in palette]
    index: dict[str, object] = {}
    for carfile in sorted(source.glob("CAR*.RES")):
        car = carfile.stem[3:]
        frames: dict[str, dict[str, object]] = {}
        hashes: dict[str, str] = {}
        directory = output / car
        directory.mkdir(parents=True, exist_ok=True)
        for prefix in ["STDA", "STDB"]:
            path = source / f"{prefix}{car}.PVS"
            data = path.read_bytes()
            hashes[path.name] = digest(data)
            for name, frame in resources(unpack(data)).items():
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
                frames[name] = {
                    "file": filename, "width": width, "height": height,
                    "x": x, "y": y, "source": path.name,
                }
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


def extract_crash(source: Path, output: Path) -> None:
    raw = (source / "GAME.PRE").read_bytes()
    data = resources(unpack(raw))
    info = list(struct.unpack("<" + "h" * (len(data["cinf"]) // 2), data["cinf"]))
    if not info or info[0] != len(info) - 1:
        raise ValueError("Invalid windshield animation metadata")
    lines = [list(line) for line in struct.iter_unpack("<4h", data["crak"])]
    if not all(0 <= count <= len(lines) for count in info[1:]):
        raise ValueError("Invalid windshield animation frame")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"source": "GAME.PRE", "sha256": digest(raw), "lines": lines, "frames": info[1:]}, separators=(",", ":")))


def extract_gauges(source: Path, output: Path) -> None:
    result: dict[str, object] = {}
    for path in sorted(source.glob("CAR*.RES")):
        raw = path.read_bytes()
        simulation = resources(raw)["simd"]

        def gauge(offset: int, capacity: int) -> dict[str, object]:
            x, y, count = struct.unpack_from("<hhh", simulation, offset)
            if count < 0 or count > capacity:
                raise ValueError("Invalid original gauge table")
            return {"center": [x, y], "points": [list(simulation[offset + 6 + 2 * i:offset + 8 + 2 * i]) for i in range(count)]}

        result[path.stem[3:]] = {"source": path.name, "sha256": digest(raw), "speed": gauge(296, 104), "rpm": gauge(510, 128)}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, separators=(",", ":")) + "\n")


def extract_car_models(source: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {}
    for path in sorted(source.glob("ST*.P3S")):
        packed = path.read_bytes()
        blob = unpack(packed)
        entries = resources(blob)
        if not all(name in entries for name in ["car0", "car1", "car2", "exp0", "exp1", "exp2", "exp3"]):
            continue
        car = path.stem[2:]
        (output / f"{car.lower()}.bin").write_bytes(blob)
        manifest[car] = {
            "source": path.name, "packedSha256": digest(packed), "sha256": digest(blob),
            "bytes": len(blob), "shapes": list(entries),
        }
    if len(manifest) != 11:
        raise ValueError(f"Expected 11 original car model banks, found {len(manifest)}")
    (output / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")))


def extract_instrument_panel(source: Path, target: Path, car: str) -> None:
    raw = (source / f"STDA{car}.PVS").read_bytes()
    frames = resources(unpack(raw))
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

    data: dict[str, object] = {
        "source": f"STDA{car}.PVS", "sha256": digest(raw), "paletteSource": "SDMAIN.PVS",
        "paletteSHA256": digest(palette_raw),
        "palette": [min(255, value * 4) for value in resources(unpack(palette_raw))["!pal"][16:]],
        "layers": {name: layer(name) for name in ["ins2", "inm1", "ins1", "inm3", "ins3"]},
    }
    gear_raw = (source / f"STDB{car}.PVS").read_bytes()
    gear = resources(unpack(gear_raw))
    data["gear"] = {"source": f"STDB{car}.PVS", "sha256": digest(gear_raw), "base": layer("gbox"), "mask": layer("gnab", gear), "art": layer("gnob", gear)}
    car_raw = (source / f"CAR{car}.RES").read_bytes()
    simulation = resources(car_raw)["simd"]
    data["marker"] = {"source": f"CAR{car}.RES", "sha256": digest(car_raw), "points": [list(simulation[i:i + 2]) for i in range(234, 296, 2)], "mask": layer("dota", gear), "art": layer("dot ", gear)}
    if "dast" in frames:
        data["extension"] = {"mask": layer("dasm"), "art": layer("dast")}
    if "dig0" in gear:
        data["digits"] = [layer(f"dig{i}", gear) for i in range(10)]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, separators=(",", ":")))


def presentation_core(source: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)

    def save(name: str, data: object) -> None:
        (output / f"{name}.json").write_text(json.dumps(data, separators=(",", ":")) + "\n")

    raw = (source / "TITLE.P3S").read_bytes()
    save("intro-shapes", {
        "source": "TITLE.P3S", "sha256": digest(raw),
        "resources": {key: {"sha256": digest(value), "bytes": list(value), "shape": shape(value)} for key, value in resources(unpack(raw)).items() if key in ["brav", "logo", "log2"]},
    })
    menu_frame = bytes(convert_frame(resources(unpack((source / "SDMSEL.PVS").read_bytes()))["scrn"]))
    (output / "main-menu-art.bin").write_bytes(menu_frame)
    voice_raw = (source / "ADENG1.VCE").read_bytes()
    count = struct.unpack_from("<H", voice_raw, 4)[0]
    base = 6 + 8 * count
    voices = {}
    for i in range(count):
        key = voice_raw[6 + 4 * i:10 + 4 * i].decode("ascii")
        offset = struct.unpack_from("<I", voice_raw, 6 + 4 * count + 4 * i)[0]
        voices[key] = list(voice_raw[base + offset:base + offset + 100])
    save("adlib-voices", {"source": "ADENG1.VCE", "sha256": digest(voice_raw), "voices": voices})
    text = resources((source / "CRED.RES").read_bytes())
    recipe = json.loads(bundled_file("credits-layout-recipe.json").read_text())
    rows = []
    for row in recipe:
        item = {key: value for key, value in row.items() if key != "resource"}
        item["text"] = text[row["resource"]].rstrip(b"\0").decode("ascii")
        rows.append(item)
    save("credits-layout", {"source": "original 2F62..353E and CRED.RES; palette words retained from loaded executable", "text": rows})


def make_manifests(source_files_map: dict[str, Path], game: Path) -> None:
    scores = game / "high-scores"
    scores.mkdir(exist_ok=True)
    score_manifest = {}
    for file in sorted(scores.glob("*.HIG")):
        score_manifest[file.stem] = {"file": file.name, "sha256": digest(file.read_bytes())}
    (scores / "manifest.json").write_text(json.dumps(score_manifest, separators=(",", ":")))

    media = game / "setup-media"
    media.mkdir(exist_ok=True)
    entries = []
    for name, file in sorted(source_files_map.items()):
        data = file.read_bytes()
        (media / name).write_bytes(data)
        entries.append({"name": name, "url": "/game/setup-media/" + name, "bytes": len(data), "sha256": digest(data), "dosDateTime": [1990, 12, 13, 0, 0, 0]})
    (media / "manifest.json").write_text(json.dumps({"files": entries}, separators=(",", ":")))

    originals = game / "original-resources"
    originals.mkdir(exist_ok=True)
    manifest = {}
    for file in sorted(originals.iterdir()):
        if file.is_file():
            data = file.read_bytes()
            manifest[file.name] = {"file": file.name, "bytes": len(data), "sha256": digest(data)}
    (originals / "manifest.json").write_text(json.dumps({"files": manifest}, indent=2) + "\n")


def prepare(source: Path, output: Path) -> dict[str, object]:
    source = source.resolve()
    output = output.resolve()
    if not source.is_dir():
        raise ValueError(f"Gamedata directory does not exist: {source}")
    files = source_files(source)
    if output.exists():
        raise ValueError(f"Runtime output already exists: {output}")

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="playstuntsdx-runtime-", dir=output.parent) as temporary:
        staging = Path(temporary)
        normalized = staging / "original"
        normalized.mkdir()
        for name, file in files.items():
            shutil.copyfile(file, normalized / name)

        runtime = staging / "Runtime"
        runtime.mkdir()
        missing = copy_verified(files, runtime)
        decoded = staging / "decoded"
        extract(normalized, decoded)
        game = runtime / "game"
        game.mkdir(exist_ok=True)
        shutil.copyfile(decoded / "assets.json", game / "assets.json")

        extract_cockpits(normalized, game / "cockpit")
        extract_crash(normalized, game / "cockpit" / "crash.json")
        extract_gauges(normalized, game / "cockpit" / "gauges.json")
        extract_car_models(normalized, game / "car-models")
        for car_file in sorted(normalized.glob("CAR*.RES")):
            car = car_file.stem[3:]
            extract_instrument_panel(normalized, game / "cockpit" / car / "panel.json", car)

        unpacked = staging / "unpacked"
        build_unpacked(normalized, unpacked)
        static_tables(unpacked, game)
        menu_assets(normalized, unpacked, game)
        auxiliary_assets(normalized, unpacked, game)
        scene_catalogs(normalized, unpacked, game)
        editor_catalogs(normalized, unpacked, game)
        presentation_core(normalized, game)
        (game / "setup-reference.json").write_text(json.dumps(setup_text((normalized / "SETUP.EXE").read_bytes()), indent=2) + "\n")
        music_seeds(normalized, unpacked, game)
        make_manifests(files, game)

        report = {
            "complete": True,
            "startupPending": True,
            "missingOptionalReferenceInputs": missing,
            "sourceFiles": len(files),
            "sourceSignature": digest(b"".join(digest(files[name].read_bytes()).encode("ascii") for name in sorted(files))),
        }
        (runtime / "desktop-preparation.json").write_text(json.dumps(report, indent=2) + "\n")
        shutil.move(str(runtime), str(output))
        return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        report = prepare(args.original, args.output)
        print(json.dumps(report, separators=(",", ":")))
        return 0
    except Exception as error:
        print(f"PlayStunts DX asset preparation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
