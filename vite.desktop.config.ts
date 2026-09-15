import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * The web build historically imports track-materials.json from public/game.
 * A portable desktop build must never require or embed prepared original game
 * data from the developer checkout. Both desktop call sites already load the
 * same material table from /game at runtime, so point their upgraded renderers
 * at that runtime value before Vite resolves the legacy JSON imports.
 */
function desktopRuntimeMaterials(): Plugin {
  return {
    name: 'playstunts-dx-desktop-runtime-materials',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/');
      if (normalized.endsWith('/app/OpeningSequence.tsx')) {
        const importLine = "import introMaterials from '@/public/game/track-materials.json';\n";
        const introCall = 'createUpgradedIntro(renderer.memory,introMaterials)';
        if (!code.includes(importLine) || !code.includes(introCall)) {
          throw new Error('Desktop runtime-material transform is out of date for OpeningSequence.tsx');
        }
        return code
          .replace(importLine, '')
          .replace("json<{palette:number[]}>('track-materials')", "json<{palette:number[];indices:number[]}>('track-materials')")
          .replace(introCall, 'createUpgradedIntro(renderer.memory,materials)');
      }

      if (normalized.endsWith('/lib/game/browser-native-menus.ts')) {
        const importLine = "import showroomMaterials from '../../public/game/track-materials.json';\n";
        const showroomCall = 'createUpgradedCarMenu(palette,showroomMaterials.indices)';
        if (!code.includes(importLine) || !code.includes(showroomCall)) {
          throw new Error('Desktop runtime-material transform is out of date for browser-native-menus.ts');
        }
        return code
          .replace(importLine, '')
          .replace("json<{palette:number[]}>('track-materials')", "json<{palette:number[];indices:number[]}>('track-materials')")
          .replace(showroomCall, 'createUpgradedCarMenu(palette,materials.indices)');
      }

      return null;
    },
  };
}

/**
 * We still use public/ for legal site artwork shared with the desktop shell.
 * Vite would also copy a developer's locally prepared public/game directory,
 * though. Delete that directory from the desktop output unconditionally so the
 * Tauri executable can only obtain original Stunts-derived data from Gamedata
 * at first run.
 */
function stripPreparedGameAssets(): Plugin {
  return {
    name: 'playstunts-dx-strip-prepared-game-assets',
    closeBundle() {
      rmSync(path.join(root, 'dist-desktop', 'game'), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  root: path.join(root, 'desktop'),
  publicDir: path.join(root, 'public'),
  base: './',
  plugins: [desktopRuntimeMaterials(), react(), stripPreparedGameAssets()],
  resolve: {
    alias: {
      '@': root,
      'next/image': path.join(root, 'desktop/next-image.tsx'),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: {
      // Visual Studio keeps its search/index database locked while the IDE is
      // running. Vite must never try to watch those files on Windows.
      ignored: [
        '**/.vs/**',
        '**/.git/**',
        '**/.venv/**',
        '**/node_modules/**',
        '**/src-tauri/**',
        '**/dist-desktop/**',
      ],
    },
  },
  build: {
    outDir: path.join(root, 'dist-desktop'),
    emptyOutDir: true,
  },
});