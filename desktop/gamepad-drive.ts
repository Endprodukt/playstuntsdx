type DriveKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
type SetupStage = 'idle' | 'steering' | 'throttle' | 'brake' | 'done';

type AxisBinding = {
  deviceId: string;
  deviceIndex: number;
  kind: 'axis';
  index: number;
  rest: number;
  active: number;
  direction: 1 | -1;
};

type ButtonBinding = {
  deviceId: string;
  deviceIndex: number;
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
  source: 'WebView2' | 'Windows';
  axes: number[];
  buttons: number[];
};

type DeviceSnapshot = {
  id: string;
  axes: number[];
  buttons: number[];
};

type NativeJoystick = {
  id: string;
  name: string;
  axes: number[];
  buttons: number[];
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
const steeringThreshold = 0.18;
const pedalThreshold = 0.18;
const axisCaptureThreshold = 0.42;
const buttonCaptureThreshold = 0.55;

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
  return all.find(device => device.index === binding.deviceIndex && device.id === binding.deviceId)
    ?? all.find(device => device.id === binding.deviceId);
}

function bindingName(binding: InputBinding | undefined) {
  if (!binding) return 'not assigned';
  const device = resolveDevice(binding);
  const deviceName = device?.name || binding.deviceId || `Device ${binding.deviceIndex}`;
  return `${deviceName} — ${binding.kind === 'axis' ? `Axis ${binding.index}` : `Button ${binding.index}`}`;
}

