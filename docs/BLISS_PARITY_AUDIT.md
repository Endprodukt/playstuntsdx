# Bliss parity audit

Reference: Bliss 2.6.1 behaviour/source-derived routines already ported into this branch, plus the Bliss 2.5.8/2.6 user manual for UI semantics.

## File menu
- New: Bliss-style Select Terrain dialog with 28 named choices. The three empty terrains and five original Stunts presets use canonical game data; the remaining named layouts are currently reconstructed from Bliss terrain primitives pending the authoritative Bliss preset bytes.
- Save / Save As: functional. Desktop writes the physical TRK into `Custom Tracks`. Bliss one-file metadata tails (up to 13802 bytes total) are preserved in the physical file while gameplay consumes the standard first 1802 bytes.
- Load: functional for TRK files currently visible to PlayStunts DX. Loading tracks from RPL files is pending.
- Exit: functional.

## Selection menu
- Select icon: now activates selection exactly like holding Ctrl.
- Ctrl-drag / Ctrl+arrows: functional.
- Ctrl+W: whole-grid selection / deselection.
- Copy: always captures both track and terrain layers.
- Cut/Delete: obey TRK/TER layer switches.
- Paste: now enters Bliss-style hovering paste mode instead of applying immediately.
- Hovering paste can be moved before release, transformed with F/Shift+F/R/Shift+R, and has live TRK/TER preview.
- Left click or Enter releases paste. Escape cancels it.

## Transformation menu
- Shortcut F / Shift+F / R / Shift+R:
  - selection active -> transforms selection;
  - hovering paste -> transforms clipboard;
  - otherwise -> transforms current element.
- Toolbar transform icons:
  - selection active -> transforms selection;
  - hovering paste -> transforms clipboard;
  - otherwise -> transforms the whole 30x30 track, matching Bliss.
- In-place selection rotation requires a square selection. Bliss' interactive X/Y correction prompt is still pending.

## Undo / redo
- 30-history snapshot depth.
- Mouse painting is now grouped as one Bliss-style stroke, so one Undo reverses a complete held-button stroke rather than one tile.

## Palette / keyboard
- F1..F12 select the 12 palette pages.
- F1 while page 1 is already active opens Help, matching Bliss.
- Tab switches grid/palette keyboard focus.
- Arrow keyboard cursor and Enter/Delete editing work.
- P / middle mouse picks the element under the cursor.
- M changes road material on pages 1-3.
- Type shortcuts and reverse-with-Shift use the Bliss SmartSelect logic.
- U auto-links the empty tile under the cursor.
- Backslash in MAN mode now uses Bliss' question-mark / two-hex-digit / 3-second input flow.

## Terrain
- F11 is direct terrain-tile editing.
- F12 is now the Bliss mouse-only terrain brush:
  - Water: left floods, right dries.
  - Mountain: left raises, right lowers.
- Background/scenery (Desert/Tropical/Alpine/City/Country) is permanently selectable and does not reset the track. Selector previews are rendered from original low-resolution Stunts panorama resources.

## Switch bar
- CLIP: indicates clipboard state and clears it when clicked.
- WAR / Ctrl+D: warning overlay toggle. All detected warning cells are now shown, not only the first.
- MAN / Ctrl+E: manual/conflict-generating editing.
- GRID / Ctrl+G: toggles the grid. Grid removal now strips the actual final pixel of each 16x16 cell rather than duplicating the seam.
- TRK / Ctrl+K and TER / Ctrl+T: paste/delete layer control and live hovering-paste preview.
- DEB / Ctrl+Q: raw track/terrain codes are shown. Bliss filler-arrow artwork and its exact decomposed visual style are still pending.
- TRK SHOT / Ctrl+S: exports the whole map or only the active selection. PNG is used by PlayStunts DX; Bliss' BMP/TGA selector is not yet ported.
- COL / Ctrl+O: disabled until the real Bliss colouration/annotation workflow is ported.

## Track tools
- Auto-link: source-derived LinkTiles port.
- Closed circuit / Enter on selection: source-derived BuildClosedCircuit port, including repeated-corner switching logic.
- Check Track / C: source-derived start, terrain, route-section and path validation.
- Track Analysis: real route/path/error analysis is active with sections, winning/safe paths, cycles, tile lengths, opponent shortest-path choice, and a See Paths dialog. Bliss' source-specific racer-time coefficient/calibration tables are still pending.

## Advanced menu tools
- Track Information: functional title/author/comment/championship editor with creation date and accumulated editing time. Metadata is preserved in Bliss one-file tracks.
- Automatic scenery generator: functional percentages, Everywhere/By the road/On water placement, by-road-first generation, orientation, and keep/erase-existing modes. The manual does not publish Bliss' exact per-landscape default percentage table, so the current default percentages remain a DX reconstruction pending the authoritative source constants.
- Tournaments: functional Bliss-compatible tournament list, Add/Save/Remove/Connect flow, tour.cfg parsing, race details, scoreboard parsing, and Get Track. Tournament definitions persist locally.
- Full Settings dialog remains pending.

