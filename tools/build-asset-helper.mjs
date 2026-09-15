import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const venv = path.join(root, '.venv-portable');
const venvPython = path.join(venv, 'Scripts', 'python.exe');
const generated = path.join(root, 'src-tauri', 'generated');
const helper = path.join(generated, 'playstuntsdx-prepare.exe');
const work = path.join(root, 'build', 'asset-helper');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}`);
}

function findPython() {
  const candidates = process.env.PYTHON
    ? [[process.env.PYTHON, []]]
    : [['py', ['-3']], ['python', []], ['python3', []]];
  for (const [command, prefix] of candidates) {
    const result = spawnSync(command, [...prefix, '--version'], { cwd: root, stdio: 'ignore', shell: false });
    if (!result.error && result.status === 0) return { command, prefix };
  }
  throw new Error('Python 3 was not found. Install Python 3 and run the build again.');
}

if (process.platform !== 'win32') {
  throw new Error('The embedded PlayStunts DX asset helper must be built on Windows.');
}

if (!existsSync(venvPython)) {
  const python = findPython();
  run(python.command, [...python.prefix, '-m', 'venv', venv]);
}

run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', 'tools/requirements.txt', '-r', 'tools/requirements-build.txt']);

rmSync(generated, { recursive: true, force: true });
rmSync(work, { recursive: true, force: true });
mkdirSync(generated, { recursive: true });
mkdirSync(work, { recursive: true });

const addData = (source, target = '.') => `${path.join(root, source)}${path.delimiter}${target}`;
run(venvPython, [
  '-m', 'PyInstaller',
  '--noconfirm',
  '--clean',
  '--onefile',
  '--noupx',
  '--collect-all', 'unicorn',
  '--name', 'playstuntsdx-prepare',
  '--distpath', generated,
  '--workpath', path.join(work, 'work'),
  '--specpath', work,
  '--add-data', addData('docs/direct-asset-recipes.json'),
  '--add-data', addData('docs/original-file-checksums.json'),
  '--add-data', addData('tools/credits-layout-recipe.json'),
  '--add-data', addData('tools/resource-selections.json'),
  'tools/prepare_portable_assets.py',
]);

if (!existsSync(helper)) throw new Error(`Asset preparation helper was not created: ${helper}`);

// Importing the frozen helper also imports Unicorn. Run a cheap smoke test now so
// a missing native Unicorn DLL fails the build instead of the user's first launch.
run(helper, ['--help']);

console.log(`Embedded asset helper ready: ${helper}`);
