export type ForceFeedbackTelemetry = {
  speed: number;
  roadSpeed: number;
  steeringAngle: number;
  wheelAngle: number;
  frontWheelAngle: number;
  slip: number;
  spin: number;
  sliding: boolean;
  surfaces: number[];
  allContact: number;
};

type EngineForceFeedbackTelemetry = {
  rpm: number;
  gear: number;
  shifting: boolean;
  idleRPM: number;
  maxRPM: number;
  updatedAt: number;
};

let telemetry: (ForceFeedbackTelemetry & { updatedAt: number }) | undefined;
let engineTelemetry: EngineForceFeedbackTelemetry | undefined;
let smoothedForce = 0;
let impactPulseStrength = 0;
let impactPulseStartedAt = 0;
let shiftPulseStartedAt = 0;
let menuPulseStartedAt = 0;
let enginePhase = 0;
let enginePhaseUpdatedAt = 0;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Captures the player's actual Stunts tyre/grip state before the original grip
 * routine clears its temporary slip value. No synthetic road state is inferred.
 */
export function updateForceFeedbackTelemetry(next: ForceFeedbackTelemetry) {
  telemetry = {
    ...next,
    surfaces: [...next.surfaces],
    updatedAt: Date.now(),
  };
}

/**
 * Captures the player's real engine state. A gear transition starts one short
 * tactile bump; RPM drives a deliberately slow periodic motor wobble so wheels
 * with modest DirectInput update rates do not alias or turn it into chatter.
 */
export function updateForceFeedbackEngine(
  rpm: number,
  gear: number,
  shifting: boolean,
  idleRPM: number,
  maxRPM: number,
) {
  const now = Date.now();
  const previous = engineTelemetry;
  const startedShift = !!previous && shifting && !previous.shifting;
  const changedGear = !!previous && gear !== previous.gear;
  if (previous && previous.gear > 0 && gear > 0 && (startedShift || changedGear)) {
    shiftPulseStartedAt = now;
  }
  engineTelemetry = { rpm, gear, shifting, idleRPM, maxRPM, updatedAt: now };
}

/**
 * Replaces only the wheel-contact part of the latest player sample after the
 * real track-contact pass. This keeps transient grip/slip data from stepGrip,
 * while surface rumble uses the wheel surfaces produced by the same physics tick.
 */
export function updateForceFeedbackContact(
  surfaces: number[],
  allContact: number,
  impactSpeed = 0,
) {
  if (!telemetry) return;
  const now = Date.now();
  telemetry = {
    ...telemetry,
    surfaces: [...surfaces],
    allContact,
    updatedAt: now,
  };

  // The original wheel-plane physics raises its landing flag only above
  // fallSpeed 190. Use that real fall velocity for a short landing kick.
  if (impactSpeed > 190) {
    impactPulseStrength = clamp(0.28 + (impactSpeed - 190) / 650, 0.28, 0.9);
    impactPulseStartedAt = now;
  }
}

export function triggerForceFeedbackMenuPulse() {
  menuPulseStartedAt = Date.now();
}

export function clearForceFeedbackTelemetry() {
  telemetry = undefined;
  engineTelemetry = undefined;
  smoothedForce = 0;
  impactPulseStrength = 0;
  impactPulseStartedAt = 0;
  shiftPulseStartedAt = 0;
  enginePhase = 0;
  enginePhaseUpdatedAt = 0;
}

function sampleEngineForce(now: number) {
  const state = engineTelemetry;
  if (!state || now - state.updatedAt > 250) {
    enginePhaseUpdatedAt = now;
    return 0;
  }

  const range = Math.max(1, state.maxRPM - state.idleRPM);
  const revs = clamp((state.rpm - state.idleRPM) / range, 0, 1);

  // This is intentionally a low-frequency tactile representation, not literal
  // combustion frequency. 3..6 Hz remains smooth at the ~15 ms output cadence.
  const frequency = 3 + revs * 3;
  const previousTime = enginePhaseUpdatedAt || now;
  const elapsedSeconds = clamp((now - previousTime) / 1000, 0, 0.05);
  enginePhaseUpdatedAt = now;
  enginePhase = (enginePhase + elapsedSeconds * Math.PI * 2 * frequency) % (Math.PI * 2);

  // Keep the engine underneath the steering forces: about 1.2% at idle and
  // 3% near the limiter before the user's master-strength setting is applied.
  const amplitude = 0.012 + revs * 0.018;
  return Math.sin(enginePhase) * amplitude;
}

