import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import OpeningSequence from '../app/OpeningSequence';
import { loadBrowserSetupSelection } from '../lib/game/browser-setup-selection';
import { nativeLaunchProfile } from '../lib/game/native-launch-profile';
import type { BrowserMt32Power, BrowserNativeMt32Device } from '../lib/game/browser-native-mt32-music';
import type { Assets } from '../lib/game/types';
import Mt32Window from './Mt32Window';
import { installDesktopDriveControls } from './gamepad-drive';
import { ensureDesktopRuntimeStartup } from './runtime-startup';
import {
  MT32_CHANNEL, createMt32Snapshot, createMt32SoundCatalog,
  type Mt32Command, type Mt32HostDevice,
} from './mt32-channel';
import '../app/globals.css';
import './desktop.css';

type DesktopLaunch = ReturnType<typeof nativeLaunchProfile> & {
  directory: string;
  track?: number[];
};

type DesktopSoundDevice = 'off' | 'pc-speaker' | 'tandy' | 'adlib' | 'sound-blaster' | 'mt32';
const soundKey = 'playstunts-dx-sound-device';
const graphicsKey = 'playstunts-dx-enhanced-graphics';
const soundDevices = new Set<DesktopSoundDevice>(['off', 'pc-speaker', 'tandy', 'adlib', 'sound-blaster', 'mt32']);

type TauriGlobal = {
  core?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
};

function tauriCore() {
  return (window as typeof window & { __TAURI__?: TauriGlobal }).__TAURI__?.core;
}

function desktopSoundDevice(): DesktopSoundDevice {
  const saved = window.localStorage.getItem(soundKey) as DesktopSoundDevice | null;
  return saved && soundDevices.has(saved) ? saved : 'sound-blaster';
}

function desktopEnhancedGraphics() {
  const saved = window.localStorage.getItem(graphicsKey);
  return saved === null ? true : saved !== 'false';
}

function exitGame() {
  const core = tauriCore();
  if (!core) {
    window.close();
    return;
  }
  void core.invoke<void>('exit_game')
    .catch(reason => console.error('PlayStunts DX exit failed:', reason));
}

