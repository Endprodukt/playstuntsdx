export type RaceGraphicsTransition='original'|'hold'|'enhanced';

/** Keep the last presented frame while a requested DX race scene is prepared.
 * Painting the native world during that gap exposes one original frame. */
export function raceGraphicsTransition(enabled:boolean,ready:boolean,failed:boolean):RaceGraphicsTransition{
 if(!enabled||failed)return 'original';
 return ready?'enhanced':'hold';
}
