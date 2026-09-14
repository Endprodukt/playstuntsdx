import {clearDesktopWheelInput,setDesktopWheelInput} from '../lib/game/desktop-wheel-input';

type SetupStage = 'idle' | 'steering' | 'throttle' | 'brake' | 'done';
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

type ButtonBinding = {
  deviceId: string;
  deviceIndex: number;
  deviceSource?: DeviceSource;
  kind: 'button';
  index: number;
};

type InputBinding = AxisBinding | ButtonBinding;
type WheelBindings = {
  steering?: AxisBinding;
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
};

type DeviceSnapshot = {
  axes: number[];
  buttons: number[];
};

type NativeJoystick = {
  id: string;
  name: string;
  axes: number[];
  buttons: number[];
};

type PendingCapture = {
  stage: 'steering' | 'throttle' | 'brake';
  binding: InputBinding;
};

type SetupUi = {
  root: HTMLDivElement;
  toggle: HTMLButtonElement;
  panel: HTMLDivElement;
  status: HTMLDivElement;
  bindings: HTMLDivElement;
  devices: HTMLDivElement;
  start: HTMLButtonElement;
  clear: HTMLButtonElement;
  close: HTMLButtonElement;
};

type TauriGlobal = {
  core?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
};

const storageKey = 'playstunts-dx-wheel-bindings-v1';
const axisCaptureThreshold = 0.42;
const buttonCaptureThreshold = 0.55;
const axisReleaseThreshold = 0.12;
const buttonReleaseThreshold = 0.2;

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

function resolveDevice(binding: InputBinding | undefined) {
  if (!binding) return undefined;
  const all = devices();
  return all.find(device =>
    device.index === binding.deviceIndex
    && device.id === binding.deviceId
    && (!binding.deviceSource || device.source === binding.deviceSource))
    ?? all.find(device => device.id === binding.deviceId && (!binding.deviceSource || device.source === binding.deviceSource));
}

function bindingName(binding: InputBinding | undefined) {
  if (!binding) return 'not assigned';
  const device = resolveDevice(binding);
  const deviceName = device?.name || binding.deviceId || `Device ${binding.deviceIndex}`;
  return `${deviceName} — ${binding.kind === 'axis' ? `Axis ${binding.index}` : `Button ${binding.index}`}`;
}

function createSetupUi(onStart: () => void, onClear: () => void, onToggle: () => void): SetupUi {
  const root = document.createElement('div');
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
  note.textContent = 'WebView2 and native Windows controller devices are watched at the same time. Leave wheel and pedals at rest before starting.';
  note.style.cssText = 'color:#bbb;margin-bottom:12px;';

  const status = document.createElement('div');
  status.style.cssText = 'padding:10px 12px;background:#242424;border-radius:6px;font-weight:700;margin-bottom:12px;';

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

  controls.append(start, clear, close);
  panel.append(title, note, status, bindings, deviceTitle, devicesElement, controls);
  root.append(toggle, panel);
  document.body.append(root);

  return { root, toggle, panel, status, bindings, devices: devicesElement, start, clear, close };
}

