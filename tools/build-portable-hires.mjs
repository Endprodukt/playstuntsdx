import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateLegacyHires, removeEmptyLegacyHires, seedHires } from './seed-hires.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(root, 'release', 'PlayStunts DX');

migrateLegacyHires(releaseDir);
const normalLog = console.log.bind(console);
console.log = (...args) => {
  if (args.length === 1 && typeof args[0] === 'string' && args[0].startsWith('High-resolution replacements go in High Res')) return;
  normalLog(...args);
};
try {
  await import('./build-portable.mjs');
} finally {
  console.log = normalLog;
}
removeEmptyLegacyHires(releaseDir);
seedHires(releaseDir);
normalLog('High-resolution replacements are stored in hires and are never overwritten when customized.');
