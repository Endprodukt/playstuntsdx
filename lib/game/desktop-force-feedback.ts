import {
  applyForceFeedbackIni,
  forceFeedbackDrivingActive,
  forceFeedbackMenuDurationMs,
  sampleForceFeedback,
  triggerForceFeedbackMenuPulse,
} from '../physics/force-feedback';
import type { DesktopWheelInputState } from './desktop-wheel-input';

type TauriGlobal = {
  core?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
};

type NativeConfigFile = {
  content: string;
  path: string;
  created: boolean;
};

const enabledKey = 'playstunts-dx-force-feedback-enabled';
const strengthKey = 'playstunts-dx-force-feedback-strength';
const sendIntervalMs = 15;

let uiInstalled = false;
let menuFeedbackInstalled = false;
let focusRecoveryInstalled = false;
let pending = false;
let resendAfterPending = false;
let lastSend = 0;
let latestForce = 0;
let latestSteering = 0;
let ffbActive = false;
let lastStatus = 0;
let lastMenuPulseRequest = 0;
let menuPulseInterval: number | undefined;
let lastMenuNavigation = 0;
let statusElement: HTMLSpanElement | undefined;
let configPathElement: HTMLDivElement | undefined;
let configLoaded = false;
let configLoading = false;
let configPath = '';
let configCreated = false;
let configError = '';
let unloadInstalled = false;

function tauriCore() {
  if (typeof window === 'undefined') return undefined;
  return (window as typeof window & { __TAURI__?: TauriGlobal }).__TAURI__?.core;
}

function enabled() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(enabledKey) === 'true';
}

function strengthSetting() {
  if (typeof window === 'undefined') return 50;
  const saved = Number(window.localStorage.getItem(strengthKey) ?? '50');
  return Math.max(0, Math.min(100, Number.isFinite(saved) ? saved : 50));
}

function strength() {
  // The UI keeps its familiar 0-100 range, while the final output multiplier
  // is doubled internally: 50% = 1.0x and 100% = 2.0x the previous output.
  return strengthSetting() / 50;
}

function statusText() {
  if (!enabled()) return 'off';
  if (lastStatus > 0) return 'DirectInput ready';
  if (lastStatus < 0) return 'no FFB wheel';
  return 'initializing…';
}

function configText() {
  if (configError) return `config.ini: ${configError}`;
  if (configLoading) return 'config.ini: loading…';
  if (!configPath) return 'config.ini: desktop config not loaded yet';
  return `config.ini: ${configPath}${configCreated ? ' (created)' : ''}`;
}

function updateStatus() {
  if (statusElement) statusElement.textContent = statusText();
  if (configPathElement) configPathElement.textContent = configText();
}

async function reloadForceFeedbackConfig() {
  const core = tauriCore();
  if (!core || configLoading) return;
  configLoading = true;
  configError = '';
  updateStatus();
  try {
    const file = await core.invoke<NativeConfigFile>('native_force_feedback_config');
    applyForceFeedbackIni(file.content);
    configLoaded = true;
    configPath = file.path;
    configCreated = file.created;
    resampleAndSend(true, true);
  } catch (reason) {
    configError = reason instanceof Error ? reason.message : String(reason);
    console.warn('[FFB] Could not load config.ini:', reason);
  } finally {
    configLoading = false;
    updateStatus();
  }
}

function ensureForceFeedbackConfig() {
  if (!configLoaded && !configLoading) void reloadForceFeedbackConfig();
}

function installFocusRecovery() {
  if (focusRecoveryInstalled || typeof window === 'undefined' || typeof document === 'undefined') return;
  focusRecoveryInstalled = true;
  const recover = () => {
    if (enabled()) resampleAndSend(true, !forceFeedbackDrivingActive());
  };
  window.addEventListener('focus', recover);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) recover();
  });
}

