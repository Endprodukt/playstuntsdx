import {clearDesktopWheelInput,setDesktopWheelInput} from '../lib/game/desktop-wheel-input';
import {blissEditorActive} from '../lib/game/bliss-editor-presence';

type SetupStage =
  | 'idle'
  | 'steering-left'
  | 'steering-right'
  | 'throttle-rest'
  | 'throttle-full'
  | 'brake-rest'
  | 'brake-full'
  | 'done';
type DeviceSource = 'WebView2' | 'Windows';

type AxisBinding = {
  deviceId: string;
  deviceIndex: number;
  deviceSource?: DeviceSource;
  kind: 'axis';
  index: number;
  rest: number;
  active: number;
  direction: 1 | -1;
};

type SteeringBinding = {
  deviceId: string;
  deviceIndex: number;
  deviceSource?: DeviceSource;
  kind: 'axis';
  index: number;
  left: number;
  center: number;
  right: number;
};

type ButtonBinding = {
  deviceId: string;
  deviceIndex: number;
  deviceSource?: DeviceSource;
  kind: 'button';
  index: number;
};

type InputBinding = AxisBinding | ButtonBinding;
type AnyBinding = SteeringBinding | InputBinding;
type WheelBindings = {
  steering?: SteeringBinding;
  throttle?: InputBinding;
  brake?: InputBinding;
};

type InputDevice = {
  id: string;
  index: number;
  name: string;
  source: DeviceSource;
  axes: number[];
  buttons: number[];
  pov?: number | null;
};

type DeviceSnapshot = {
  axes: number[];
  buttons: number[];
};

type InputSnapshot = Map<string, DeviceSnapshot>;

type NativeJoystick = {
  id: string;
  name: string;
  axes: number[];
  buttons: number[];
  pov?: number | null;
};

type SetupUi = {
  root: HTMLDivElement;
  toggle: HTMLButtonElement;
  panel: HTMLDivElement;
  status: HTMLDivElement;
  bindings: HTMLDivElement;
  devices: HTMLDivElement;
  start: HTMLButtonElement;
  capture: HTMLButtonElement;
  clear: HTMLButtonElement;
  close: HTMLButtonElement;
};

type TauriGlobal = {
  core?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
};

const storageKey = 'playstunts-dx-wheel-bindings-v2';
const oldStorageKey = 'playstunts-dx-wheel-bindings-v1';
const axisCaptureThreshold = 0.42;
const buttonCaptureThreshold = 0.55;
const steeringDeadzoneStorageKey = 'playstunts-dx-steering-deadzone-percent';
const defaultSteeringDeadzonePercent = 4;

function steeringDeadzonePercent() {
  const saved = Number(window.localStorage.getItem(steeringDeadzoneStorageKey));
  return Number.isFinite(saved) ? Math.max(0, Math.min(15, saved)) : defaultSteeringDeadzonePercent;
}

function applySteeringDeadzone(value: number) {
  const deadzone = steeringDeadzonePercent() / 100;
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  if (deadzone >= 1) return 0;
  return Math.sign(value) * Math.min(1, (magnitude - deadzone) / (1 - deadzone));
}

let nativeDevices: InputDevice[] = [];

function browserDevices(): InputDevice[] {
  if (typeof navigator.getGamepads !== 'function') return [];
  return Array.from(navigator.getGamepads())
    .filter((gamepad): gamepad is Gamepad => !!gamepad?.connected)
    .map(gamepad => ({
      id: gamepad.id,
      index: gamepad.index,
      name: gamepad.id,
      source: 'WebView2' as const,
      axes: [...gamepad.axes],
      buttons: gamepad.buttons.map(button => button.value),
      pov: null,
    }));
}

function devices() {
  return [...browserDevices(), ...nativeDevices];
}

function deviceKey(device: Pick<InputDevice, 'source' | 'index' | 'id'>) {
  return `${device.source}:${device.index}:${device.id}`;
}

function loadBindings(): WheelBindings {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as WheelBindings) : {};
  } catch {
    return {};
  }
}

function saveBindings(bindings: WheelBindings) {
  window.localStorage.setItem(storageKey, JSON.stringify(bindings));
}

function resolveDevice(binding: AnyBinding | undefined) {
  if (!binding) return undefined;
  const all = devices();
  return all.find(device =>
    device.index === binding.deviceIndex
    && device.id === binding.deviceId
    && (!binding.deviceSource || device.source === binding.deviceSource))
    ?? all.find(device => device.id === binding.deviceId && (!binding.deviceSource || device.source === binding.deviceSource));
}

