export type CharacterGender = "male" | "female";
export type Handedness = "right" | "left";
export type FamilyIncomeTier = "strained" | "working" | "comfortable" | "wealthy";
export type FamilyStructure = "two-parent" | "single-parent" | "extended-family";
export type FamilySupport = "demanding" | "supportive" | "hands-off";
export type MindsetPreset = "obsessed" | "composed" | "electric" | "underdog";

export interface CharacterCreationInput {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: CharacterGender;
  handedness: Handedness;
  originId: string;
  familyIncome: FamilyIncomeTier;
  familyStructure: FamilyStructure;
  familySupport: FamilySupport;
  mindset: MindsetPreset;
}

export interface CharacterIdentity {
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string;
  age: number;
  gender: CharacterGender;
  handedness: Handedness;
}

export interface CharacterOrigin {
  country: "USA";
  stateCode: string;
  stateName: string;
  city: string;
  region: string;
  familyIncome: FamilyIncomeTier;
  familyStructure: FamilyStructure;
  familySupport: FamilySupport;
  neighborhoodSafety: number;
  schoolQuality: number;
  trainingAccess: number;
  medicalAccess: number;
  footballCulture: number;
}

export interface PersonalityProfile {
  preset: MindsetPreset;
  discipline: number;
  ambition: number;
  confidence: number;
  composure: number;
  coachability: number;
  adaptability: number;
  riskTolerance: number;
  approvalNeed: number;
}

export interface PhysicalProfile {
  heightInches: number;
  weightLbs: number;
  frame: "compact" | "balanced" | "long" | "powerful";
  speed: number;
  strength: number;
  agility: number;
  stamina: number;
  explosiveness: number;
}

export interface EducationProfile {
  gpa: number;
  academicAbility: number;
  attendance: number;
  eligibilityStatus: "clear" | "watch" | "at-risk";
}

export interface CharacterCondition {
  energy: number;
  fatigue: number;
  stress: number;
  confidence: number;
  health: number;
  sleepHours: number;
}

export interface CharacterState {
  identity: CharacterIdentity;
  origin: CharacterOrigin;
  personality: PersonalityProfile;
  physical: PhysicalProfile;
  education: EducationProfile;
  condition: CharacterCondition;
}
