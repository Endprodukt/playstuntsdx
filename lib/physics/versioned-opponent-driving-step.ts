import {physicsVersion} from './physics-version.ts';
import {opponentDrivingStep as mindscape1990OpponentDrivingStep} from './opponent-driving-step.ts';
import {opponentDrivingStep as broderbund1991OpponentDrivingStep} from './broderbund-1991/opponent-driving-step.ts';

/** Version gate only. Existing Mindscape opponent physics remains untouched. */
export function versionedOpponentDrivingStep(...args:Parameters<typeof mindscape1990OpponentDrivingStep>):ReturnType<typeof mindscape1990OpponentDrivingStep>{
 return physicsVersion()==='broderbund-1991'?broderbund1991OpponentDrivingStep(...args):mindscape1990OpponentDrivingStep(...args);
}
