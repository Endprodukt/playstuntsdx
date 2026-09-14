import { sampleForceFeedback } from '../physics/force-feedback';
import type { DesktopWheelInputState } from './desktop-wheel-input';

type TauriGlobal = {
  core?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
};

const enabledKey = 'playstunts-dx-force-feedback-enabled';
const strengthKey = 'playstunts-dx-force-feedback-strength';
const sendIntervalMs = 15;

let uiInstalled = false;
let pending = false;
let lastSend = 0;
let latestForce = 0;
let lastStatus = 0;
let statusElement: HTMLSpanElement | undefined;
let unloadInstalled = false;

function tauriCore() {
  if (typeof window === 'undefined') return undefined;
  return (window as typeof window & { __TAURI__?: TauriGlobal }).__TAURI__?.core;
}

function enabled() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(enabledKey) === 'true';
}

function strength() {
  if (typeof window === 'undefined') return 0.5;
  const saved = Number(window.localStorage.getItem(strengthKey) ?? '50');
  return Math.max(0, Math.min(1, Number.isFinite(saved) ? saved / 100 : 0.5));
}

function statusText() {
  if (!enabled()) return 'off';
  if (lastStatus > 0) return 'DirectInput ready';
  if (lastStatus < 0) return 'no FFB wheel';
  return 'initializing…';
}

function updateStatus() {
  if (statusElement) statusElement.textContent = statusText();
}

function installSettingsUi() {
  if (uiInstalled || typeof document === 'undefined') return;
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
  slider.value = String(Math.round(strength() * 100));
  const value = document.createElement('span');
  value.style.textAlign = 'right';
  value.textContent = `${slider.value}%`;
  strengthRow.append(strengthLabel, slider, value);

  const note = document.createElement('div');
  note.textContent = 'Physics FFB: self-aligning steering, slide counter-steer and per-wheel grass vibration.';
  note.style.cssText = 'margin-top:8px;color:#aaa;font-size:12px;';

  checkbox.addEventListener('change', () => {
    window.localStorage.setItem(enabledKey, String(checkbox.checked));
    if (!checkbox.checked) void sendForce(0, true);
    updateStatus();
  });
  slider.addEventListener('input', () => {
    window.localStorage.setItem(strengthKey, slider.value);
    value.textContent = `${slider.value}%`;
  });

  section.append(row, strengthRow, note);
  panel.append(section);
  updateStatus();
}

async function sendForce(force: number, immediate = false) {
  const core = tauriCore();
  if (!core || pending) return;
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
  }
}

export function updateDesktopForceFeedback(input: DesktopWheelInputState) {
  if (typeof window === 'undefined') return;
  installSettingsUi();

  if (!unloadInstalled) {
    unloadInstalled = true;
    window.addEventListener('beforeunload', () => {
      const core = tauriCore();
      if (core) void core.invoke<void>('native_stop_force_feedback').catch(() => {});
    });
  }

  const active = enabled() && input.configured && input.connected;
  // DirectInput's wheel-axis polarity is opposite to the normalized physics
  // convention used by sampleForceFeedback(), so invert once at this boundary.
  latestForce = active ? -sampleForceFeedback(input.steering) * strength() : 0;
  void sendForce(latestForce);
}

export function stopDesktopForceFeedback() {
  latestForce = 0;
  const core = tauriCore();
  if (core) void core.invoke<void>('native_stop_force_feedback').catch(() => {});
}
