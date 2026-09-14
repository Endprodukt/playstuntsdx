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

type DeviceSnapshot = {
  id: string;
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

const storageKey = 'playstunts-dx-wheel-bindings-v1';
const steeringThreshold = 0.18;
const pedalThreshold = 0.18;
const axisCaptureThreshold = 0.42;
const buttonCaptureThreshold = 0.55;

function gamepads() {
  if (typeof navigator.getGamepads !== 'function') return [];
  return Array.from(navigator.getGamepads()).filter(
    (gamepad): gamepad is Gamepad => !!gamepad?.connected,
  );
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
  const pads = gamepads();
  return pads.find(pad => pad.index === binding.deviceIndex && pad.id === binding.deviceId)
    ?? pads.find(pad => pad.id === binding.deviceId);
}

function bindingName(binding: InputBinding | undefined) {
  if (!binding) return 'not assigned';
  const device = binding.deviceId || `Device ${binding.deviceIndex}`;
  return `${device} — ${binding.kind === 'axis' ? `Axis ${binding.index}` : `Button ${binding.index}`}`;
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
  note.textContent = 'Temporary test setup. All connected controller devices are watched at the same time. Leave wheel and pedals at rest before starting.';
  note.style.cssText = 'color:#bbb;margin-bottom:12px;';

  const status = document.createElement('div');
  status.style.cssText = 'padding:10px 12px;background:#242424;border-radius:6px;font-weight:700;margin-bottom:12px;';

  const bindings = document.createElement('div');
  bindings.style.cssText = 'white-space:pre-wrap;color:#ddd;margin-bottom:12px;';

  const deviceTitle = document.createElement('div');
  deviceTitle.textContent = 'Live devices / inputs';
  deviceTitle.style.cssText = 'font-weight:700;margin:10px 0 6px;';

  const devices = document.createElement('div');
  devices.style.cssText = 'white-space:pre-wrap;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;background:#080808;border-radius:6px;padding:10px;overflow:auto;';

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
  panel.append(title, note, status, bindings, deviceTitle, devices, controls);
  root.append(toggle, panel);
  document.body.append(root);

  return { root, toggle, panel, status, bindings, devices, start, clear, close };
}

export function installDesktopDriveControls() {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return () => {};
  }

  let frame = 0;
  let lastUiUpdate = 0;
  let setupOpen = false;
  let stage: SetupStage = 'idle';
  let bindings = loadBindings();
  let baseline = new Map<number, DeviceSnapshot>();
  let lastTarget: HTMLElement | null = null;
  const activeKeys = new Set<DriveKey>();

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
      gamepads().map(pad => [
        pad.index,
        {
          id: pad.id,
          axes: [...pad.axes],
          buttons: pad.buttons.map(button => button.value),
        },
      ]),
    );
  }

  function sameInput(a: InputBinding | undefined, device: Gamepad, kind: 'axis' | 'button', index: number) {
    return !!a
      && a.deviceId === device.id
      && a.kind === kind
      && a.index === index;
  }

  function findAxisMovement(exclude: InputBinding[] = []) {
    let best: { pad: Gamepad; axis: number; rest: number; value: number; delta: number } | undefined;
    for (const pad of gamepads()) {
      const before = baseline.get(pad.index);
      if (!before || before.id !== pad.id) continue;
      for (let axis = 0; axis < pad.axes.length; axis += 1) {
        if (exclude.some(binding => sameInput(binding, pad, 'axis', axis))) continue;
        const rest = before.axes[axis] ?? 0;
        const value = pad.axes[axis] ?? 0;
        const delta = Math.abs(value - rest);
        if (delta >= axisCaptureThreshold && (!best || delta > best.delta)) {
          best = { pad, axis, rest, value, delta };
        }
      }
    }
    return best;
  }

  function findPedalMovement(exclude: InputBinding[] = []) {
    const axis = findAxisMovement(exclude);
    let buttonBest: { pad: Gamepad; button: number; delta: number } | undefined;
    for (const pad of gamepads()) {
      const before = baseline.get(pad.index);
      if (!before || before.id !== pad.id) continue;
      for (let button = 0; button < pad.buttons.length; button += 1) {
        if (exclude.some(binding => sameInput(binding, pad, 'button', button))) continue;
        const value = pad.buttons[button]?.value ?? 0;
        const delta = value - (before.buttons[button] ?? 0);
        if ((pad.buttons[button]?.pressed || delta >= buttonCaptureThreshold)
          && (!buttonBest || delta > buttonBest.delta)) {
          buttonBest = { pad, button, delta };
        }
      }
    }

    if (axis && (!buttonBest || axis.delta >= buttonBest.delta)) {
      return {
        deviceId: axis.pad.id,
        deviceIndex: axis.pad.index,
        kind: 'axis' as const,
        index: axis.axis,
        rest: axis.rest,
        active: axis.value,
        direction: (axis.value - axis.rest >= 0 ? 1 : -1) as 1 | -1,
      };
    }
    if (buttonBest) {
      return {
        deviceId: buttonBest.pad.id,
        deviceIndex: buttonBest.pad.index,
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
      : 'Click Start calibration. If no devices appear below, press a button once on the controller.';
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

    const pads = gamepads();
    if (!pads.length) {
      ui.devices.textContent = 'No controller devices visible to WebView2 yet.\nPress a button on each device once, then move an axis.';
      return;
    }

    ui.devices.textContent = pads.map(pad => {
      const axes = pad.axes.length
        ? pad.axes.map((value, index) => `A${index}=${value.toFixed(3)}`).join('  ')
        : 'no axes';
      const pressed = pad.buttons
        .map((button, index) => (button.pressed || button.value > 0.05) ? `B${index}=${button.value.toFixed(2)}` : '')
        .filter(Boolean)
        .join('  ') || 'none';
      return `[${pad.index}] ${pad.id}\n  ${axes}\n  active buttons: ${pressed}`;
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
      captureBaseline();
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
        deviceId: movement.pad.id,
        deviceIndex: movement.pad.index,
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
    const pad = resolveDevice(binding);
    if (!pad) return 0;
    return ((pad.axes[binding.index] ?? binding.rest) - binding.rest) * binding.direction;
  }

  function inputActive(binding: InputBinding | undefined) {
    if (!binding) return false;
    const pad = resolveDevice(binding);
    if (!pad) return false;
    if (binding.kind === 'button') {
      const button = pad.buttons[binding.index];
      return !!button && (button.pressed || button.value > 0.35);
    }
    return (((pad.axes[binding.index] ?? binding.rest) - binding.rest) * binding.direction) > pedalThreshold;
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
    window.removeEventListener('keydown', onKeyDown, true);
    releaseAll();
    ui.root.remove();
  };
}
