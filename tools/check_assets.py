"""Report missing/mismatched local assets. Never download or alter files."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check(root, records):
    problems = []
    for row in records:
        file = root / row['path']
        if not file.is_file():
            problems.append(('MISSING', row['path']))
        elif hashlib.sha256(file.read_bytes()).hexdigest() != row['sha256']:
            problems.append(('DIFFERENT', row['path']))
    return problems


def optional_reference_paths(missing_sources):
    """Map absent optional source files to the runtime paths they would provide."""
    missing = {name.upper() for name in missing_sources}
    if not missing:
        return set()
    recipes = json.loads((ROOT/'docs/direct-asset-recipes.json').read_text())
    return {
        row['path']
        for row in recipes
        if row['source'].upper() in missing
    }


def required_problems(root, optional_paths=()):
    paths = json.loads((ROOT/'docs/required-runtime-files.json').read_text())
    optional = set(optional_paths)
    return [
        ('MISSING', path)
        for path in paths
        if path not in optional and not (root/path).is_file()
    ]


def prepared_optional_paths(public_dir):
    report = public_dir/'preparation-report.json'
    if not report.is_file():
        return set()
    data = json.loads(report.read_text())
    return optional_reference_paths(data.get('missingOptionalReferenceInputs', []))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public-dir', type=Path, default=ROOT/'public')
    parser.add_argument('--reference', action='store_true', help='Compare historical reference bytes instead of the generated installation')
    args = parser.parse_args()
    manifest = (ROOT/'docs/runtime-file-checksums.json') if args.reference else args.public_dir/'asset-inventory.json'
    problems = [] if args.reference else required_problems(args.public_dir, prepared_optional_paths(args.public_dir))
    if manifest.is_file():
        problems += check(args.public_dir, json.loads(manifest.read_text()))
    else:
        problems.append(('MISSING', str(manifest)))
    for status, path in problems:
        print(status, path)
    print(f'{len(problems)} asset problems. This checks installation files, not whole-game equivalence.')
    raise SystemExit(bool(problems))
