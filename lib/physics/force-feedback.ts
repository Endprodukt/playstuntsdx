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

let telemetry: (ForceFeedbackTelemetry & { updatedAt: number }) | undefined;
let smoothedForce = 0;
let impactPulseStrength = 0;
let impactPulseStartedAt = 0;
let menuPulseStartedAt = 0;

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
  smoothedForce = 0;
  impactPulseStrength = 0;
  impactPulseStartedAt = 0;
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

  const state = telemetry;
  if (!state || now - state.updatedAt > 250) {
    smoothedForce *= 0.55;
    if (Math.abs(smoothedForce) < 0.002) smoothedForce = 0;
    return clamp(smoothedForce + menuForce, -0.95, 0.95);
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
  // the smoothing so a landing or menu detent remains crisp at the wheel.
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

  return clamp(smoothedForce + impactForce + menuForce, -0.95, 0.95);
}
