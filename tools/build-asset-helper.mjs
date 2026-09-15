import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const venv = path.join(root, '.venv-portable');
const venvPython = path.join(venv, 'Scripts', 'python.exe');
const noCfgMarker = path.join(venv, '.pyinstaller-no-cfg-v3');
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

function visualStudioX64Environment() {
  const programFilesX86 = process.env['ProgramFiles(x86)'];
  if (!programFilesX86) throw new Error('ProgramFiles(x86) is unavailable; cannot locate Visual Studio.');
  const vswhere = path.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  if (!existsSync(vswhere)) throw new Error(`Visual Studio locator was not found: ${vswhere}`);

  const located = spawnSync(
    vswhere,
    ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'],
    { cwd: root, encoding: 'utf8', shell: false },
  );
  if (located.error) throw located.error;
  if (located.status !== 0 || !located.stdout.trim()) {
    throw new Error('Visual Studio with the Desktop C++ x64 tools was not found.');
  }

  const installation = located.stdout.trim().split(/\r?\n/).at(-1).trim();
  const devCmd = path.join(installation, 'Common7', 'Tools', 'VsDevCmd.bat');
  if (!existsSync(devCmd)) throw new Error(`Visual Studio developer environment was not found: ${devCmd}`);

  // Capture a fresh x64 developer environment instead of inheriting LIB/INCLUDE
  // from the shell that launched npm. A mixed x86 SDK environment can compile
  // x64 objects successfully and then fail only at link time with LNK4272.
  const command = `call "${devCmd}" -no_logo -arch=x64 -host_arch=x64 >nul && set`;
  const configured = spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env },
  });
  if (configured.error) throw configured.error;
  if (configured.status !== 0) throw new Error(`VsDevCmd.bat exited with code ${configured.status}`);

  const env = { ...process.env };
  for (const raw of configured.stdout.split(/\r?\n/)) {
    const equals = raw.indexOf('=');
    if (equals <= 0) continue;
    env[raw.slice(0, equals)] = raw.slice(equals + 1);
  }

  const lib = env.LIB ?? '';
  if (/\\um\\x86(?:\\|;|$)/i.test(lib) && !/\\um\\x64(?:\\|;|$)/i.test(lib)) {
    throw new Error(`Visual Studio x64 environment still contains only x86 Windows SDK libraries: ${lib}`);
  }
  console.log(`Using Visual Studio x64 environment: ${installation}`);
  return env;
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
  // v5 builds the no-CFG x64 bootloader inside a clean Visual Studio x64
  // developer environment so Windows SDK/CRT libraries cannot be mixed with x86.
  hash.update('playstuntsdx-portable-helper-v5-vs-x64-no-cfg\0');
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
  console.log('Building a 64-bit PyInstaller bootloader without Control Flow Guard for Unicorn...');
  const msvcEnv = visualStudioX64Environment();
  run(
    venvPython,
    ['-m', 'pip', 'install', '--disable-pip-version-check', '--force-reinstall', '--no-binary=pyinstaller', 'PyInstaller>=6,<7'],
    {
      env: {
        ...msvcEnv,
        PYINSTALLER_COMPILE_BOOTLOADER: '1',
        PYINSTALLER_BOOTLOADER_WAF_ARGS: '--target-arch=64bit --no-cfg',
      },
    },
  );
  writeFileSync(noCfgMarker, 'PyInstaller Windows x64 bootloader compiled with --target-arch=64bit --no-cfg in VsDevCmd x64 environment\n');
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
