import { ensureBundledZapperSounds } from './bundled-zapper-sounds';
import { allocateOriginalGameBuffers } from '../lib/game/allocate-game-buffers';
import { allocateOriginalRenderQueue } from '../lib/game/allocate-render-queue';
import { initializeOriginalDataSegment } from '../lib/game/initialize-data-segment';
import { initializeOriginalGameDisplayDefaults } from '../lib/game/initialize-game-display-defaults';
import {
  initializeOriginalDefaultRenderingMaterials,
  initializeOriginalRenderingState,
} from '../lib/game/initialize-rendering-state';
import { initializeOriginalTrackCoordinates } from '../lib/game/initialize-track-coordinates';
import { loadNativeSceneShapes } from '../lib/game/load-scene-shapes';

type TauriCore = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
};

type NativeInitialData = {
  modes: {
    mcga: {
      data: string;
    };
  };
};

function hexBytes(value: string) {
  const pairs = value.match(/../g) ?? [];
  return Uint8Array.from(pairs, pair => Number.parseInt(pair, 16));
}

async function readBinary(path: string) {
  const response = await fetch(`/game/${path}`);
  if (!response.ok) throw new Error(`Runtime file could not load: ${path}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function writeBinary(core: TauriCore, path: string, data: Uint8Array) {
  await core.invoke<void>('write_runtime_file', { path, data: Array.from(data) });
}

/** Builds the three fresh native memory images that were historically produced
 * by the Node build step. The portable app performs the same initialization
 * itself, so end users need neither Node.js nor Python after the EXE is built. */
export async function ensureDesktopRuntimeStartup(core: TauriCore) {
  const names = [
    'native-resource-base.bin',
    'native-render-resources.bin',
    'native-race-startup.bin',
  ];
  if ((await Promise.all(names.map(path => core.invoke<boolean>('runtime_file_exists', { path })))).every(Boolean)) {
    await ensureBundledZapperSounds(core);
    return;
  }

  const response = await fetch('/game/native-initial-data.json');
  if (!response.ok) throw new Error('Original initialized game data could not load.');
  const initial = (await response.json() as NativeInitialData).modes.mcga;

  const d = 0x2d1a0;
  const c = 0x209e0;
  let memory = new Uint8Array(0x100000);
  initializeOriginalDataSegment(memory, d, hexBytes(initial.data));

  const word = (at: number, value: number) => new DataView(memory.buffer).setUint16(at, value & 0xffff, true);

  // Fresh conventional-memory descriptors; no captured gameplay state.
  for (let i = 0; i < 64; i++) {
    word(d + 0x6d00 + i * 18 + 14, i ? 0xa000 : 0x4000);
    word(d + 0x6d00 + i * 18 + 16, i ? 0 : 2);
  }
  [0x6d00, 0x6d00, 0x716e, 0x716e].forEach((value, i) => word(d + 0x4b12 + i * 2, value));
  word(d + 0x4788, 0x4000);

  initializeOriginalGameDisplayDefaults(memory, d, 'mcga', (end, reserved) => {
    word(d + 0x4784, end - reserved);
    word(d + 0x4786, 0x4000);
    word(d + 0x478a, 0x280);
    word(d + 0x478c, d >>> 4);
  });

  for (const at of [0x5d94, 0x5db2]) {
    [0, 0xa000, 0, 0, 0, 0x5dd0, 0, 320, 0, 200, 320, 0, 320, 0, 320]
      .forEach((value, i) => word(c + at + i * 2, value));
  }
  for (let i = 0; i < 200; i++) word(c + 0x5dd0 + i * 2, i * 320);
  word(c + 0x6138, 0x613a);
  memory.set(Uint8Array.from({ length: 256 }, (_, i) => i), c + 0x711c);
  memory.set([97, 100, 0], d + 0x7460);

  initializeOriginalRenderingState(memory, d);
  initializeOriginalDefaultRenderingMaterials(memory, d);
  await writeBinary(core, 'native-resource-base.bin', memory);

  initializeOriginalTrackCoordinates(memory, d, 0xeefe);
  for (const allocate of [
    (value: Uint8Array) => allocateOriginalRenderQueue(value, d),
    (value: Uint8Array) => allocateOriginalGameBuffers(value, d, 0xeefe),
  ]) {
    const result = allocate(memory);
    if (result.error) throw new Error(result.error);
    memory = result.memory;
  }

  const filename = (at: number) => {
    let name = '';
    for (let i = 0; i < 65536; i++) {
      const byte = memory[d + ((at + i) & 0xffff)];
      if (!byte) return name.toUpperCase();
      name += String.fromCharCode(byte);
    }
    throw new Error('Unterminated original resource filename.');
  };

  const host = {
    memory: () => memory,
    writeMemory(next: Uint8Array) {
      memory = next;
    },
    async readFile(at: number) {
      return readBinary(`original-resources/${filename(at)}`);
    },
    async retry() {
      throw new Error('A required original scene resource is missing.');
    },
  };

  if (await loadNativeSceneShapes(host, d, 0xeefe)) {
    throw new Error('Not enough native scene memory.');
  }
  await writeBinary(core, 'native-render-resources.bin', memory);
  await writeBinary(core, 'native-race-startup.bin', memory);
  await ensureBundledZapperSounds(core);
}
