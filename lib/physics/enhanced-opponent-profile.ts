export type EnhancedOpponentPreferredSide=-1|0|1;
export interface EnhancedOpponentProfile {
 id:number;
 name:string;
 aggression:number;
 brakingMargin:number;
 reaction:number;
 overtakeThreshold:number;
 risk:number;
 cornerSpeed:number;
 straightSpeed:number;
 defensiveDriving:number;
 preferredSide:EnhancedOpponentPreferredSide;
 mistakeRate:number;
 recoverySkill:number;
 stuntConfidence:number;
 lookAhead:number;
 linePrecision:number;
}

/**
 * DX opponent personalities. Values are deliberately data-only so a future
 * character designer can serialize the same shape for custom opponents.
 */
export const DEFAULT_ENHANCED_OPPONENT_PROFILE:EnhancedOpponentProfile={
 id:0,name:'Custom Driver',aggression:.60,brakingMargin:.98,reaction:.78,overtakeThreshold:.62,risk:.58,cornerSpeed:1.00,straightSpeed:1.00,defensiveDriving:.45,preferredSide:0,mistakeRate:.06,recoverySkill:.78,stuntConfidence:.78,lookAhead:8,linePrecision:.82,
};

export const ENHANCED_OPPONENT_PROFILES:ReadonlyArray<EnhancedOpponentProfile>=[
 {id:1,name:"Squealin' Bernie Rubber",aggression:.22,brakingMargin:1.18,reaction:.42,overtakeThreshold:.28,risk:.22,cornerSpeed:.82,straightSpeed:.90,defensiveDriving:.12,preferredSide:0,mistakeRate:.15,recoverySkill:.58,stuntConfidence:.52,lookAhead:4,linePrecision:.52},
 {id:2,name:'Herr Otto Partz',aggression:.50,brakingMargin:1.02,reaction:.68,overtakeThreshold:.52,risk:.44,cornerSpeed:.94,straightSpeed:1.08,defensiveDriving:.34,preferredSide:-1,mistakeRate:.08,recoverySkill:.66,stuntConfidence:.34,lookAhead:7,linePrecision:.72},
 {id:3,name:"Smokin' Joe Stallin",aggression:.56,brakingMargin:.96,reaction:.84,overtakeThreshold:.58,risk:.52,cornerSpeed:1.10,straightSpeed:.96,defensiveDriving:.42,preferredSide:0,mistakeRate:.05,recoverySkill:.82,stuntConfidence:.76,lookAhead:10,linePrecision:.93},
 {id:4,name:'Cherry Chassis',aggression:.78,brakingMargin:.88,reaction:.72,overtakeThreshold:.76,risk:.80,cornerSpeed:.91,straightSpeed:1.14,defensiveDriving:.30,preferredSide:1,mistakeRate:.09,recoverySkill:.72,stuntConfidence:.82,lookAhead:7,linePrecision:.72},
 {id:5,name:'Helen Wheels',aggression:.94,brakingMargin:.86,reaction:.72,overtakeThreshold:.88,risk:.96,cornerSpeed:1.00,straightSpeed:1.07,defensiveDriving:.88,preferredSide:0,mistakeRate:.12,recoverySkill:.84,stuntConfidence:.90,lookAhead:8,linePrecision:.68},
 {id:6,name:'Skid Vicious',aggression:.82,brakingMargin:.92,reaction:1.00,overtakeThreshold:.86,risk:.82,cornerSpeed:1.12,straightSpeed:1.12,defensiveDriving:.70,preferredSide:-1,mistakeRate:.02,recoverySkill:1.00,stuntConfidence:1.00,lookAhead:12,linePrecision:1.00},
];

export function enhancedOpponentProfile(id:number){
 return ENHANCED_OPPONENT_PROFILES.find(profile=>profile.id===(id&255))??{...DEFAULT_ENHANCED_OPPONENT_PROFILE,id:id&255};
}
