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

type TauriGlobal = {
  core?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
};

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

  if (error) return <div className="desktop-message desktop-error" role="alert">{error}</div>;
  if (!assets || !launch) return <div className="desktop-message" role="status">Loading PlayStunts DX…</div>;

  // Until PlayStunts DX has its own MT-32 ROM setup dialog, do not let a saved
  // browser MT-32 selection prevent the desktop game from starting. The normal
  // native AdLib path remains fully functional without proprietary ROM files.
  const soundDevice = launch.soundDevice === 'mt32' ? undefined : launch.soundDevice;

  return (
    <main className="desktop-game-shell">
      <OpeningSequence
        assets={assets}
        onBack={() => window.location.reload()}
        embedded
        autoStart
        soundDevice={soundDevice}
        displayMode={launch.displayMode}
        initiallyMuted={launch.initiallyMuted}
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
