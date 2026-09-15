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

type ForceFeedbackConfig = {
  physicsStrength: number;
  physicsLimit: number;
  maxForce: number;
  centeringBase: number;
  centeringSpeed: number;
  truckStrength: number;
  slideSlip: number;
  slideSpin: number;
  grassStrength: number;
  grassFrequencyMin: number;
  grassFrequencyMax: number;
  landingMinFallSpeed: number;
  landingMaxFallSpeed: number;
  landingMinStrength: number;
  landingMaxStrength: number;
  landingDurationMs: number;
  shiftStrength: number;
  shiftDurationMs: number;
  engineMinStrength: number;
  engineMaxStrength: number;
  engineFrequencyMin: number;
  engineFrequencyMax: number;
  crashMinStrength: number;
  crashMaxStrength: number;
  crashSpeedForMax: number;
  crashReboundStrength: number;
  crashMainDurationMs: number;
  crashTotalDurationMs: number;
  menuStrength: number;
  menuDurationMs: number;
  menuRepeatMs: number;
};

const defaultConfig: ForceFeedbackConfig = {
  physicsStrength: 1.8,
  physicsLimit: 0.90,
  maxForce: 0.98,
  centeringBase: 0.055,
  centeringSpeed: 0.245,
  truckStrength: 1,
  slideSlip: 0.34,
  slideSpin: 0.20,
  grassStrength: 0.13,
  grassFrequencyMin: 15,
  grassFrequencyMax: 33,
  landingMinFallSpeed: 190,
  landingMaxFallSpeed: 593,
  landingMinStrength: 0.28,
  landingMaxStrength: 0.90,
  landingDurationMs: 120,
  shiftStrength: 0.15,
  shiftDurationMs: 110,
  engineMinStrength: 0.008,
  engineMaxStrength: 0.020,
  engineFrequencyMin: 3,
  engineFrequencyMax: 6,
  crashMinStrength: 0.72,
  crashMaxStrength: 1,
  crashSpeedForMax: 70,
  crashReboundStrength: 0.32,
  crashMainDurationMs: 150,
  crashTotalDurationMs: 240,
  menuStrength: 0.24,
  menuDurationMs: 90,
  menuRepeatMs: 190,
};

let config: ForceFeedbackConfig = { ...defaultConfig };
let telemetry: (ForceFeedbackTelemetry & { updatedAt: number }) | undefined;
let engineTelemetry: EngineForceFeedbackTelemetry | undefined;
let smoothedForce = 0;
let impactPulseStrength = 0;
let impactPulseStartedAt = 0;
let crashPulseStrength = 0;
let crashPulseDirection = 1;
let crashPulseStartedAt = 0;
let shiftPulseStartedAt = 0;
let menuPulseStartedAt = 0;
let enginePhase = 0;
let enginePhaseUpdatedAt = 0;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function parseIni(content: string) {
  const values = new Map<string, string>();
  let section = '';
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].trim().toLowerCase();
      continue;
    }
    const equals = line.indexOf('=');
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim().toLowerCase();
    const value = line.slice(equals + 1).split(/[;#]/, 1)[0].trim();
    values.set(`${section}.${key}`, value);
  }
  return values;
}

function iniNumber(
  values: Map<string, string>,
  section: string,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(values.get(`${section.toLowerCase()}.${key.toLowerCase()}`));
  return clamp(Number.isFinite(parsed) ? parsed : fallback, min, max);
}

/**
 * Applies the human-readable ffb.ini. Percent values in the file are converted
 * to normalized DirectInput force here, while every setting is clamped to its
 * documented safe range. Missing or malformed values fall back independently.
 */