function bindingName(binding: AnyBinding | undefined) {
  if (!binding) return 'not assigned';
  const device = resolveDevice(binding);
  const deviceName = device?.name || binding.deviceId || `Device ${binding.deviceIndex}`;
  return `${deviceName} — ${binding.kind === 'axis' ? `Axis ${binding.index}` : `Button ${binding.index}`}`;
}

function deviceHat(device: InputDevice | undefined) {
  let up = (device?.buttons[12] ?? 0) > 0.5;
  let down = (device?.buttons[13] ?? 0) > 0.5;
  let left = (device?.buttons[14] ?? 0) > 0.5;
  let right = (device?.buttons[15] ?? 0) > 0.5;
  const pov = device?.pov;
  if (pov !== undefined && pov !== null && pov !== 0xffff && pov >= 0) {
    const sector = Math.round((pov % 36000) / 4500) % 8;
    up ||= sector === 7 || sector === 0 || sector === 1;
    right ||= sector === 1 || sector === 2 || sector === 3;
    down ||= sector === 3 || sector === 4 || sector === 5;
    left ||= sector === 5 || sector === 6 || sector === 7;
  }
  return {up, down, left, right};
}

function createSetupUi(
  onStart: () => void,
  onCapture: () => void,
  onClear: () => void,
  onToggle: () => void,
): SetupUi {
  const root = document.createElement('div');
  root.dataset.playstuntsOptionsRoot = '1';
  root.style.cssText = 'position:fixed;right:16px;top:16px;z-index:2147483647;font:14px/1.4 system-ui,Segoe UI,sans-serif;color:#f5f5f5;';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Wheel Setup [F8]';
  toggle.style.cssText = 'border:1px solid #777;background:#191919;color:#fff;border-radius:6px;padding:8px 12px;cursor:pointer;font:inherit;';
  toggle.addEventListener('click', onToggle);

  const panel = document.createElement('div');
  panel.style.cssText = 'display:none;margin-top:8px;width:min(620px,calc(100vw - 32px));max-height:calc(100vh - 82px);overflow:auto;background:rgba(12,12,12,.96);border:1px solid #666;border-radius:8px;padding:16px;box-shadow:0 12px 40px #000;';

  const title = document.createElement('div');
  title.textContent = 'PlayStunts DX — Wheel Setup';
  title.style.cssText = 'font-size:18px;font-weight:700;margin-bottom:8px;';

  const note = document.createElement('div');
  note.textContent = 'Each calibration point is measured only when you press Enter or Capture. Wheel, pedals and shifter may be separate devices.';
  note.style.cssText = 'color:#bbb;margin-bottom:12px;';

  const status = document.createElement('div');
  status.style.cssText = 'padding:10px 12px;background:#242424;border-radius:6px;font-weight:700;margin-bottom:12px;white-space:pre-wrap;';

  const bindings = document.createElement('div');
  bindings.style.cssText = 'white-space:pre-wrap;color:#ddd;margin-bottom:12px;';

  const deviceTitle = document.createElement('div');
  deviceTitle.textContent = 'Live devices / inputs';
  deviceTitle.style.cssText = 'font-weight:700;margin:10px 0 6px;';

  const devicesElement = document.createElement('div');
  devicesElement.style.cssText = 'white-space:pre-wrap;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;background:#080808;border-radius:6px;padding:10px;overflow:auto;';

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;';

  const start = document.createElement('button');
  start.type = 'button';
  start.textContent = 'Start calibration';
  start.style.cssText = 'border:1px solid #aaa;background:#eee;color:#111;border-radius:5px;padding:7px 10px;cursor:pointer;font:inherit;';
  start.addEventListener('click', onStart);

  const capture = document.createElement('button');
  capture.type = 'button';
  capture.textContent = 'Capture [Enter]';
  capture.style.cssText = 'border:1px solid #aaa;background:#eee;color:#111;border-radius:5px;padding:7px 10px;cursor:pointer;font:inherit;';
  capture.addEventListener('click', onCapture);

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Clear bindings';
  clear.style.cssText = 'border:1px solid #777;background:#222;color:#fff;border-radius:5px;padding:7px 10px;cursor:pointer;font:inherit;';
  clear.addEventListener('click', onClear);

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.style.cssText = 'border:1px solid #777;background:#222;color:#fff;border-radius:5px;padding:7px 10px;cursor:pointer;font:inherit;';
  close.addEventListener('click', onToggle);

  controls.append(start, capture, clear, close);
  panel.append(title, note, status, bindings, deviceTitle, devicesElement, controls);
  root.append(toggle, panel);
  document.body.append(root);

  return { root, toggle, panel, status, bindings, devices: devicesElement, start, capture, clear, close };
}