function pulseMenuFeedback() {
  if (!enabled() || typeof window === 'undefined') return;
  const now = performance.now();
  if (now - lastMenuPulseRequest < 55) return;
  lastMenuPulseRequest = now;
  triggerForceFeedbackMenuPulse();

  if (menuPulseInterval !== undefined) window.clearInterval(menuPulseInterval);
  const startedAt = performance.now();
  const pump = () => {
    if (performance.now() - startedAt >= forceFeedbackMenuDurationMs() + 25) {
      if (menuPulseInterval !== undefined) window.clearInterval(menuPulseInterval);
      menuPulseInterval = undefined;
      resampleAndSend(true, true);
      return;
    }
    resampleAndSend(true, true);
  };
  pump();
  menuPulseInterval = window.setInterval(pump, 16);
}

function installMenuFeedback() {
  if (menuFeedbackInstalled || typeof document === 'undefined') return;
  menuFeedbackInstalled = true;

  const selector =
    'button,select,[role="menu"],[role="menuitem"],[role="listbox"],[role="option"],[tabindex]:not([tabindex="-1"]),input[type="range"],input[type="radio"],input[type="checkbox"]';
  const isNativeMenuCanvas = (target: EventTarget | null) =>
    target instanceof HTMLCanvasElement && !forceFeedbackDrivingActive();
  const isMenuControl = (target: EventTarget | null) =>
    (target instanceof Element && !!target.closest(selector)) || isNativeMenuCanvas(target);
  const eventIsOnMenuControl = (target: EventTarget | null) =>
    isMenuControl(target) || isMenuControl(document.activeElement);

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        enabled() &&
        !event.repeat &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code) &&
        eventIsOnMenuControl(event.target)
      ) {
        pulseMenuFeedback();
      }
    },
    true,
  );
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (enabled() && isNativeMenuCanvas(event.target)) pulseMenuFeedback();
    },
    true,
  );
  document.addEventListener(
    'focusin',
    (event) => {
      if (enabled() && isMenuControl(event.target)) pulseMenuFeedback();
    },
    true,
  );
  document.addEventListener(
    'input',
    (event) => {
      if (enabled() && isMenuControl(event.target)) pulseMenuFeedback();
    },
    true,
  );
  document.addEventListener(
    'change',
    (event) => {
      if (enabled() && isMenuControl(event.target)) pulseMenuFeedback();
    },
    true,
  );
}

function updateWheelMenuFeedback(input: DesktopWheelInputState) {
  if (
    !enabled() ||
    !input.configured ||
    !input.connected ||
    forceFeedbackDrivingActive()
  ) {
    lastMenuNavigation = 0;
    return;
  }

  const horizontal = input.steering < -0.18 ? -1 : input.steering > 0.18 ? 1 : 0;
  const vertical = input.throttle > 0.12 ? 2 : input.brake > 0.12 ? -2 : 0;
  const navigation = vertical || horizontal;

  if (!navigation) {
    lastMenuNavigation = 0;
    return;
  }

  // A menu detent belongs to the transition into a new direction, not to the
  // amount of time that direction is held. Returning to centre arms the next tick.
  if (navigation !== lastMenuNavigation) pulseMenuFeedback();
  lastMenuNavigation = navigation;
}

