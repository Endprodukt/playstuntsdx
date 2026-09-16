import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function filesBelow(directory) {
  if (!existsSync(directory)) return [];
  const result = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) result.push(...filesBelow(absolute));
    else result.push(absolute);
  }
  return result;
}

function copyMissing(source, target) {
  if (!existsSync(source) || existsSync(target)) return false;
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  return true;
}

export function migrateLegacyHires(targetRoot) {
  const legacy = path.join(targetRoot, 'High Res');
  const hires = path.join(targetRoot, 'hires');
  if (!existsSync(legacy)) return;
  if (!existsSync(hires)) {
    renameSync(legacy, hires);
    console.log('Migrated legacy "High Res" folder to "hires".');
  }
}

export function removeEmptyLegacyHires(targetRoot) {
  const legacy = path.join(targetRoot, 'High Res');
  if (existsSync(legacy) && filesBelow(legacy).length === 0) {
    rmSync(legacy, { recursive: true, force: true });
  }
}

export function seedHires(targetRoot = repoRoot) {
  migrateLegacyHires(targetRoot);
  const hires = path.join(targetRoot, 'hires');
  for (const directory of ['menu', 'backgrounds', 'intro', 'cockpit']) {
    mkdirSync(path.join(hires, directory), { recursive: true });
  }

  const standard = [
    ['public/site/enhanced-artwork/SDMSEL-scrn-menu-v1.png', 'menu/main-menu.png'],
    ['public/site/enhanced-artwork/SDTITL-prod-mindscape-v1.png', 'intro/mindscape.png'],
    ['public/site/enhanced-artwork/SDTITL-titl-title-v2.png', 'intro/title.png'],
    ['public/site/enhanced-backgrounds/desert.png', 'backgrounds/desert.png'],
    ['public/site/enhanced-backgrounds/tropical.png', 'backgrounds/tropical.png'],
    ['public/site/enhanced-backgrounds/city.png', 'backgrounds/city.png'],
    ['public/site/enhanced-backgrounds/country.png', 'backgrounds/country.png'],
    ['public/site/enhanced-backgrounds/alpine-scen.png', 'backgrounds/alpine-scen.png'],
    ['public/site/enhanced-backgrounds/alpine-sce2.png', 'backgrounds/alpine-sce2.png'],
    ['public/site/enhanced-backgrounds/alpine-sce3.png', 'backgrounds/alpine-sce3.png'],
    ['public/site/enhanced-backgrounds/alpine-sce4.png', 'backgrounds/alpine-sce4.png'],
    ['public/site/enhanced-backgrounds/desert-overview.png', 'backgrounds/desert-overview.png'],
    ['public/site/enhanced-backgrounds/tropical-overview.png', 'backgrounds/tropical-overview.png'],
    ['public/site/enhanced-backgrounds/alpine-overview.png', 'backgrounds/alpine-overview.png'],
    ['public/site/enhanced-backgrounds/city-overview.png', 'backgrounds/city-overview.png'],
    ['public/site/enhanced-backgrounds/country-overview.png', 'backgrounds/country-overview.png'],
  ];

  let copied = 0;
  for (const [source, relative] of standard) {
    if (copyMissing(path.join(repoRoot, source), path.join(hires, relative))) copied += 1;
  }

  const runtimeCockpits = path.join(targetRoot, 'Runtime', 'game', 'cockpit');
  if (existsSync(runtimeCockpits)) {
    for (const source of filesBelow(runtimeCockpits).filter(file => file.toLowerCase().endsWith('.png'))) {
      const relative = path.relative(runtimeCockpits, source);
      if (copyMissing(source, path.join(hires, 'cockpit', relative))) copied += 1;
    }
  }

  // Old builds mirrored user textures into Runtime. They are external now.
  rmSync(path.join(targetRoot, 'Runtime', 'game', 'hires'), { recursive: true, force: true });
  removeEmptyLegacyHires(targetRoot);
  console.log(`hires ready: ${copied} missing file${copied === 1 ? '' : 's'} added.`);
}

const direct = process.argv[1] && path.resolve(process.arvv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  const targetIndex = process.argv.indexOf('--target');
  const target = targetIndex >= 0 && process.argv[targetIndex + 1]
    ? path.resolve(repoRoot, process.arvv[targetIndex + 1])
    : repoRoot;
  seedHires(target);
}