export function applyForceFeedbackIni(content: string) {
  const values = parseIni(content);
  const percent = (section: string, key: string, fallback: number, min = 0, max = 100) =>
    iniNumber(values, section, key, fallback * 100, min, max) / 100;

  const next: ForceFeedbackConfig = {
    physicsStrength: percent('General', 'PhysicsStrength', defaultConfig.physicsStrength, 0, 300),
    physicsLimit: percent('General', 'PhysicsLimit', defaultConfig.physicsLimit, 10, 100),
    maxForce: percent('General', 'MaxForce', defaultConfig.maxForce, 10, 100),
    centeringBase: percent('Centering', 'BaseForce', defaultConfig.centeringBase),
    centeringSpeed: percent('Centering', 'SpeedForce', defaultConfig.centeringSpeed),
    truckStrength: percent('Centering', 'TruckStrength', defaultConfig.truckStrength, 0, 150),
    slideSlip: percent('Slide', 'SlipForce', defaultConfig.slideSlip),
    slideSpin: percent('Slide', 'SpinForce', defaultConfig.slideSpin),
    grassStrength: percent('Grass', 'Strength', defaultConfig.grassStrength),
    grassFrequencyMin: iniNumber(values, 'Grass', 'FrequencyMin', defaultConfig.grassFrequencyMin, 1, 30),
    grassFrequencyMax: iniNumber(values, 'Grass', 'FrequencyMax', defaultConfig.grassFrequencyMax, 1, 40),
    landingMinFallSpeed: iniNumber(values, 'Landing', 'MinFallSpeed', defaultConfig.landingMinFallSpeed, 0, 1000),
    landingMaxFallSpeed: iniNumber(values, 'Landing', 'MaxFallSpeed', defaultConfig.landingMaxFallSpeed, 1, 2000),
    landingMinStrength: percent('Landing', 'MinStrength', defaultConfig.landingMinStrength),
    landingMaxStrength: percent('Landing', 'MaxStrength', defaultConfig.landingMaxStrength),
    landingDurationMs: iniNumber(values, 'Landing', 'DurationMs', defaultConfig.landingDurationMs, 30, 300),
    shiftStrength: percent('GearShift', 'Strength', defaultConfig.shiftStrength),
    shiftDurationMs: iniNumber(values, 'GearShift', 'DurationMs', defaultConfig.shiftDurationMs, 30, 250),
    engineMinStrength: percent('Engine', 'MinStrength', defaultConfig.engineMinStrength, 0, 30),
    engineMaxStrength: percent('Engine', 'MaxStrength', defaultConfig.engineMaxStrength, 0, 30),
    engineFrequencyMin: iniNumber(values, 'Engine', 'FrequencyMin', defaultConfig.engineFrequencyMin, 1, 10),
    engineFrequencyMax: iniNumber(values, 'Engine', 'FrequencyMax', defaultConfig.engineFrequencyMax, 2, 12),
    crashMinStrength: percent('Crash', 'MinStrength', defaultConfig.crashMinStrength),
    crashMaxStrength: percent('Crash', 'MaxStrength', defaultConfig.crashMaxStrength),
    crashSpeedForMax: iniNumber(values, 'Crash', 'SpeedForMaxMph', defaultConfig.crashSpeedForMax, 10, 200),
    crashReboundStrength: percent('Crash', 'ReboundStrength', defaultConfig.crashReboundStrength),
    crashMainDurationMs: iniNumber(values, 'Crash', 'MainDurationMs', defaultConfig.crashMainDurationMs, 30, 300),
    crashTotalDurationMs: iniNumber(values, 'Crash', 'TotalDurationMs', defaultConfig.crashTotalDurationMs, 60, 500),
    menuStrength: percent('Menu', 'DetentStrength', defaultConfig.menuStrength),
    menuDurationMs: iniNumber(values, 'Menu', 'DetentDurationMs', defaultConfig.menuDurationMs, 20, 200),
    menuRepeatMs: iniNumber(values, 'Menu', 'RepeatMs', defaultConfig.menuRepeatMs, 80, 500),
  };

  next.grassFrequencyMax = Math.max(next.grassFrequencyMin, next.grassFrequencyMax);
  next.landingMaxFallSpeed = Math.max(next.landingMinFallSpeed + 1, next.landingMaxFallSpeed);
  next.landingMaxStrength = Math.max(next.landingMinStrength, next.landingMaxStrength);
  next.engineMaxStrength = Math.max(next.engineMinStrength, next.engineMaxStrength);
  next.engineFrequencyMax = Math.max(next.engineFrequencyMin, next.engineFrequencyMax);
  next.crashMaxStrength = Math.max(next.crashMinStrength, next.crashMaxStrength);
  next.crashTotalDurationMs = Math.max(next.crashMainDurationMs + 20, next.crashTotalDurationMs);
  config = next;
}

export function forceFeedbackMenuDurationMs() {
  return config.menuDurationMs;
}

export function forceFeedbackMenuRepeatMs() {
  return config.menuRepeatMs;
}

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

