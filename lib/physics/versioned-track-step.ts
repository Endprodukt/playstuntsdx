import {physicsVersion} from './physics-version.ts';
import {stepTrack as stepMindscape1990Track} from './track-step.ts';
import {stepTrack as stepBroderbund1991Track} from './broderbund-1991/track-step.ts';

/** Version gate only. The two physics implementations remain separate. */
export function stepVersionedTrack(...args:Parameters<typeof stepMindscape1990Track>):ReturnType<typeof stepMindscape1990Track>{
 return physicsVersion()==='broderbund-1991'?stepBroderbund1991Track(...args):stepMindscape1990Track(...args);
}