function DesktopApp() {
  const selectedSound = desktopSoundDevice();
  const [gamedataReady, setGamedataReady] = useState<boolean | null>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [launch, setLaunch] = useState<DesktopLaunch | null>(null);
  const [error, setError] = useState('');
  const [rolandDevice, setRolandDevice] = useState<BrowserNativeMt32Device>();
  const [rolandPower, setRolandPower] = useState<BrowserMt32Power>();

  useEffect(() => installDesktopDriveControls(), []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const core = tauriCore();
        if (core) {
          const ready = await core.invoke<boolean>('check_gamedata');
          if (controller.signal.aborted) return;
          setGamedataReady(ready);
          if (!ready) return;
          await ensureDesktopRuntimeStartup(core);
          if (controller.signal.aborted) return;
        } else {
          setGamedataReady(true);
        }

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
    let togglingFullscreen = false;
    let togglingMt32 = false;

    async function invokeBoolean(command: string) {
      const core = tauriCore();
      if (!core) return;
      await core.invoke<boolean>(command);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      const fullscreenKey = event.key === 'F11' || (event.altKey && event.key === 'Enter');
      if (fullscreenKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (togglingFullscreen) return;
        togglingFullscreen = true;
        void invokeBoolean('toggle_fullscreen')
          .catch(reason => console.error('PlayStunts DX fullscreen toggle failed:', reason))
          .finally(() => { togglingFullscreen = false; });
        return;
      }
      // F12 is the normal MT-32 front-panel shortcut. Keep F10 as a fallback
      // for development environments where WebView2 may reserve F12 itself.
      if ((event.key === 'F12' || event.key === 'F10') && selectedSound === 'mt32') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (togglingMt32) return;
        togglingMt32 = true;
        void invokeBoolean('toggle_mt32_panel')
          .catch(reason => console.error('PlayStunts DX MT-32 panel toggle failed:', reason))
          .finally(() => { togglingMt32 = false; });
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [selectedSound]);

  useEffect(() => {
    if (selectedSound !== 'mt32' || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(MT32_CHANNEL);
    const device = rolandDevice as Mt32HostDevice | undefined;
    const sounds = createMt32SoundCatalog(device);
    const publish = () => channel.postMessage({
      kind: 'state',
      state: createMt32Snapshot(device, !!rolandPower?.starting, sounds),
    });
    channel.onmessage = event => {
      const message = event.data as { kind?: string; command?: Mt32Command };
      if (message.kind !== 'command' || !message.command) return;
      const command = message.command;
      if (command.type === 'request') { publish(); return; }
      if (command.type === 'power') {
        if (!rolandPower) return;
        if (rolandPower.device || rolandPower.starting) rolandPower.powerOff();
        else void rolandPower.powerOn().catch(reason => console.error('Roland MT-32 power-on failed:', reason));
        return;
      }
      if (!device) return;
      if (command.type === 'reset-controllers') device.resetControllers();
      else if (command.type === 'set-unit') device.setUnitID(command.value);
      else if (command.type === 'panel-write') device.panelWrite(command.writes);
      else if (command.type === 'write') device.write(command.writes);
      else if (command.type === 'main-display') device.mainDisplay();
      else if (command.type === 'set') device.set(command.id, command.value);
      publish();
    };
    publish();
    const timer = window.setInterval(publish, 100);
    return () => { window.clearInterval(timer); channel.close(); };
  }, [selectedSound, rolandDevice, rolandPower]);

  // The hidden toolbar owns the same enhanced-graphics state as the in-game
  // switch. Apply config.ini once it exists, then mirror later changes back to
  // the same config through the localStorage bridge installed before startup.
  useEffect(() => {
    if (!assets || !launch) return;
    let frame = 0;
    let attempts = 0;
    let observer: MutationObserver | undefined;
    const configureEnhancedGraphics = () => {
      const toggle = document.querySelector<HTMLButtonElement>(
        '.desktop-game-shell .game-toolbar button[aria-pressed]'
      );
      if (toggle) {
        const desired = desktopEnhancedGraphics();
        observer = new MutationObserver(() => {
          window.localStorage.setItem(graphicsKey, String(toggle.getAttribute('aria-pressed') === 'true'));
        });
        observer.observe(toggle, { attributes: true, attributeFilter: ['aria-pressed'] });
        if ((toggle.getAttribute('aria-pressed') === 'true') !== desired) toggle.click();
        else window.localStorage.setItem(graphicsKey, String(desired));
        return;
      }
      if (attempts++ < 120) frame = requestAnimationFrame(configureEnhancedGraphics);
    };
    frame = requestAnimationFrame(configureEnhancedGraphics);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [assets, launch]);

  if (gamedataReady === false) {
    return (
      <div className="desktop-message desktop-gamedata-message" role="status">
        <div>
          <strong>Original game data not found</strong>
          <span>Copy your complete Stunts game files into the Gamedata folder next to PlayStunts DX.exe, then restart.</span>
        </div>
      </div>
    );
  }
  if (error) return <div className="desktop-message desktop-error" role="alert">{error}</div>;
  if (gamedataReady === null || !assets || !launch) return <div className="desktop-message" role="status">Loading PlayStunts DX…</div>;

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
        onBack={exitGame}
        embedded
        autoStart
        soundDevice={soundDevice}
        displayMode={launch.displayMode}
        initiallyMuted={selectedSound === 'off'}
        hercules={launch.hercules}
        directory={launch.directory}
        initialTrack={launch.track}
        onRolandDevice={selectedSound === 'mt32' ? setRolandDevice : undefined}
        onRolandPower={selectedSound === 'mt32' ? setRolandPower : undefined}
      />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Desktop root element is missing');
const desktopWindow=(window as typeof window&{__PLAYSTUNTS_DX_WINDOW__?:string}).__PLAYSTUNTS_DX_WINDOW__;
createRoot(root).render(desktopWindow==='mt32' ? <Mt32Window /> : <DesktopApp />);