export function installDesktopDriveControls() {
  let frame = 0;
  let lastUiUpdate = 0;
  let setupOpen = false;
  let stage: SetupStage = 'idle';
  let pending: PendingCapture | undefined;
  let bindings = loadBindings();
  let baseline = new Map<string, DeviceSnapshot>();
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
      }));
    } catch (reason) {
      console.warn('[Controls] Native joystick scan failed:', reason);
    } finally {
      pollingNative = false;
    }
  }

  void pollNativeDevices();
  const nativeTimer = window.setInterval(() => void pollNativeDevices(), 33);

  function captureBaseline() {
    baseline = new Map(
      devices().map(device => [
        deviceKey(device),
        {
          axes: [...device.axes],
          buttons: [...device.buttons],
        },
      ]),
    );
  }

  function sameInput(a: InputBinding | undefined, device: InputDevice, kind: 'axis' | 'button', index: number) {
    return !!a
      && a.deviceId === device.id
      && a.deviceIndex === device.index
      && (!a.deviceSource || a.deviceSource === device.source)
      && a.kind === kind
      && a.index === index;
  }

  function findAxisMovement(exclude: InputBinding[] = []) {
    let best: { device: InputDevice; axis: number; rest: number; value: number; delta: number } | undefined;
    for (const device of devices()) {
      const before = baseline.get(deviceKey(device));
      if (!before) continue;
      for (let axis = 0; axis < device.axes.length; axis += 1) {
        if (exclude.some(binding => sameInput(binding, device, 'axis', axis))) continue;
        const rest = before.axes[axis] ?? 0;
        const value = device.axes[axis] ?? 0;
        const delta = Math.abs(value - rest);
        if (delta >= axisCaptureThreshold && (!best || delta > best.delta)) {
          best = { device, axis, rest, value, delta };
        }
      }
    }
    return best;
  }

  function axisBinding(movement: NonNullable<ReturnType<typeof findAxisMovement>>): AxisBinding {
    return {
      deviceId: movement.device.id,
      deviceIndex: movement.device.index,
      deviceSource: movement.device.source,
      kind: 'axis',
      index: movement.axis,
      rest: movement.rest,
      active: movement.value,
      direction: (movement.value - movement.rest >= 0 ? 1 : -1) as 1 | -1,
    };
  }

  function findPedalMovement(exclude: InputBinding[] = []) {
    const axis = findAxisMovement(exclude);
    let buttonBest: { device: InputDevice; button: number; delta: number } | undefined;
    for (const device of devices()) {
      const before = baseline.get(deviceKey(device));
      if (!before) continue;
      for (let button = 0; button < device.buttons.length; button += 1) {
        if (exclude.some(binding => sameInput(binding, device, 'button', button))) continue;
        const value = device.buttons[button] ?? 0;
        const delta = value - (before.buttons[button] ?? 0);
        if ((value > buttonCaptureThreshold || delta >= buttonCaptureThreshold)
          && (!buttonBest || delta > buttonBest.delta)) {
          buttonBest = { device, button, delta };
        }
      }
    }

    if (axis && (!buttonBest || axis.delta >= buttonBest.delta)) return axisBinding(axis);
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

  function stageText() {
    if (!setupOpen) return 'Wheel setup closed.';
    if (stage === 'steering') return pending
      ? 'Steering detected — return the wheel to center.'
      : '1/3 — Turn the steering wheel LEFT to full lock, then return it to center.';
    if (stage === 'throttle') return pending
      ? 'Gas detected — release the pedal completely.'
      : '2/3 — Press GAS firmly through its full travel, then release it.';
    if (stage === 'brake') return pending
      ? 'Brake detected — release the pedal completely.'
      : '3/3 — Press BRAKE firmly through its full travel, then release it.';
    if (stage === 'done') return 'Calibration saved. Set Input Device to WHEEL, close this window and test the car.';
    return Object.keys(bindings).length
      ? 'Bindings loaded. Click Start calibration to replace them.'
      : 'Click Start calibration. Wheel and pedals should be at rest.';
  }

  function bindingsText() {
    return [
      `Steering: ${bindingName(bindings.steering)}`,
      `Gas:      ${bindingName(bindings.throttle)}`,
      `Brake:    ${bindingName(bindings.brake)}`,
    ].join('\n');
  }

  function updateUi(ui: SetupUi) {
    ui.panel.style.display = setupOpen ? 'block' : 'none';
    ui.status.textContent = stageText();
    ui.bindings.textContent = bindingsText();
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
      return `[${device.source}] ${device.name}\n  ${axes}\n  active buttons: ${pressed}`;
    }).join('\n\n');
  }

  function startCalibration() {
    bindings = {};
    pending = undefined;
    stage = 'steering';
    clearDesktopWheelInput();
    captureBaseline();
  }

  function clearBindings() {
    bindings = {};
    pending = undefined;
    stage = 'idle';
    window.localStorage.removeItem(storageKey);
    clearDesktopWheelInput();
    captureBaseline();
  }

  function toggleSetup() {
    setupOpen = !setupOpen;
    if (setupOpen) {
      clearDesktopWheelInput();
      void pollNativeDevices().then(captureBaseline);
    } else if (stage !== 'done') {
      pending = undefined;
      stage = 'idle';
    }
  }

  const ui = createSetupUi(startCalibration, clearBindings, toggleSetup);

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'F8' || event.repeat) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleSetup();
  }
  window.addEventListener('keydown', onKeyDown, true);

  function updatePendingCapture() {
    if (!pending) return false;
    const device = resolveDevice(pending.binding);
    if (!device) {
      pending = undefined;
      captureBaseline();
      return false;
    }

    if (pending.binding.kind === 'axis') {
      const value = device.axes[pending.binding.index] ?? pending.binding.rest;
      if (Math.abs(value - pending.binding.rest) > Math.abs(pending.binding.active - pending.binding.rest)) {
        pending.binding.active = value;
        pending.binding.direction = value - pending.binding.rest >= 0 ? 1 : -1;
      }
      if (Math.abs(value - pending.binding.rest) > axisReleaseThreshold) return true;
    } else if ((device.buttons[pending.binding.index] ?? 0) > buttonReleaseThreshold) return true;

    const finished = pending;
    pending = undefined;
    if (finished.stage === 'steering') {
      bindings.steering = finished.binding as AxisBinding;
      stage = 'throttle';
    } else if (finished.stage === 'throttle') {
      bindings.throttle = finished.binding;
      stage = 'brake';
    } else {
      bindings.brake = finished.binding;
      stage = 'done';
      saveBindings(bindings);
    }
    captureBaseline();
    return true;
  }

  function advanceCalibration() {
    if (!setupOpen || stage === 'idle' || stage === 'done') return;
    if (updatePendingCapture()) return;

    if (stage === 'steering') {
      const movement = findAxisMovement();
      if (movement) pending = { stage, binding: axisBinding(movement) };
      return;
    }

    if (stage === 'throttle') {
      const movement = findPedalMovement(bindings.steering ? [bindings.steering] : []);
      if (movement) pending = { stage, binding: movement };
      return;
    }

    const exclude = [bindings.steering, bindings.throttle].filter(
      (binding): binding is InputBinding => !!binding,
    );
    const movement = findPedalMovement(exclude);
    if (movement) pending = { stage, binding: movement };
  }

  function normalizedAxis(binding: AxisBinding | undefined) {
    if (!binding) return 0;
    const device = resolveDevice(binding);
    if (!device) return 0;
    const range = binding.active - binding.rest;
    if (Math.abs(range) < 0.05) return 0;
    return ((device.axes[binding.index] ?? binding.rest) - binding.rest) / range;
  }

  function inputAmount(binding: InputBinding | undefined) {
    if (!binding) return 0;
    const device = resolveDevice(binding);
    if (!device) return 0;
    if (binding.kind === 'button') return Math.max(0, Math.min(1, device.buttons[binding.index] ?? 0));
    return Math.max(0, Math.min(1, normalizedAxis(binding)));
  }

  function publishWheelInput() {
    const configured = !!bindings.steering && !!bindings.throttle && !!bindings.brake;
    const connected = configured
      && !!resolveDevice(bindings.steering)
      && !!resolveDevice(bindings.throttle)
      && !!resolveDevice(bindings.brake);
    if (!configured || !connected || setupOpen) {
      setDesktopWheelInput({ configured, connected, steering: 0, throttle: 0, brake: 0 });
      return;
    }
    setDesktopWheelInput({
      configured: true,
      connected: true,
      // Steering is calibrated by moving LEFT first. Expose conventional -1 left / +1 right.
      steering: Math.max(-1, Math.min(1, -normalizedAxis(bindings.steering))),
      throttle: inputAmount(bindings.throttle),
      brake: inputAmount(bindings.brake),
    });
  }

  function tick(now: number) {
    advanceCalibration();
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
