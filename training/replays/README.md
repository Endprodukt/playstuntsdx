# Replay dataset probe

This directory is the staging area for offline Stunts replay analysis. It is intentionally separate from the game runtime: replay files placed here are never loaded by the game and the generated data is not used by opponent AI yet.

## First test

1. Copy one or more original `.RPL` files into `training/replays/input/`.
2. Run `npm run replay:inspect`.
3. Results are written to `training/replays/output/`.

The analyzer resolves these folders relative to the repository itself, so the default paths do not depend on the shell's current working directory.

For each replay the probe creates:

- `summary.json` — detected replay format, playback frequency, car/opponent/track IDs, frame count, action counts, raw input histogram and track/terrain tile histograms.
- `frames.csv` — one row per recorded input tick with timestamp, raw byte, throttle, brake, steering direction and shift flags.
- `track.csv` — the embedded 30×30 track grid plus its horizon byte.
- `terrain.csv` — the embedded 30×30 terrain grid plus its trailing byte.

`manifest.json` summarizes every replay processed in the run.

Both known Stunts replay layouts are supported: the older 24-byte header and the common 1991+ 26-byte header. The latter stores playback frequency and replay tick count as separate words and begins its input stream at offset `0x724`.

The input and output contents are git-ignored on purpose. Only the directory placeholders and this README belong in source control.

## Sanity test

Run `npm run replay:inspect:test` to validate both replay layouts against synthetic recordings with known controls.

## Scope of this first probe

This step proves that useful human control labels and embedded track data can be recovered reliably from `.RPL` files without launching PlayStunts DX. It does **not** yet reconstruct vehicle position, speed, slip, surface contact or opponent-relative state. Those come next by feeding the decoded input stream through the existing headless reconstructed race simulation after the raw exports from real competition replays have been checked.
