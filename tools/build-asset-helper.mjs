import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const venv = path.join(root, '.venv-portable');
const venvPython = path.join(venv, 'Scripts', 'python.exe');
const noCfgMarker = path.join(venv, '.pyinstaller-no-cfg-v1');
const generated = path.join(root, 'src-tauri', 'generated');
const helper = path.join(generated, 'playstuntsdx-prepare.exe');
const stamp = path.join(generated, 'playstuntsdx-prepare.sha256');
const work = path.join(root, 'build', 'asset-helper');
const force = process.argv.includes('--force');

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

function collectFiles(directory, predicate) {
  const result = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) result.push(...collectFiles(absolute, predicate));
    else if (predicate(absolute)) result.push(absolute);
  }
  return result;
}

function helperInputHash() {
  const files = [
    ...collectFiles(path.join(root, 'tools'), file => file.endsWith('.py')),
    path.join(root, 'tools', 'requirements.txt'),
    path.join(root, 'tools', 'requirements-build.txt'),
    path.join(root, 'tools', 'credits-layout-recipe.json'),
    path.join(root, 'tools', 'resource-selections.json'),
    path.join(root, 'docs', 'direct-asset-recipes.json'),
    path.join(root, 'docs', 'original-file-checksums.json'),
  ].sort();
  const hash = createHash('sha256');
  // Bump this whenever the freezing strategy changes. v3 uses a PyInstaller
  // bootloader compiled without Control Flow Guard because Unicorn's JIT is
  // incompatible with the stock CFG-enabled Windows bootloader.
  hash.update('playstuntsdx-portable-helper-v3-no-cfg\0');
  for (const file of files) {
    hash.update(path.relative(root, file).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

if (process.platform !== 'win32') {
  throw new Error('The embedded PlayStunts DX asset helper must be built on Windows.');
}

const inputHash = helperInputHash();
if (!force && existsSync(helper) && existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === inputHash) {
  console.log('Embedded asset helper unchanged; reusing cached build.');
  process.exit(0);
}

if (!existsSync(venvPython)) {
  const python = findPython();
  run(python.command, [...python.prefix, '-m', 'venv', venv]);
}

run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', 'tools/requirements.txt', '-r', 'tools/requirements-build.txt']);

if (!existsSync(noCfgMarker)) {
  console.log('Building a PyInstaller bootloader without Control Flow Guard for Unicorn...');
  run(
    venvPython,
    ['-m', 'pip', 'install', '--disable-pip-version-check', '--force-reinstall', '--no-binary=pyinstaller', 'PyInstaller>=6,<7'],
    {
      env: {
        ...process.env,
        PYINSTALLER_COMPILE_BOOTLOADER: '1',
        PYINSTALLER_BOOTLOADER_WAF_ARGS: '--no-cfg',
      },
    },
  );
  writeFileSync(noCfgMarker, 'PyInstaller Windows bootloader compiled with --no-cfg\n');
}

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

// Do not merely import Unicorn: execute generated x86 code. This catches the
// Windows CFG fast-fail that otherwise only appears on the user's first launch.
run(helper, ['--self-test-unicorn']);
writeFileSync(stamp, `${inputHash}\n`);

console.log(`Embedded asset helper ready: ${helper}`);
