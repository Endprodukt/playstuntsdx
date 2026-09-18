# Bliss track-editor port

PlayStunts DX is porting editor behaviour from **Bliss 2.6.1**, written by Lucas Pedrosa (2016-2023).

The TypeScript files under `lib/game/bliss-*` are a native reimplementation of Bliss behaviour. The compact numeric table in `bliss-transformations.ts` is generated from the non-graphical geometry/rotation fields in Bliss 2.6.1 `xlation.dat`.

Bliss is GPL version 3 software. PlayStunts DX is GPL-3.0-only; see the repository root `LICENSE` and `THIRD_PARTY_NOTICES.md`.

`biggfx.tga` is intentionally **not** redistributed here. It contains editor artwork whose provenance is separate from the editor code. PlayStunts DX will source or derive the visual tiles from the user's own Stunts game data instead of bundling Bliss' graphics atlas.
