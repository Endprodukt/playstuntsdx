import { cpSync, existsSync, rmSync } from 'node:fs';
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
      const source = code.replace(/\r\n?/g, '\n');

      if (normalized.endsWith('/app/OpeningSequenceRuntime.tsx')) {
        const importLine = "import introMaterials from '@/public/game/track-materials.json';\n";
        const musicImport = "import {createNativeMusic} from '@/lib/game/native-music';";
        const musicDeclaration = 'let music:Awaited<ReturnType<typeof createNativeMusic>>|undefined;';
        const musicBackend = "if(soundDevice==='mt32'){roland=await createBrowserNativeMt32Music(runAudio,demoAbort.signal,rolandPower);music=roland.music;}else music=await (soundDevice==='tandy'?createNativeTandyMusic(runAudio):soundDevice==='pc-speaker'?createNativePcSpeakerMusic(runAudio):createNativeMusic(runAudio));if(disposed){music.close();roland?.output.close();return;}";
        const introCall = 'createUpgradedIntro(renderer.memory,introMaterials)';
        const audioSetup = 'applyNativeStartupAudio(initiallyMuted,music.control);';
        const menuSetup = "menus=await createBrowserNativeMenus({settings:{mouse:false,joystick:false,graphics:0},graphics:graphics.current";
        if (![importLine, musicImport, musicDeclaration, musicBackend, introCall, audioSetup, menuSetup].every(value => source.includes(value))) {
          throw new Error('Desktop runtime adaptation is out of date for OpeningSequenceRuntime.tsx');
        }

        const remixImport = `${musicImport}\nimport {createSynchronizedRemixedMusic,decodeRemixedMusic} from '@/lib/game/remixed-music';`;
        const desktopMusicBackend = "const originalMusic=soundDevice==='mt32'?(roland=await createBrowserNativeMt32Music(runAudio,demoAbort.signal,rolandPower)).music:await (soundDevice==='tandy'?createNativeTandyMusic(runAudio):soundDevice==='pc-speaker'?createNativePcSpeakerMusic(runAudio):createNativeMusic(runAudio));const remixSetting=(window.localStorage.getItem('playstunts-dx-audio-update')??'true').trim().toLowerCase();const remixEnabled=!['0','false','no','off'].includes(remixSetting);music=createSynchronizedRemixedMusic(runAudio,originalMusic,await decodeRemixedMusic(runAudio),remixEnabled);if(disposed){music.close();roland?.output.close();return;}";
        const persistentAudio = `${audioSetup}\n   if(!initiallyMuted){\n    const disabled=(value:string|null)=>value!==null&&['0','false','off','no'].includes(value.toLowerCase());\n    if(disabled(window.localStorage.getItem('playstunts-dx-music-enabled')))music.control('toggle-music');\n    if(disabled(window.localStorage.getItem('playstunts-dx-sound-enabled')))music.control('toggle-sound');\n   }`;
        const persistentMenu = `const configuredInput=window.localStorage.getItem('playstunts-dx-input-device');\n   const configuredGraphics=Number(window.localStorage.getItem('playstunts-dx-original-graphics-level')??'0');\n   const desktopMenuSettings={\n    mouse:configuredInput==='mouse',\n    joystick:configuredInput==='joystick'||configuredInput==='wheel',\n    graphics:Number.isInteger(configuredGraphics)&&configuredGraphics>=0&&configuredGraphics<=2?configuredGraphics:0,\n   };\n   menus=await createBrowserNativeMenus({settings:desktopMenuSettings,graphics:graphics.current`;

        return source
          .replace(importLine, '')
          .replace(musicImport, remixImport)
          .replace(musicDeclaration, 'let music:ReturnType<typeof createSynchronizedRemixedMusic>|undefined;')
          .replace(musicBackend, desktopMusicBackend)
          .replace("json<{palette:number[]}>('track-materials')", "json<{palette:number[];indices:number[]}>('track-materials')")
          .replace(introCall, 'createUpgradedIntro(renderer.memory,materials)')
          .replace(audioSetup, persistentAudio)
          .replace(menuSetup, persistentMenu);
      }

      if (normalized.endsWith('/lib/game/browser-native-menus-core.ts')) {
        const importLine = "import showroomMaterials from '../../public/game/track-materials.json';\n";
        const showroomCall = 'createUpgradedCarMenu(palette,showroomMaterials.indices)';
        const hiresMenuError = 'highResMainMenu.onerror=()=>{highResMainMenuReady=false;};';
        const hiresMenuSource = 'highResMainMenu.src=HIRES_MAIN_MENU;';
        if (![importLine, showroomCall, hiresMenuError, hiresMenuSource].every(value => source.includes(value))) {
          throw new Error('Desktop runtime adaptation is out of date for browser-native-menus-core.ts');
        }
        const upstreamMenuFallback = "let upstreamMainMenuFallback=false;highResMainMenu.onerror=()=>{highResMainMenuReady=false;if(!upstreamMainMenuFallback){upstreamMainMenuFallback=true;highResMainMenu.src='/site/enhanced-artwork/SDMSEL-scrn-menu-v1.png';}};";
        const runtimeHiresMenu = "void fetch(HIRES_MAIN_MENU).then(response=>{if(!response.ok)throw Error('High-resolution main menu could not load');return response.blob();}).then(blob=>{highResMainMenu.src=URL.createObjectURL(blob);}).catch(()=>{highResMainMenu.src=HIRES_MAIN_MENU;});";
        return source
          .replace(importLine, '')
          .replace("json<{palette:number[]}>('track-materials')", "json<{palette:number[];indices:number[]}>('track-materials')")
          .replace(showroomCall, 'createUpgradedCarMenu(palette,materials.indices)')
          .replace(hiresMenuError, upstreamMenuFallback)
          .replace(hiresMenuSource, runtimeHiresMenu);
      }

      if (normalized.endsWith('/lib/game/browser-mt32-output.ts')) {
        const browserBootstrap = "script.src='/game/mt32-local/bootstrap.mjs?v='+bridgeVersion";
        if (!source.includes(browserBootstrap)) {
          throw new Error('Desktop runtime adaptation is out of date for browser-mt32-output.ts');
        }
        return source.replace(browserBootstrap, "script.src='/mt32-local/bootstrap.mjs?v='+bridgeVersion");
      }

      if (normalized.endsWith('/lib/game/native-options-runtime.ts')) {
        const audioControl = 'else reply=await host.audio(value.type);';
        const actionClose = '   }}finally{retained?.close();}\n  }';
        const immediateReload = 'window.setTimeout(()=>window.location.reload(),0);';
        if (![audioControl, actionClose, immediateReload].every(value => source.includes(value))) {
          throw new Error('Desktop runtime adaptation is out of date for native-options-runtime.ts');
        }
        return source
          .replace(
            audioControl,
            "else {reply=await host.audio(value.type);if(desktopSoundDevice()){if(value.type==='toggle-music')window.localStorage.setItem('playstunts-dx-music-enabled',String(!!reply));else if(value.type==='toggle-sound')window.localStorage.setItem('playstunts-dx-sound-enabled',String(!!reply));}}",
          )
          .replace(
            actionClose,
            "   }}finally{retained?.close();}\n   if(name==='graphics'&&desktopSoundDevice())window.localStorage.setItem('playstunts-dx-original-graphics-level',String(host.settings.graphics));\n  }",
          )
          .replace(immediateReload, 'window.setTimeout(()=>window.location.reload(),120);');
      }

      return null;
    },
  };
}

function prepareDesktopStaticAssets(): Plugin {
  return {
    name: 'playstunts-dx-prepare-desktop-static-assets',
    closeBundle() {
      const muntSource = path.join(root, 'public', 'game', 'mt32-local');
      const muntTarget = path.join(root, 'dist-desktop', 'mt32-local');
      const bootstrap = path.join(muntSource, 'bootstrap.mjs');
      if (!existsSync(bootstrap)) {
        throw new Error(`Desktop MT-32 runtime is missing: ${bootstrap}. Generate the local Munt runtime before building the portable app.`);
      }

      rmSync(muntTarget, { recursive: true, force: true });
      cpSync(muntSource, muntTarget, {
        recursive: true,
        filter: source => !source.toLowerCase().endsWith('.rom'),
      });
      if (!existsSync(path.join(muntTarget, 'bootstrap.mjs'))) {
        throw new Error('Desktop MT-32 bootstrap was not copied into the application bundle.');
      }

      rmSync(path.join(root, 'dist-desktop', 'game'), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  root: path.join(root, 'desktop'),
  publicDir: path.join(root, 'public'),
  base: './',
  plugins: [desktopRuntimeAdaptation(), react(), prepareDesktopStaticAssets()],
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