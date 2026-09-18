# Bliss Track Editor port

Branch: `bliss-editor`

The goal is a native PlayStunts DX editor based on Bliss 2.6.1 behaviour, not a FreeBasic process embedded beside the game.

## Ported core

- 30x30 track/terrain model and exact 1802-byte TRK conversion
- Bliss transformation table, palette pages and element metadata from `xlation.dat`
- multi-tile placement/removal and continuation cells
- flood/dry/raise/lower terrain tools
- copy/cut/paste region model
- horizontal/vertical flip and 90-degree rotations
- 30-level undo/redo history
- automatic tile linking
- closed-circuit builder
- start-line, terrain and Stunts-compatibility checks
- Bliss-style route sections/paths and track validation
- binary and text SMDF metadata parsing/writing
- full 30x30 2D map renderer

## Graphics

The editor does **not** bundle Bliss `biggfx.tga`. The native map renderer composes the original editor sprites that PlayStunts DX already extracts from the user's Stunts files. This keeps the 2D map/editor self-contained without redistributing original game artwork through the repository.

## Integration

The normal Track menu's editor entry now opens the first PlayStunts DX Bliss editor shell on this branch. It currently supports:

- full-map terrain/track view and zoom
- Bliss-style visual palette pages
- original Bliss 4×5 toolbar icons
- place / erase and keyboard cursor
- Ctrl-drag selection, select-all, copy / cut / paste
- horizontal/vertical flip and clockwise/counter-clockwise rotate
- automatic link and closed-circuit creation
- flood / dry / raise / lower
- undo / redo
- F1–F12 palette switching and the Bliss tile shortcut keys
- Bliss-style shortcut help pages
- conflict/grid/debug toggles and track hash
- track information and route-analysis summaries
- track-shot export
- New / Load / Save / Save As
- desktop saves physically into `Custom Tracks` and become immediately selectable
- Bliss validation
- return to the Track menu

The existing reconstructed original editor remains in the source tree for reference/fallback while the port is completed.

## Still to port/integrate

- live Bliss paste preview/accept workflow instead of immediate paste
- Bliss colouring/annotation UI (Ctrl+O currently only toggles mode state)
- metadata editor
- scenery generator
- full detailed path/section analysis UI
- Bliss tournament integration is intentionally unresolved for PlayStunts DX
- test-drive/save-and-race flow
- reuse the same 2D renderer for the in-race left-side map panel
- regression tests against Bliss 2.6.1 for route/error edge cases
