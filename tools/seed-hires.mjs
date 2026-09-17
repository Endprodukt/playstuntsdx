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
const categories = ['menu', 'backgrounds', 'intro', 'cockpit'];

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

function copyTreeMissing(sourceRoot, targetRoot) {
  let copied = 0;
  if (!existsSync(sourceRoot)) return copied;
  for (const source of filesBelow(sourceRoot)) {
    const relative = path.relative(sourceRoot, source);
    if (copyMissing(source, path.join(targetRoot, relative))) copied += 1;
  }
  return copied;
}

function needsSeed(directory) {
  return !existsSync(directory) || filesBelow(directory).length === 0;
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
  const runtimeGame = path.join(targetRoot, 'Runtime', 'game');
  const seed = Object.fromEntries(categories.map(category => {
    const directory = path.join(hires, category);
    return [category, needsSeed(directory)];
  }));

  // Existing non-empty category folders are user-owned and never overwritten.
  // A deleted (or empty) category is reconstructed independently.
  for (const category of categories) {
    if (seed[category]) mkdirSync(path.join(hires, category), { recursive: true });
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
    const category = relative.split('/')[0];
    if (!seed[category]) continue;
    if (copyMissing(path.join(repoRoot, source), path.join(hires, relative))) copied += 1;
  }

  // Runtime is the fallback source. Cockpit deliberately comes from the final
  // Runtime/game/cockpit tree, after its nearest-neighbour reference pass.
  // For menu/intro/backgrounds the bundled enhanced art wins; Runtime only fills
  // a category if the enhanced seed could not provide anything.
  for (const category of categories) {
    if (!seed[category]) continue;
    const target = path.join(hires, category);
    const runtime = path.join(runtimeGame, category);
    if (category === 'cockpit' || filesBelow(target).length === 0) {
      copied += copyTreeMissing(runtime, target);
    }
  }

  // If neither the preferred source nor Runtime existed yet, do not leave an
  // empty placeholder behind: the next seed pass must try this category again.
  for (const category of categories) {
    if (!seed[category]) continue;
    const directory = path.join(hires, category);
    if (existsSync(directory) && filesBelow(directory).length === 0) {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  // Old builds mirrored user textures into Runtime. They are external now.
  rmSync(path.join(targetRoot, 'Runtime', 'game', 'hires'), { recursive: true, force: true });
  removeEmptyLegacyHires(targetRoot);
  const rebuilt = categories.filter(category => seed[category] && existsSync(path.join(hires, category)));
  console.log(`hires ready: ${copied} file${copied === 1 ? '' : 's'} seeded; rebuilt ${rebuilt.join(', ') || 'nothing'}.`);
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  const targetIndex = process.argv.indexOf('--target');
  const target = targetIndex >= 0 && process.argv[targetIndex + 1]
    ? path.resolve(repoRoot, process.argv[targetIndex + 1])
    : repoRoot;
  seedHires(target);
}
