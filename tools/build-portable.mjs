import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(root, 'release', 'PlayStunts DX');
const targetDir = path.join(root, 'src-tauri', 'target', 'release');
const executable = [
  path.join(targetDir, 'playstuntsdx.exe'),
  path.join(targetDir, 'PlayStunts DX.exe'),
].find(existsSync);

function iniEntries(content) {
  const entries = [];
  let section = '';
  for (const raw of content.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    const equals = line.indexOf('=');
    if (!section || equals < 1) continue;
    entries.push([section, line.slice(0, equals).trim(), line.slice(equals + 1).trim()]);
  }
  return entries;
}

function iniEntryKey(section, key) {
  return `${section.trim().toLowerCase()}\0${key.trim().toLowerCase()}`;
}

function setIniValue(content, section, key, value) {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  let current = '';
  let sectionStart = -1;
  let sectionEnd = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      if (sectionStart >= 0 && sectionEnd === lines.length) sectionEnd = index;
      current = sectionMatch[1].trim();
      if (current.toLowerCase() === section.toLowerCase() && sectionStart < 0) sectionStart = index;
      continue;
    }
    if (current.toLowerCase() !== section.toLowerCase()) continue;
    const equals = line.indexOf('=');
    if (equals < 1 || line.slice(0, equals).trim().toLowerCase() !== key.toLowerCase()) continue;
    lines[index] = `${key}=${value}`;
    return lines.join(newline);
  }
  if (sectionStart >= 0) {
    lines.splice(sectionEnd, 0, `${key}=${value}`);
  } else {
    if (lines.length && lines.at(-1)?.trim()) lines.push('');
    lines.push(`[${section}]`, `${key}=${value}`);
  }
  return lines.join(newline);
}

if (process.platform !== 'win32') {
  throw new Error('The PlayStunts DX portable package must be assembled on Windows.');
}
if (!executable) {
  throw new Error(`Release executable not found in ${targetDir}. Run npm run desktop:build first.`);
}

// Keep portable user data between local rebuilds. Runtime is generated data and
// is deliberately rebuilt so changes to the asset preparation code take effect.
mkdirSync(releaseDir, { recursive: true });
rmSync(path.join(releaseDir, 'Runtime'), { recursive: true, force: true });
rmSync(path.join(releaseDir, 'prepare-runtime.log'), { force: true });
copyFileSync(executable, path.join(releaseDir, 'PlayStunts DX.exe'));

for (const directory of ['Gamedata', 'Custom Cars', 'High Res', 'mt32']) {
  mkdirSync(path.join(releaseDir, directory), { recursive: true });
}

const defaultConfig = path.join(root, 'src-tauri', 'config.default.ini');
const config = path.join(releaseDir, 'config.ini');
if (!existsSync(config)) {
  copyFileSync(defaultConfig, config);
}

// ffb.ini was used by early desktop builds. Preserve the user's tuning once,
// merge it into the unified config.ini, then remove the obsolete second INI.
const legacyFfb = path.join(releaseDir, 'ffb.ini');
if (existsSync(legacyFfb)) {
  let content = readFileSync(config, 'utf8');
  for (const [section, key, value] of iniEntries(readFileSync(legacyFfb, 'utf8'))) {
    content = setIniValue(content, section, key, value);
  }
  writeFileSync(config, content.endsWith('\n') ? content : `${content}\n`);
  rmSync(legacyFfb, { force: true });
  console.log('Migrated legacy ffb.ini settings into config.ini.');
}

// Keep user-edited values, but add every setting introduced by newer builds.
// This makes an old portable folder self-updating without replacing its INI.
{
  let content = readFileSync(config, 'utf8');
  const existing = new Set(iniEntries(content).map(([section, key]) => iniEntryKey(section, key)));
  let added = 0;
  for (const [section, key, value] of iniEntries(readFileSync(defaultConfig, 'utf8'))) {
    if (existing.has(iniEntryKey(section, key))) continue;
    content = setIniValue(content, section, key, value);
    existing.add(iniEntryKey(section, key));
    added += 1;
  }
  if (added) {
    writeFileSync(config, content.endsWith('\n') ? content : `${content}\n`);
    console.log(`Added ${added} new config.ini setting${added === 1 ? '' : 's'} without changing existing values.`);
  }
}

console.log('');
console.log('Portable build ready:');
console.log(releaseDir);
console.log('');
console.log('Put the original Stunts files in Gamedata before launching the portable build.');
console.log('Optional custom cars can be placed in Custom Cars directly or in nested subfolders.');
console.log('Desktop, control and force-feedback settings are stored in config.ini.');