export function installDesktopDriveControls() {
  let frame = 0;
  let lastUiUpdate = 0;
  let setupOpen = false;
  let stage: SetupStage = 'idle';
  let bindings = loadBindings();
  let referenceSnapshot: InputSnapshot | undefined;
  let captureNotice = '';
  let pollingNative = false;
  const tauri = (window as typeof window & { __TAURI__?: TauriGlobal }).__TAURI__;

  async function pollNativeDevices() {
    if (pollingNative || !tauri?.core) return;
    pollingNative = true;
    try {
      const result = await tauri.core.invoke<NativeJoystick[]>('native_joysticks');
      nativeDevices = result.map((device, index) => ({
        id: device.id,
        index,
        name: device.name,
        source: 'Windows',
        axes: device.axes,
        buttons: device.buttons,
        pov: device.pov,
      }));
    } catch (reason) {
      console.warn('[Controls] Native joystick scan failed:', reason);
    } finally {
      pollingNative = false;
    }
  }

  void pollNativeDevices();
  const nativeTimer = window.setInterval(() => void pollNativeDevices(), 33);

  function snapshotDevices(): InputSnapshot {
    return new Map(
      devices().map(device => [
        deviceKey(device),
        {
          axes: [...device.axes],
          buttons: [...device.buttons],
        },
      ]),
    );
  }

  function sameInput(a: AnyBinding | undefined, device: InputDevice, kind: 'axis' | 'button', index: number) {
    return !!a
      && a.deviceId === device.id
      && a.deviceIndex === device.index
      && (!a.deviceSource || a.deviceSource === device.source)
      && a.kind === kind
      && a.index === index;
  }

  function findAxisDifference(before: InputSnapshot, exclude: AnyBinding[] = []) {
    let best: { device: InputDevice; axis: number; before: number; value: number; delta: number } | undefined;
    for (const device of devices()) {
      const previous = before.get(deviceKey(device));
      if (!previous) continue;
      for (let axis = 0; axis < device.axes.length; axis += 1) {
        if (exclude.some(binding => sameInput(binding, device, 'axis', axis))) continue;
        const from = previous.axes[axis] ?? 0;
        const value = device.axes[axis] ?? 0;
        const delta = Math.abs(value - from);
        if (delta >= axisCaptureThreshold && (!best || delta > best.delta)) {
          best = { device, axis, before: from, value, delta };
        }
      }
    }
    return best;
  }

  function findInputDifference(before: InputSnapshot, exclude: AnyBinding[] = []) {
    const axis = findAxisDifference(before, exclude);
    let buttonBest: { device: InputDevice; button: number; before: number; value: number; delta: number } | undefined;
    for (const device of devices()) {
      const previous = before.get(deviceKey(device));
      if (!previous) continue;
      for (let button = 0; button < device.buttons.length; button += 1) {
        if (exclude.some(binding => sameInput(binding, device, 'button', button))) continue;
        const from = previous.buttons[button] ?? 0;
        const value = device.buttons[button] ?? 0;
        const delta = Math.abs(value - from);
        if ((value > buttonCaptureThreshold || delta >= buttonCaptureThreshold)
          && (!buttonBest || delta > buttonBest.delta)) {
          buttonBest = { device, button, before: from, value, delta };
        }
      }
    }

    if (axis && (!buttonBest || axis.delta >= buttonBest.delta)) {
      return {
        deviceId: axis.device.id,
        deviceIndex: axis.device.index,
        deviceSource: axis.device.source,
        kind: 'axis' as const,
        index: axis.axis,
        rest: axis.before,
        active: axis.value,
        direction: (axis.value - axis.before >= 0 ? 1 : -1) as 1 | -1,
      };
    }
    if (buttonBest) {
      return {
        deviceId: buttonBest.device.id,
        deviceIndex: buttonBest.device.index,
        deviceSource: buttonBest.device.source,
        kind: 'button' as const,
        index: buttonBest.button,
      };
    }
    return undefined;
  }

  function stageInstruction() {
    if (stage === 'steering-left') return '1/6 — Turn the wheel fully LEFT and hold it. Press Enter or Capture.';
    if (stage === 'steering-right') return '2/6 — Turn the wheel fully RIGHT and hold it. Press Enter or Capture.';
    if (stage === 'throttle-rest') return '3/6 — Release GAS completely. Press Enter or Capture.';
    if (stage === 'throttle-full') return '4/6 — Press GAS fully and hold it. Press Enter or Capture.';
    if (stage === 'brake-rest') return '5/6 — Release BRAKE completely. Press Enter or Capture.';
    if (stage === 'brake-full') return '6/6 — Press BRAKE fully and hold it. Press Enter or Capture.';
    if (stage === 'done') return 'Calibration saved. Release the pedals, keep Input Device on WHEEL, close this window and drive.';
    return Object.keys(bindings).length
      ? 'Bindings loaded. Click Start calibration to replace them.'
      : 'Click Start calibration to measure wheel, gas and brake.';
  }

  function stageText() {
    const instruction = stageInstruction();
    return captureNotice ? `${captureNotice}\n${instruction}` : instruction;
  }

  function axisDetails(binding: AxisBinding | undefined) {
    if (!binding) return '';
    return `  rest ${binding.rest.toFixed(3)} / full ${binding.active.toFixed(3)}`;
  }

  function steeringDetails(binding: SteeringBinding | undefined) {
    if (!binding) return '';
    return `  left ${binding.left.toFixed(3)} / center ${binding.center.toFixed(3)} / right ${binding.right.toFixed(3)}`;
  }

  function bindingsText() {
    return [
      `Steering: ${bindingName(bindings.steering)}${steeringDetails(bindings.steering)}`,
      `Gas:      ${bindingName(bindings.throttle)}${bindings.throttle?.kind === 'axis' ? axisDetails(bindings.throttle) : ''}`,
      `Brake:    ${bindingName(bindings.brake)}${bindings.brake?.kind === 'axis' ? axisDetails(bindings.brake) : ''}`,
    ].join('\n');
  }

  function updateUi(ui: SetupUi) {
    const editorActive=blissEditorActive();
    ui.root.style.display=editorActive?'none':'block';
    if(editorActive&&setupOpen){
      setupOpen=false;
      referenceSnapshot=undefined;
      captureNotice='';
      if(stage!=='done')stage='idle';
    }
    ui.panel.style.display = setupOpen ? 'block' : 'none';
    ui.status.textContent = stageText();
    ui.bindings.textContent = bindingsText();
    ui.capture.disabled = stage === 'idle' || stage === 'done';
    ui.capture.style.opacity = ui.capture.disabled ? '.45' : '1';
    ui.capture.style.cursor = ui.capture.disabled ? 'default' : 'pointer';
    if (!setupOpen) return;

    const all = devices();
    if (!all.length) {
      ui.devices.textContent = 'No controller devices visible yet.';
      return;
    }

    ui.devices.textContent = all.map(device => {
      const axes = device.axes.length
        ? device.axes.map((value, index) => `A${index}=${value.toFixed(3)}`).join('  ')
        : 'no axes';
      const pressed = device.buttons
        .map((value, index) => value > 0.05 ? `B${index}=${value.toFixed(2)}` : '')
        .filter(Boolean)
        .join('  ') || 'none';
      const pov = device.pov !== undefined && device.pov !== null && device.pov !== 0xffff
        ? `  POV=${device.pov}`
        : '';
      return `[${device.source}] ${device.name}\n  ${axes}\n  active buttons: ${pressed}${pov}`;
    }).join('\n\n');
  }

  function startCalibration() {
    bindings = {};
    referenceSnapshot = undefined;
    captureNotice = '';
    stage = 'steering-left';
    clearDesktopWheelInput();
  }

  function clearBindings() {
    bindings = {};
    referenceSnapshot = undefined;
    captureNotice = '';
    stage = 'idle';
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(oldStorageKey);
    clearDesktopWheelInput();
  }

  function captureCalibrationPoint() {
    if (!setupOpen || stage === 'idle' || stage === 'done') return;
    captureNotice = '';

    if (stage === 'steering-left') {
      referenceSnapshot = snapshotDevices();
      stage = 'steering-right';
      return;
    }

    if (stage === 'steering-right') {
      if (!referenceSnapshot) {
        stage = 'steering-left';
        captureNotice = 'Left steering point was lost. Capture full LEFT again.';
        return;
      }
      const movement = findAxisDifference(referenceSnapshot);
      if (!movement) {
        captureNotice = 'No steering axis changed enough. Hold full RIGHT and press Enter again.';
        return;
      }
      const left = movement.before;
      const right = movement.value;
      bindings.steering = {
        deviceId: movement.device.id,
        deviceIndex: movement.device.index,
        deviceSource: movement.device.source,
        kind: 'axis',
        index: movement.axis,
        left,
        center: (left + right) / 2,
        right,
      };
      referenceSnapshot = undefined;
      stage = 'throttle-rest';
      return;
    }

    if (stage === 'throttle-rest') {
      referenceSnapshot = snapshotDevices();
      stage = 'throttle-full';
      return;
    }

    if (stage === 'throttle-full') {
      if (!referenceSnapshot) {
        stage = 'throttle-rest';
        captureNotice = 'Gas neutral point was lost. Capture released GAS again.';
        return;
      }
      const movement = findInputDifference(referenceSnapshot, bindings.steering ? [bindings.steering] : []);
      if (!movement) {
        captureNotice = 'No gas input changed enough. Hold GAS fully down and press Enter again.';
        return;
      }
      bindings.throttle = movement;
      referenceSnapshot = undefined;
      stage = 'brake-rest';
      return;
    }

    if (stage === 'brake-rest') {
      referenceSnapshot = snapshotDevices();
      stage = 'brake-full';
      return;
    }

    if (!referenceSnapshot) {
      stage = 'brake-rest';
      captureNotice = 'Brake neutral point was lost. Capture released BRAKE again.';
      return;
    }
    const exclude = [bindings.steering, bindings.throttle].filter(
      (binding): binding is AnyBinding => !!binding,
    );
    const movement = findInputDifference(referenceSnapshot, exclude);
    if (!movement) {
      captureNotice = 'No brake input changed enough. Hold BRAKE fully down and press Enter again.';
      return;
    }
    bindings.brake = movement;
    referenceSnapshot = undefined;
    stage = 'done';
    saveBindings(bindings);
  }

  function toggleSetup() {
    setupOpen = !setupOpen;
    if (setupOpen) {
      clearDesktopWheelInput();
      void pollNativeDevices();
    } else if (stage !== 'done') {
      referenceSnapshot = undefined;
      captureNotice = '';
      stage = 'idle';
    }
  }

  const ui = createSetupUi(startCalibration, captureCalibrationPoint, clearBindings, toggleSetup);

  function onKeyDown(event: KeyboardEvent) {
    if(blissEditorActive())return;
    if (event.key === 'F8' && !event.repeat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleSetup();
      return;
    }
    if (!setupOpen || event.repeat || (event.key !== 'Enter' && event.code !== 'NumpadEnter')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    captureCalibrationPoint();
  }
  window.addEventListener('keydown', onKeyDown, true);

  function steeringAmount(binding: SteeringBinding | undefined) {
    if (!binding) return 0;
    const device = resolveDevice(binding);
    if (!device) return 0;
    const range = binding.right - binding.left;
    if (Math.abs(range) < 0.05) return 0;
    const value = device.axes[binding.index] ?? binding.center;
    const normalized = Math.max(-1, Math.min(1, ((value - binding.left) / range) * 2 - 1));
    return applySteeringDeadzone(normalized);
  }

  function inputAmount(binding: InputBinding | undefined) {
    if (!binding) return 0;
    const device = resolveDevice(binding);
    if (!device) return 0;
    if (binding.kind === 'button') return Math.max(0, Math.min(1, device.buttons[binding.index] ?? 0));
    const range = binding.active - binding.rest;
    if (Math.abs(range) < 0.05) return 0;
    return Math.max(0, Math.min(1, ((device.axes[binding.index] ?? binding.rest) - binding.rest) / range));
  }

  function publishWheelInput() {
    const configured = !!bindings.steering && !!bindings.throttle && !!bindings.brake;
    const connected = configured
      && !!resolveDevice(bindings.steering)
      && !!resolveDevice(bindings.throttle)
      && !!resolveDevice(bindings.brake);
    if (!configured || !connected || setupOpen) {
      setDesktopWheelInput({configured,connected,steering:0,throttle:0,brake:0,hatUp:false,hatDown:false,hatLeft:false,hatRight:false});
      return;
    }
    const hat = deviceHat(resolveDevice(bindings.steering));
    setDesktopWheelInput({
      configured: true,
      connected: true,
      steering: steeringAmount(bindings.steering),
      throttle: inputAmount(bindings.throttle),
      brake: inputAmount(bindings.brake),
      hatUp: hat.up,
      hatDown: hat.down,
      hatLeft: hat.left,
      hatRight: hat.right,
    });
  }

  function tick(now: number) {
    publishWheelInput();
    if (now - lastUiUpdate > 100) {
      lastUiUpdate = now;
      updateUi(ui);
    }
    frame = requestAnimationFrame(tick);
  }

  updateUi(ui);
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    window.clearInterval(nativeTimer);
    window.removeEventListener('keydown', onKeyDown, true);
    clearDesktopWheelInput();
    nativeDevices = [];
    ui.root.remove();
  };
}
