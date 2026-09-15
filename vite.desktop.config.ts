import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Desktop-only source adaptation. The shared web sources intentionally keep
 * their browser behavior, while the portable build gets its original assets
 * from Runtime and its persistent user settings from config.ini/localStorage.
 */
function desktopRuntimeAdaptation(): Plugin {
  return {
    name: 'playstunts-dx-desktop-runtime-adaptation',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/');

      if (normalized.endsWith('/app/OpeningSequence.tsx')) {
        const importLine = "import introMaterials from '@/public/game/track-materials.json';\n";
        const introCall = 'createUpgradedIntro(renderer.memory,introMaterials)';
        const audioSetup = 'applyNativeStartupAudio(initiallyMuted,music.control);';
        const menuSetup = "menus=await createBrowserNativeMenus({settings:{mouse:false,joystick:false,graphics:0},graphics:graphics.current";
        if (![importLine, introCall, audioSetup, menuSetup].every(value => code.includes(value))) {
          throw new Error('Desktop runtime adaptation is out of date for OpeningSequence.tsx');
        }

        const persistentAudio = `${audioSetup}\n   if(!initiallyMuted){\n    const disabled=(value:string|null)=>value!==null&&['0','false','off','no'].includes(value.toLowerCase());\n    if(disabled(window.localStorage.getItem('playstunts-dx-music-enabled')))music.control('toggle-music');\n    if(disabled(window.localStorage.getItem('playstunts-dx-sound-enabled')))music.control('toggle-sound');\n   }`;
        const persistentMenu = `const configuredInput=window.localStorage.getItem('playstunts-dx-input-device');\n   const configuredGraphics=Number(window.localStorage.getItem('playstunts-dx-original-graphics-level')??'0');\n   const desktopMenuSettings={\n    mouse:configuredInput==='mouse',\n    joystick:configuredInput==='joystick'||configuredInput==='wheel',\n    graphics:Number.isInteger(configuredGraphics)&&configuredGraphics>=0&&configuredGraphics<=2?configuredGraphics:0,\n   };\n   menus=await createBrowserNativeMenus({settings:desktopMenuSettings,graphics:graphics.current`;

        return code
          .replace(importLine, '')
          .replace("json<{palette:number[]}>('track-materials')", "json<{palette:number[];indices:number[]}>('track-materials')")
          .replace(introCall, 'createUpgradedIntro(renderer.memory,materials)')
          .replace(audioSetup, persistentAudio)
          .replace(menuSetup, persistentMenu);
      }

      if (normalized.endsWith('/lib/game/browser-native-menus.ts')) {
        const importLine = "import showroomMaterials from '../../public/game/track-materials.json';\n";
        const showroomCall = 'createUpgradedCarMenu(palette,showroomMaterials.indices)';
        if (!code.includes(importLine) || !code.includes(showroomCall)) {
          throw new Error('Desktop runtime adaptation is out of date for browser-native-menus.ts');
        }
        return code
          .replace(importLine, '')
          .replace("json<{palette:number[]}>('track-materials')", "json<{palette:number[];indices:number[]}>('track-materials')")
          .replace(showroomCall, 'createUpgradedCarMenu(palette,materials.indices)');
      }

      if (normalized.endsWith('/lib/game/native-options-runtime.ts')) {
        const audioControl = 'else reply=await host.audio(value.type);';
        const actionClose = '   }}finally{retained?.close();}\n  }';
        if (!code.includes(audioControl) || !code.includes(actionClose)) {
          throw new Error('Desktop runtime adaptation is out of date for native-options-runtime.ts');
        }
        return code
          .replace(
            audioControl,
            "else {reply=await host.audio(value.type);if(desktopSoundDevice()){if(value.type==='toggle-music')window.localStorage.setItem('playstunts-dx-music-enabled',String(!!reply));else if(value.type==='toggle-sound')window.localStorage.setItem('playstunts-dx-sound-enabled',String(!!reply));}}",
          )
          .replace(
            actionClose,
            "   }}finally{retained?.close();}\n   if(name==='graphics'&&desktopSoundDevice())window.localStorage.setItem('playstunts-dx-original-graphics-level',String(host.settings.graphics));\n  }",
          );
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
  plugins: [desktopRuntimeAdaptation(), react(), stripPreparedGameAssets()],
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