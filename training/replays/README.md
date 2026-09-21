# Replay dataset probe

This directory is the staging area for offline Stunts replay analysis. Replay files placed here are never loaded by the visible game and generated data is not used by opponent AI yet.

## 1. Decode the raw replay

1. Copy one or more original `.RPL` files into `training/replays/input/`.
2. Run `npm run replay:inspect`.
3. Results are written to `training/replays/output/`.

The raw probe creates `summary.json`, `frames.csv`, `track.csv` and `terrain.csv`. Both known Stunts layouts are supported: the older 24-byte layout and the common 26-byte layout that stores playback frequency and frame count separately.

## Custom cars

For replay-only training data, place any required custom-car physics files in `training/replays/cars/`. The filename must match the four-character replay car ID: for example replay ID `OXIA` requires `CAROXIA.RES`. Only the `.RES` file is needed for headless physics; graphics files are not required.

The simulator searches, in order: `training/replays/cars/`, the repo's `Custom Cars/` directory, the prepared game's `setup-media/`, and `original-resources/`. Subfolders are searched too. You can override the replay-car folder with `--cars`.

## 2. Headless physics probe

Run:

`npm run replay:simulate`

The simulator replays the recorded human controls through PlayStunts DX's reconstructed Stunts physics without opening the game window. It looks for prepared game data in:

- `local-assets/prepared/game`
- `public/game`

If your prepared game directory lives elsewhere:

`npm run replay:simulate -- --game "C:\\full\\path\\to\\game"`

For a separate custom-car archive:

`npm run replay:simulate -- --cars "D:\\StuntsCars"`

For every supported replay it adds:

- `telemetry.csv` — one observation/action row per replay frame: position, orientation, speed, RPM, gear, steering state, grip/load values, wheel surfaces, grass/air contact, crash state, route progress and the human input for that frame.
- `simulation-summary.json` — start/final state and quick sanity metrics.
- `simulation-manifest.json` — summary of the complete run.

The first physics probe deliberately accepts solo replays only. Competition replays with no opponent are the cleanest validation source; opponent playback will be added after this baseline is confirmed.

A particularly important sanity field is `raceClockMatchesFrames`. For a healthy full replay rollout it should normally be `true`. Position/speed traces should also vary continuously rather than remaining fixed.

## Tests

- `npm run replay:inspect:test` validates the raw analyzer.
- `npm run replay:file:test` validates both central replay layouts and round-trip encoding.

Input and generated output contents remain git-ignored.