function dispatchDriveKey(target: HTMLElement, key: DriveKey, down: boolean) {
  target.dispatchEvent(
    new KeyboardEvent(down ? 'keydown' : 'keyup', {
      key,
      code: key,
      bubbles: true,
      cancelable: true,
    }),
  );
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
  note.textContent = 'Temporary test setup. WebView2 and native Windows controller devices are watched at the same time. Leave wheel and pedals at rest before starting.';
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
  let bindings = loadBindings();
  let baseline = new Map<string, DeviceSnapshot>();
  let lastTarget: HTMLElement | null = null;
  let pollingNative = false;
  const activeKeys = new Set<DriveKey>();
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

  function releaseAll() {
    if (lastTarget) {
      for (const key of activeKeys) dispatchDriveKey(lastTarget, key, false);
    }
    activeKeys.clear();
  }

  function setKey(target: HTMLElement, key: DriveKey, down: boolean) {
    if (down === activeKeys.has(key)) return;
    dispatchDriveKey(target, key, down);
    if (down) activeKeys.add(key);
    else activeKeys.delete(key);
  }

  function captureBaseline() {
    baseline = new Map(
      devices().map(device => [
        device.id,
        {
          id: device.id,
          axes: [...device.axes],
          buttons: [...device.buttons],
        },
      ]),
    );
  }

  function sameInput(a: InputBinding | undefined, device: InputDevice, kind: 'axis' | 'button', index: number) {
    return !!a
      && a.deviceId === device.id
      && a.kind === kind
      && a.index === index;
  }

  function findAxisMovement(exclude: InputBinding[] = []) {
    let best: { device: InputDevice; axis: number; rest: number; value: number; delta: number } | undefined;
    for (const device of devices()) {
      const before = baseline.get(device.id);
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

  function findPedalMovement(exclude: InputBinding[] = []) {
    const axis = findAxisMovement(exclude);
    let buttonBest: { device: InputDevice; button: number; delta: number } | undefined;
    for (const device of devices()) {
      const before = baseline.get(device.id);
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

    if (axis && (!buttonBest || axis.delta >= buttonBest.delta)) {
      return {
        deviceId: axis.device.id,
        deviceIndex: axis.device.index,
        kind: 'axis' as const,
        index: axis.axis,
        rest: axis.rest,
        active: axis.value,
        direction: (axis.value - axis.rest >= 0 ? 1 : -1) as 1 | -1,
      };
    }
    if (buttonBest) {
      return {
        deviceId: buttonBest.device.id,
        deviceIndex: buttonBest.device.index,
        kind: 'button' as const,
        index: buttonBest.button,
      };
    }
    return undefined;
  }

  function stageText() {
    if (!setupOpen) return 'Wheel setup closed.';
    if (stage === 'steering') return '1/3 — Turn the steering wheel LEFT and hold it briefly.';
    if (stage === 'throttle') return '2/3 — Press GAS firmly.';
    if (stage === 'brake') return '3/3 — Press BRAKE firmly.';
    if (stage === 'done') return 'Calibration saved. Close this window and test the car.';
    return Object.keys(bindings).length
      ? 'Bindings loaded. Click Start calibration to replace them.'
      : 'Click Start calibration. Move or press each controller once if needed.';
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
    releaseAll();
    bindings = {};
    stage = 'steering';
    captureBaseline();
  }

  function clearBindings() {
    releaseAll();
    bindings = {};
    stage = 'idle';
    window.localStorage.removeItem(storageKey);
    captureBaseline();
  }

  function toggleSetup() {
    setupOpen = !setupOpen;
    if (setupOpen) {
      releaseAll();
      void pollNativeDevices().then(captureBaseline);
    } else if (stage !== 'done') {
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

  function advanceCalibration() {
    if (!setupOpen) return;

    if (stage === 'steering') {
      const movement = findAxisMovement();
      if (!movement) return;
      bindings.steering = {
        deviceId: movement.device.id,
        deviceIndex: movement.device.index,
        kind: 'axis',
        index: movement.axis,
        rest: movement.rest,
        active: movement.value,
        direction: (movement.value - movement.rest >= 0 ? 1 : -1) as 1 | -1,
      };
      stage = 'throttle';
      captureBaseline();
      return;
    }

    if (stage === 'throttle') {
      const movement = findPedalMovement(bindings.steering ? [bindings.steering] : []);
      if (!movement) return;
      bindings.throttle = movement;
      stage = 'brake';
      captureBaseline();
      return;
    }

    if (stage === 'brake') {
      const exclude = [bindings.steering, bindings.throttle].filter(
        (binding): binding is InputBinding => !!binding,
      );
      const movement = findPedalMovement(exclude);
      if (!movement) return;
      bindings.brake = movement;
      stage = 'done';
      saveBindings(bindings);
    }
  }

  function axisAmount(binding: AxisBinding | undefined) {
    if (!binding) return 0;
    const device = resolveDevice(binding);
    if (!device) return 0;
    return ((device.axes[binding.index] ?? binding.rest) - binding.rest) * binding.direction;
  }

  function inputActive(binding: InputBinding | undefined) {
    if (!binding) return false;
    const device = resolveDevice(binding);
    if (!device) return false;
    if (binding.kind === 'button') {
      return (device.buttons[binding.index] ?? 0) > 0.35;
    }
    return (((device.axes[binding.index] ?? binding.rest) - binding.rest) * binding.direction) > pedalThreshold;
  }

  function tick(now: number) {
    advanceCalibration();
    if (now - lastUiUpdate > 100) {
      lastUiUpdate = now;
      updateUi(ui);
    }

    const target = document.querySelector<HTMLElement>('.native-screen');
    if (!target || setupOpen) {
      releaseAll();
      lastTarget = target;
      frame = requestAnimationFrame(tick);
      return;
    }

    if (lastTarget && lastTarget !== target) releaseAll();
    lastTarget = target;

    const steering = axisAmount(bindings.steering);
    setKey(target, 'ArrowUp', inputActive(bindings.throttle));
    setKey(target, 'ArrowDown', inputActive(bindings.brake));
    setKey(target, 'ArrowLeft', steering > steeringThreshold);
    setKey(target, 'ArrowRight', steering < -steeringThreshold);

    frame = requestAnimationFrame(tick);
  }

  updateUi(ui);
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    window.clearInterval(nativeTimer);
    window.removeEventListener('keydown', onKeyDown, true);
    releaseAll();
    nativeDevices = [];
    ui.root.remove();
  };
}
