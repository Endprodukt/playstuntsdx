# Replay dataset probe

This directory is the staging area for offline Stunts replay analysis. It is intentionally separate from the game runtime: replay files placed here are never loaded by the game and the generated data is not used by opponent AI yet.

## First test

1. Copy one or more original `.RPL` files into `training/replays/input/`.
2. From the repository root run:

   `npm run replay:inspect`

3. Results are written to `training/replays/output/`.

For each replay the probe creates:

- `summary.json` — header/car IDs, declared input-frame count, action counts, raw input histogram and track/terrain tile histograms.
- `frames.csv` — one row per recorded 20 Hz input frame with raw byte, throttle, brake, steering direction and shift flags.
- `track.csv` — the embedded 30×30 track grid plus its horizon byte.
- `terrain.csv` — the embedded 30×30 terrain grid plus its trailing byte.

`manifest.json` summarizes every replay processed in the run.

The input and output contents are git-ignored on purpose. Only the directory placeholders and this README belong in source control.

## Sanity test

Run `npm run replay:inspect:test` to validate the decoder against a synthetic replay with known controls before testing real files.

## Scope of this first probe

This step proves that useful human control labels and embedded track data can be recovered reliably from `.RPL` files without launching PlayStunts DX. It does **not** yet reconstruct vehicle position, speed, slip, surface contact or opponent-relative state. Those will be added in the next stage by feeding the decoded input stream through the existing headless reconstructed race simulation once real replay samples confirm the raw data looks correct.
