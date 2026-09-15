import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(root, 'release', 'PlayStunts DX');
const targetDir = path.join(root, 'src-tauri', 'target', 'release');
const executable = [
  path.join(targetDir, 'playstuntsdx.exe'),
  path.join(targetDir, 'PlayStunts DX.exe'),
].find(existsSync);

if (process.platform !== 'win32') {
  throw new Error('The PlayStunts DX portable package must be assembled on Windows.');
}
if (!executable) {
  throw new Error(`Release executable not found in ${targetDir}. Run npm run desktop:build first.`);
}

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });
copyFileSync(executable, path.join(releaseDir, 'PlayStunts DX.exe'));

for (const directory of ['Gamedata', 'Custom Cars', 'High Res', 'mt32']) {
  mkdirSync(path.join(releaseDir, directory), { recursive: true });
}

console.log('');
console.log('Portable build ready:');
console.log(releaseDir);
console.log('');
console.log('Put the original Stunts files in Gamedata before launching the portable build.');
console.log('Optional custom cars can be placed in Custom Cars directly or in nested subfolders.');