function installSettingsUi() {
  if (uiInstalled || typeof document === 'undefined') return;
  installMenuFeedback();
  const toggle = Array.from(document.querySelectorAll('button'))
    .find(button => button.textContent?.includes('Wheel Setup [F8]'));
  const panel = toggle?.parentElement?.querySelector<HTMLDivElement>('div');
  if (!panel) return;

  uiInstalled = true;
  const section = document.createElement('div');
  section.style.cssText = 'margin-top:12px;padding:12px;background:#181818;border:1px solid #444;border-radius:6px;';

  const row = document.createElement('label');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;font-weight:700;cursor:pointer;';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = enabled();
  const title = document.createElement('span');
  title.textContent = 'Force Feedback';
  statusElement = document.createElement('span');
  statusElement.style.cssText = 'margin-left:auto;color:#aaa;font-weight:400;';
  row.append(checkbox, title, statusElement);

  const strengthRow = document.createElement('label');
  strengthRow.style.cssText = 'display:grid;grid-template-columns:90px 1fr 48px;align-items:center;gap:8px;margin-top:10px;';
  const strengthLabel = document.createElement('span');
  strengthLabel.textContent = 'Strength';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.value = String(Math.round(strengthSetting()));
  const value = document.createElement('span');
  value.style.textAlign = 'right';
  value.textContent = `${slider.value}%`;
  strengthRow.append(strengthLabel, slider, value);

  const note = document.createElement('div');
  note.textContent = 'Physics FFB: steering, slide counter-steer, grass, landings, crashes, gear shifts and RPM engine vibration.';
  note.style.cssText = 'margin-top:8px;color:#aaa;font-size:12px;';

  const configRow = document.createElement('div');
  configRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;';
  const reloadButton = document.createElement('button');
  reloadButton.type = 'button';
  reloadButton.textContent = 'Reload config.ini';
  reloadButton.style.cssText = 'padding:5px 9px;border:1px solid #555;border-radius:4px;background:#252525;color:#eee;cursor:pointer;';
  configRow.append(reloadButton);

  configPathElement = document.createElement('div');
  configPathElement.style.cssText = 'margin-top:6px;color:#888;font-size:11px;overflow-wrap:anywhere;';

  checkbox.addEventListener('change', () => {
    window.localStorage.setItem(enabledKey, String(checkbox.checked));
    if (checkbox.checked) resampleAndSend(true, true);
    else void sendForce(0, true);
    updateStatus();
  });
  slider.addEventListener('input', () => {
    window.localStorage.setItem(strengthKey, slider.value);
    value.textContent = `${slider.value}%`;
    resampleAndSend(true, true);
  });
  reloadButton.addEventListener('click', () => {
    configCreated = false;
    void reloadForceFeedbackConfig();
  });

  section.append(row, strengthRow, note, configRow, configPathElement);
  panel.append(section);
  updateStatus();
}

async function sendForce(force: number, immediate = false) {
  const core = tauriCore();
  if (!core) return;
  if (pending) {
    if (immediate) resendAfterPending = true;
    return;
  }
  const now = performance.now();
  if (!immediate && now - lastSend < sendIntervalMs) return;
  lastSend = now;
  pending = true;
  try {
    lastStatus = await core.invoke<number>('native_set_force_feedback', { force });
  } catch (reason) {
    lastStatus = -1;
    console.warn('[FFB] Native force update failed:', reason);
  } finally {
    pending = false;
    updateStatus();
    if (resendAfterPending) {
      resendAfterPending = false;
      void sendForce(latestForce, true);
    }
  }
}

function resampleAndSend(immediate = false, allowIdle = false) {
  latestForce = enabled() && (ffbActive || allowIdle)
    ? -sampleForceFeedback(latestSteering) * strength()
    : 0;
  void sendForce(latestForce, immediate);
}

export function updateDesktopForceFeedback(input: DesktopWheelInputState) {
  if (typeof window === 'undefined') return;
  ensureForceFeedbackConfig();
  installSettingsUi();
  installFocusRecovery();
  updateWheelMenuFeedback(input);

  if (!unloadInstalled) {
    unloadInstalled = true;
    window.addEventListener('beforeunload', () => {
      const core = tauriCore();
      if (core) void core.invoke<void>('native_stop_force_feedback').catch(() => {});
    });
  }

  latestSteering = input.steering;
  ffbActive = input.configured && input.connected;
  resampleAndSend();
}

export function stopDesktopForceFeedback() {
  latestForce = 0;
  ffbActive = false;
  lastMenuNavigation = 0;
  if (menuPulseInterval !== undefined && typeof window !== 'undefined') {
    window.clearInterval(menuPulseInterval);
    menuPulseInterval = undefined;
  }
  const core = tauriCore();
  if (core) void core.invoke<void>('native_stop_force_feedback').catch(() => {});
}