/**
 * Returns normalized DirectInput force in the range -1..1.
 *
 * The base force is self-aligning torque opposing the driver's steering input.
 * During a slide the signed grip slip and spin pull the wheel toward the
 * counter-steer direction. Grass vibration is driven only by wheels whose real
 * contact surface is Stunts surface 4; airborne wheels unload the steering.
 */
export function sampleForceFeedback(physicalSteering: number) {
  const now = Date.now();
  const menuAge = now - menuPulseStartedAt;
  const menuForce =
    menuPulseStartedAt > 0 && menuAge >= 0 && menuAge < 80
      ? Math.sin((menuAge / 80) * Math.PI * 2) * (1 - menuAge / 80) * 0.18
      : 0;

  const shiftAge = now - shiftPulseStartedAt;
  const shiftForce =
    shiftPulseStartedAt > 0 && shiftAge >= 0 && shiftAge < 105
      ? Math.sin((shiftAge / 105) * Math.PI * 2) * (1 - shiftAge / 105) * 0.09
      : 0;
  const engineForce = sampleEngineForce(now);

  const state = telemetry;
  if (!state || now - state.updatedAt > 250) {
    smoothedForce *= 0.55;
    if (Math.abs(smoothedForce) < 0.002) smoothedForce = 0;
    return clamp(smoothedForce + menuForce + shiftForce + engineForce, -0.95, 0.95);
  }

  const mph = Math.abs(state.speed) >>> 8;
  const speed = clamp((mph - 1) / 54, 0, 1);
  const contactCount = state.surfaces.filter(surface => surface !== 0).length;
  const contact = clamp(contactCount / 4, 0, 1);
  const grassCount = state.surfaces.filter(surface => surface === 4).length;
  const grass = contactCount ? grassCount / contactCount : 0;

  // SteeringAngle's original range is -240..240. Physical steering is used for
  // the restoring component so the force follows the actual wheel position even
  // when the game is still unwinding its internal steering state.
  const centering = -clamp(physicalSteering, -1, 1) * (0.055 + 0.245 * speed) * contact;

  // stepGrip computes signed slip immediately before this telemetry is captured.
  // Keep it dominant only while the original game itself considers the car to be
  // sliding, then add the original signed spin accumulator for larger rotations.
  const slip = state.sliding ? clamp(state.slip / 180, -1, 1) : 0;
  const spin = clamp(state.spin / 96, -1, 1);
  const aligning = -(slip * 0.34 + spin * 0.20) * speed * contact;

  // Surface 4 is the same real wheel surface that Stunts' grip code treats as
  // grass/off-road. Road therefore contributes no artificial vibration here.
  const frequency = 15 + speed * 18;
  const phase = (now / 1000) * Math.PI * 2 * frequency;
  const grassRumble = Math.sin(phase) * grass * speed * 0.13 * contact;

  // Keep the current 1.8x physics tuning intact; only transient events bypass
  // the smoothing so a landing, shift or menu detent remains crisp at the wheel.
  const outputScale = 1.8;
  const target = clamp((centering + aligning + grassRumble) * outputScale, -0.90, 0.90);
  smoothedForce = smoothedForce * 0.58 + target * 0.42;

  const impactAge = now - impactPulseStartedAt;
  const impactForce =
    impactPulseStartedAt > 0 && impactAge >= 0 && impactAge < 120
      ? Math.sin((impactAge / 120) * Math.PI * 2) *
        (1 - impactAge / 120) *
        impactPulseStrength
      : 0;

  return clamp(
    smoothedForce + impactForce + shiftForce + engineForce + menuForce,
    -0.95,
    0.95,
  );
}
