type DriveKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

const steeringDeadzone = 0.18;
const pedalThreshold = 0.25;

function pressed(button: GamepadButton | undefined) {
  return !!button && (button.pressed || button.value > pedalThreshold);
}

function controllerScore(gamepad: Gamepad) {
  const id = gamepad.id.toLowerCase();
  let score = gamepad.axes.length * 10 + gamepad.buttons.length;
  if (id.includes('fanatec') || id.includes('0eb7')) score += 1000;
  if (gamepad.mapping === 'standard') score += 100;
  return score;
}

function selectDriveController() {
  if (typeof navigator.getGamepads !== 'function') return undefined;
  return Array.from(navigator.getGamepads())
    .filter((gamepad): gamepad is Gamepad => !!gamepad?.connected && gamepad.axes.length > 0)
    .sort((a, b) => controllerScore(b) - controllerScore(a))[0];
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

export function installDesktopDriveControls() {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return () => {};
  }

  let frame = 0;
  let controllerIndex = -1;
  let restAxes: number[] = [];
  let combinedPedalAxis = -1;
  let throttleAxis = -1;
  let brakeAxis = -1;
  let lastTarget: HTMLElement | null = null;
  const active = new Set<DriveKey>();

  function releaseAll() {
    if (lastTarget) {
      for (const key of active) dispatchDriveKey(lastTarget, key, false);
    }
    active.clear();
  }

  function setKey(target: HTMLElement, key: DriveKey, down: boolean) {
    if (down === active.has(key)) return;
    dispatchDriveKey(target, key, down);
    if (down) active.add(key);
    else active.delete(key);
  }

  function resetController(gamepad: Gamepad) {
    releaseAll();
    controllerIndex = gamepad.index;
    restAxes = [...gamepad.axes];
    combinedPedalAxis = -1;
    throttleAxis = -1;
    brakeAxis = -1;
    console.info(
      `[Controls] Using ${gamepad.id} (${gamepad.axes.length} axes, ${gamepad.buttons.length} buttons, mapping: ${gamepad.mapping || 'raw'})`,
    );
  }

  function axisMoved(gamepad: Gamepad, axis: number) {
    if (axis < 0) return false;
    return Math.abs((gamepad.axes[axis] ?? 0) - (restAxes[axis] ?? 0)) > pedalThreshold;
  }

  function rawPedals(gamepad: Gamepad) {
    if (combinedPedalAxis >= 0) {
      const value = gamepad.axes[combinedPedalAxis] ?? 0;
      return {
        throttle: value > pedalThreshold,
        brake: value < -pedalThreshold,
      };
    }

    const movingAxes = gamepad.axes
      .map((value, axis) => ({
        axis,
        delta: Math.abs(value - (restAxes[axis] ?? 0)),
      }))
      .filter(({ axis, delta }) => axis !== 0 && delta > pedalThreshold)
      .sort((a, b) => b.delta - a.delta);

    if (throttleAxis < 0 && brakeAxis < 0) {
      const centered = movingAxes.find(({ axis }) => Math.abs(restAxes[axis] ?? 0) < 0.2);
      if (centered) {
        combinedPedalAxis = centered.axis;
        console.info(`[Controls] Combined pedal axis detected: ${combinedPedalAxis}`);
        const value = gamepad.axes[combinedPedalAxis] ?? 0;
        return {
          throttle: value > pedalThreshold,
          brake: value < -pedalThreshold,
        };
      }
    }

    for (const { axis } of movingAxes) {
      if (throttleAxis < 0) {
        throttleAxis = axis;
        console.info(`[Controls] Throttle axis detected: ${throttleAxis}`);
      } else if (brakeAxis < 0 && axis !== throttleAxis) {
        brakeAxis = axis;
        console.info(`[Controls] Brake axis detected: ${brakeAxis}`);
      }
    }

    return {
      throttle: axisMoved(gamepad, throttleAxis),
      brake: axisMoved(gamepad, brakeAxis),
    };
  }

  function tick() {
    const target = document.querySelector<HTMLElement>('.native-screen');
    const gamepad = target ? selectDriveController() : undefined;

    if (!target || !gamepad) {
      releaseAll();
      lastTarget = target;
      if (!gamepad) controllerIndex = -1;
      frame = requestAnimationFrame(tick);
      return;
    }

    if (lastTarget && lastTarget !== target) releaseAll();
    lastTarget = target;
    if (controllerIndex !== gamepad.index) resetController(gamepad);

    const steering = gamepad.axes[0] ?? 0;
    const pedals = gamepad.mapping === 'standard'
      ? {
          throttle: pressed(gamepad.buttons[7]),
          brake: pressed(gamepad.buttons[6]),
        }
      : rawPedals(gamepad);

    setKey(target, 'ArrowUp', pedals.throttle);
    setKey(target, 'ArrowDown', pedals.brake);
    setKey(target, 'ArrowLeft', steering < -steeringDeadzone);
    setKey(target, 'ArrowRight', steering > steeringDeadzone);

    frame = requestAnimationFrame(tick);
  }

  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    releaseAll();
  };
}