/** True only while the player-car physics is actively producing fresh samples. */
export function forceFeedbackDrivingActive() {
  return !!telemetry && Date.now() - telemetry.updatedAt <= 250;
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
 * A crash speed is supplied only for a newly accepted original crash impact.
 */
export function updateForceFeedbackContact(
  surfaces: number[],
  allContact: number,
  impactSpeed = 0,
  crashSpeed?: number,
) {
  if (!telemetry) return;
  const now = Date.now();
  telemetry = {
    ...telemetry,
    surfaces: [...surfaces],
    allContact,
    updatedAt: now,
  };

  if (impactSpeed > config.landingMinFallSpeed) {
    const span = config.landingMaxFallSpeed - config.landingMinFallSpeed;
    const amount = clamp((impactSpeed - config.landingMinFallSpeed) / span, 0, 1);
    impactPulseStrength =
      config.landingMinStrength + amount * (config.landingMaxStrength - config.landingMinStrength);
    impactPulseStartedAt = now;
  }

  if (crashSpeed !== undefined) {
    const mph = Math.abs(crashSpeed) >>> 8;
    const amount = clamp(mph / config.crashSpeedForMax, 0, 1);
    crashPulseStrength =
      config.crashMinStrength + amount * (config.crashMaxStrength - config.crashMinStrength);
    const directionSource =
      telemetry.spin || telemetry.slip || telemetry.frontWheelAngle || telemetry.steeringAngle;
    crashPulseDirection = directionSource ? -Math.sign(directionSource) : 1;
    crashPulseStartedAt = now;
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
  crashPulseStrength = 0;
  crashPulseDirection = 1;
  crashPulseStartedAt = 0;
  shiftPulseStartedAt = 0;
  menuPulseStartedAt = 0;
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
  const frequency = config.engineFrequencyMin +
    revs * (config.engineFrequencyMax - config.engineFrequencyMin);
  const previousTime = enginePhaseUpdatedAt || now;
  const elapsedSeconds = clamp((now - previousTime) / 1000, 0, 0.05);
  enginePhaseUpdatedAt = now;
  enginePhase = (enginePhase + elapsedSeconds * Math.PI * 2 * frequency) % (Math.PI * 2);

  const amplitude = config.engineMinStrength +
    revs * (config.engineMaxStrength - config.engineMinStrength);
  return Math.sin(enginePhase) * amplitude;
}

/** Returns normalized DirectInput force in the range -1..1. */
export function sampleForceFeedback(physicalSteering: number) {
  const now = Date.now();
  const menuAge = now - menuPulseStartedAt;
  const menuForce =
    menuPulseStartedAt > 0 && menuAge >= 0 && menuAge < config.menuDurationMs
      ? Math.sin((menuAge / config.menuDurationMs) * Math.PI * 2) *
        (1 - menuAge / config.menuDurationMs) * config.menuStrength
      : 0;

  const shiftAge = now - shiftPulseStartedAt;
  const shiftForce =
    shiftPulseStartedAt > 0 && shiftAge >= 0 && shiftAge < config.shiftDurationMs
      ? Math.sin((shiftAge / config.shiftDurationMs) * Math.PI * 2) *
        (1 - shiftAge / config.shiftDurationMs) * config.shiftStrength
      : 0;
  const engineForce = sampleEngineForce(now);

  const state = telemetry;
  if (!state || now - state.updatedAt > 250) {
    smoothedForce *= 0.55;
    if (Math.abs(smoothedForce) < 0.002) smoothedForce = 0;
    return clamp(smoothedForce + menuForce + shiftForce + engineForce, -config.maxForce, config.maxForce);
  }

  // Stunts stores speed with 8 fractional bits. Preserve those fractional bits
  // so speed-sensitive steering force ramps continuously instead of in 1 mph steps.
  const mph = Math.abs(state.speed) / 256;
  const speed = clamp((mph - 1) / 54, 0, 1);
  const contactCount = state.surfaces.filter(surface => surface !== 0).length;
  const contact = clamp(contactCount / 4, 0, 1);
  const grassCount = state.surfaces.filter(surface => surface === 4).length;
  const grass = contactCount ? grassCount / contactCount : 0;

  const stationaryWithoutRoadContact =
    contactCount === 0 && Math.abs(state.speed) < 256 && Math.abs(state.roadSpeed) < 256;
  const centeringLoad = stationaryWithoutRoadContact ? config.truckStrength : contact;
  const centering =
    -clamp(physicalSteering, -1, 1) *
    (config.centeringBase + config.centeringSpeed * speed) * centeringLoad;

  const slip = state.sliding ? clamp(state.slip / 180, -1, 1) : 0;
  const spin = clamp(state.spin / 96, -1, 1);
  const aligning = -(slip * config.slideSlip + spin * config.slideSpin) * speed * contact;

  const frequency = config.grassFrequencyMin +
    speed * (config.grassFrequencyMax - config.grassFrequencyMin);
  const phase = (now / 1000) * Math.PI * 2 * frequency;
  const grassRumble = Math.sin(phase) * grass * speed * config.grassStrength * contact;

  const target = clamp(
    (centering + aligning + grassRumble) * config.physicsStrength,
    -config.physicsLimit,
    config.physicsLimit,
  );
  smoothedForce = smoothedForce * 0.58 + target * 0.42;

  const impactAge = now - impactPulseStartedAt;
  const impactForce =
    impactPulseStartedAt > 0 && impactAge >= 0 && impactAge < config.landingDurationMs
      ? Math.sin((impactAge / config.landingDurationMs) * Math.PI * 2) *
        (1 - impactAge / config.landingDurationMs) * impactPulseStrength
      : 0;

  const crashAge = now - crashPulseStartedAt;
  let crashForce = 0;
  if (crashPulseStartedAt > 0 && crashAge >= 0 && crashAge < config.crashTotalDurationMs) {
    if (crashAge < config.crashMainDurationMs) {
      crashForce =
        Math.sin((crashAge / config.crashMainDurationMs) * Math.PI) *
        crashPulseStrength * crashPulseDirection;
    } else {
      const reboundDuration = config.crashTotalDurationMs - config.crashMainDurationMs;
      crashForce =
        -Math.sin(((crashAge - config.crashMainDurationMs) / reboundDuration) * Math.PI) *
        crashPulseStrength * crashPulseDirection * config.crashReboundStrength;
    }
  }

  return clamp(
    smoothedForce + impactForce + crashForce + shiftForce + engineForce + menuForce,
    -config.maxForce,
    config.maxForce,
  );
}
