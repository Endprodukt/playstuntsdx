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

- full-map terrain/track view
- track-piece palette pages
- place / erase
- automatic link
- flood / dry / raise / lower
- brush rotate / horizontal flip
- undo / redo
- Bliss validation
- save back to the current TRK
- return to the Track menu

The existing reconstructed original editor remains in the source tree for reference/fallback while the port is completed.

## Still to port/integrate

- full selection/clipboard UI and Bliss colour annotations
- New / Load / Save As dialogs
- metadata editor
- all Bliss keyboard/mouse shortcuts and convenience tools
- detailed analysis/path UI
- track-shot export
- test-drive/save-and-race flow
- reuse the same 2D renderer for the in-race left-side map panel
- regression tests against Bliss 2.6.1 for route/error edge cases
