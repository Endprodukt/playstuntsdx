import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import OpeningSequence from '../app/OpeningSequence';
import { loadBrowserSetupSelection } from '../lib/game/browser-setup-selection';
import { nativeLaunchProfile } from '../lib/game/native-launch-profile';
import type { Assets } from '../lib/game/types';
import '../app/globals.css';
import './desktop.css';

type DesktopLaunch = ReturnType<typeof nativeLaunchProfile> & {
  directory: string;
  track?: number[];
};

type DesktopSoundDevice = 'off' | 'pc-speaker' | 'tandy' | 'adlib' | 'sound-blaster' | 'mt32';
const soundKey = 'playstunts-dx-sound-device';
const soundDevices = new Set<DesktopSoundDevice>(['off', 'pc-speaker', 'tandy', 'adlib', 'sound-blaster', 'mt32']);

type TauriGlobal = {
  core?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
};

function desktopSoundDevice(): DesktopSoundDevice {
  const saved = window.localStorage.getItem(soundKey) as DesktopSoundDevice | null;
  return saved && soundDevices.has(saved) ? saved : 'sound-blaster';
}

function DesktopApp() {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [launch, setLaunch] = useState<DesktopLaunch | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch('/game/assets.json', { signal: controller.signal });
        if (!response.ok) throw new Error('PlayStunts DX game assets could not be loaded.');
        const loadedAssets = (await response.json()) as Assets;
        const saved = await loadBrowserSetupSelection(controller.signal);
        if (controller.signal.aborted) return;
        const profile = nativeLaunchProfile(saved.selection);
        setAssets(loadedAssets);
        setLaunch({ ...profile, directory: saved.directory, track: saved.track });
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let toggling = false;

    async function toggleFullscreen() {
      const tauri = (window as typeof window & { __TAURI__?: TauriGlobal }).__TAURI__;
      if (!tauri?.core || toggling) return;
      toggling = true;
      try {
        await tauri.core.invoke<boolean>('toggle_fullscreen');
      } catch (reason) {
        console.error('PlayStunts DX fullscreen toggle failed:', reason);
      } finally {
        toggling = false;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const fullscreenKey = event.key === 'F11' || (event.altKey && event.key === 'Enter');
      if (!fullscreenKey || event.repeat) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      void toggleFullscreen();
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // PlayStunts DX defaults to the enhanced renderer. The hidden toolbar still
  // owns the shared graphics state used by the renderer and the in-game option,
  // so enable that same state once the game UI has mounted instead of creating
  // a second desktop-only graphics flag.
  useEffect(() => {
    if (!assets || !launch) return;
    let frame = 0;
    let attempts = 0;
    const enableEnhancedGraphics = () => {
      const toggle = document.querySelector<HTMLButtonElement>(
        '.desktop-game-shell .game-toolbar button[aria-pressed]'
      );
      if (toggle) {
        if (toggle.getAttribute('aria-pressed') !== 'true') toggle.click();
        return;
      }
      if (attempts++ < 120) frame = requestAnimationFrame(enableEnhancedGraphics);
    };
    frame = requestAnimationFrame(enableEnhancedGraphics);
    return () => cancelAnimationFrame(frame);
  }, [assets, launch]);

  if (error) return <div className="desktop-message desktop-error" role="alert">{error}</div>;
  if (!assets || !launch) return <div className="desktop-message" role="status">Loading PlayStunts DX…</div>;

  const selectedSound = desktopSoundDevice();
  const soundDevice = selectedSound === 'mt32'
    ? 'mt32'
    : selectedSound === 'tandy'
      ? 'tandy'
      : selectedSound === 'pc-speaker'
        ? 'pc-speaker'
        : undefined;

  return (
    <main className="desktop-game-shell">
      <OpeningSequence
        assets={assets}
        onBack={() => window.location.reload()}
        embedded
        autoStart
        soundDevice={soundDevice}
        displayMode={launch.displayMode}
        initiallyMuted={selectedSound === 'off'}
        hercules={launch.hercules}
        directory={launch.directory}
        initialTrack={launch.track}
      />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Desktop root element is missing');
createRoot(root).render(<DesktopApp />);
