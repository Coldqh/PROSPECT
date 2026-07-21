import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 3;

const gameDateSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

const personalitySchema = z.object({
  preset: z.enum(["obsessed", "composed", "electric", "underdog"]),
  discipline: z.number().min(0).max(100),
  ambition: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  composure: z.number().min(0).max(100),
  coachability: z.number().min(0).max(100),
  adaptability: z.number().min(0).max(100),
  riskTolerance: z.number().min(0).max(100),
  approvalNeed: z.number().min(0).max(100),
});

const characterSchema = z.object({
  identity: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    fullName: z.string().min(3),
    birthDate: z.string().min(10),
    age: z.number().int().min(15).max(22),
    gender: z.enum(["male", "female"]),
    handedness: z.enum(["right", "left"]),
  }),
  origin: z.object({
    country: z.literal("USA"),
    stateCode: z.string().length(2),
    stateName: z.string().min(2),
    city: z.string().min(2),
    region: z.string().min(2),
    familyIncome: z.enum(["strained", "working", "comfortable", "wealthy"]),
    familyStructure: z.enum(["two-parent", "single-parent", "extended-family"]),
    familySupport: z.enum(["demanding", "supportive", "hands-off"]),
    neighborhoodSafety: z.number().min(0).max(100),
    schoolQuality: z.number().min(0).max(100),
    trainingAccess: z.number().min(0).max(100),
    medicalAccess: z.number().min(0).max(100),
    footballCulture: z.number().min(0).max(100),
  }),
  personality: personalitySchema,
  physical: z.object({
    heightInches: z.number().int().min(60).max(84),
    weightLbs: z.number().int().min(130).max(360),
    frame: z.enum(["compact", "balanced", "long", "powerful"]),
    speed: z.number().min(0).max(100),
    strength: z.number().min(0).max(100),
    agility: z.number().min(0).max(100),
    stamina: z.number().min(0).max(100),
    explosiveness: z.number().min(0).max(100),
  }),
  education: z.object({
    gpa: z.number().min(0).max(4),
    academicAbility: z.number().min(0).max(100),
    attendance: z.number().min(0).max(100),
    eligibilityStatus: z.enum(["clear", "watch", "at-risk"]),
  }),
  condition: z.object({
    energy: z.number().min(0).max(100),
    fatigue: z.number().min(0).max(100),
    stress: z.number().min(0).max(100),
    confidence: z.number().min(0).max(100),
    health: z.number().min(0).max(100),
    sleepHours: z.number().min(0).max(24),
  }),
});

const schoolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  shortName: z.string().min(2),
  mascot: z.string().min(2),
  city: z.string().min(2),
  stateCode: z.string().length(2),
  primaryColor: z.string().min(4),
  secondaryColor: z.string().min(4),
  prestige: z.number().min(0).max(100),
  facilities: z.number().min(0).max(100),
  coaching: z.number().min(0).max(100),
  medicine: z.number().min(0).max(100),
  discipline: z.number().min(0).max(100),
  youthTrust: z.number().min(0).max(100),
  philosophy: z.string().min(2),
});

const footballSchema = z.object({
  moduleVersion: z.literal(2),
  worldSeed: z.string().min(1),
  stage: z.literal("high-school-preseason"),
  position: z.enum(["QB", "RB", "WR", "LB", "CB"]),
  archetypeId: z.string().min(1),
  archetypeName: z.string().min(1),
  jerseyNumber: z.number().int().min(0).max(99),
  ratings: z.object({
    overall: z.number().min(0).max(100),
    potentialBand: z.enum(["role-player", "starter", "high-upside", "national-ceiling"]),
    athleticism: z.number().min(0).max(100),
    technique: z.number().min(0).max(100),
    footballIq: z.number().min(0).max(100),
    competitiveness: z.number().min(0).max(100),
  }),
  school: schoolSchema,
  depthChart: z.object({
    rank: z.number().int().min(1),
    playersAtPosition: z.number().int().min(1),
    coachTrust: z.number().min(0).max(100),
    projectedRole: z.enum(["starter", "rotation", "special-teams", "developmental"]),
    directRival: z.object({
      id: z.string().min(1),
      name: z.string().min(3),
      year: z.enum(["Senior", "Junior"]),
      overall: z.number().min(0).max(100),
      style: z.string().min(2),
    }),
  }),
  season: z.object({
    year: z.number().int().min(2000),
    phase: z.literal("preseason"),
    week: z.number().int().nonnegative(),
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    nextOpponent: z.object({
      id: z.string().min(1),
      name: z.string().min(2),
      record: z.string().min(1),
      threat: z.string().min(2),
    }),
  }),
  recruitment: z.object({
    visibility: z.number().min(0).max(100),
    interestedPrograms: z.number().int().nonnegative(),
    offers: z.number().int().nonnegative(),
    regionalRankLabel: z.string().min(2),
  }),
});

const focusSchema = z.object({
  training: z.number().min(0).max(100),
  recovery: z.number().min(0).max(100),
  study: z.number().min(0).max(100),
  social: z.number().min(0).max(100),
});

const dayDeltaSchema = z.object({
  energy: z.number(),
  fatigue: z.number(),
  stress: z.number(),
  confidence: z.number(),
  health: z.number(),
  gpa: z.number(),
  coachTrust: z.number(),
  overall: z.number(),
});

const dayOutcomeSchema = z.object({
  id: z.string().min(1),
  date: gameDateSchema,
  grade: z.enum(["A", "B", "C", "D"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  highlights: z.array(z.string().min(1)),
  deltas: dayDeltaSchema,
});

const lifeSchema = z.object({
  moduleVersion: z.literal(1),
  weekNumber: z.number().int().min(1),
  dayIndex: z.number().int().min(0).max(6),
  completedDays: z.number().int().nonnegative(),
  weeklyPlan: z.object({
    templateId: z.enum(["balanced", "breakout", "recovery", "academic", "film-room"]),
    intensity: z.enum(["controlled", "standard", "aggressive"]),
    focus: focusSchema,
    revision: z.number().int().min(1),
  }),
  consistency: z.number().min(0).max(100),
  lastOutcome: dayOutcomeSchema.optional(),
});

const careerMetaSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  sport: z.literal("american-football"),
  worldSeed: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  currentDate: gameDateSchema,
  phase: z.literal("high-school-preseason"),
  revision: z.number().int().nonnegative(),
});

const historyEntrySchema = z.object({
  id: z.string().min(1),
  occurredAt: z.string().datetime(),
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
});

export const careerSaveSchema = z.object({
  meta: careerMetaSchema,
  character: characterSchema,
  life: lifeSchema,
  football: footballSchema,
  history: z.array(historyEntrySchema),
});

export type CareerSave = z.infer<typeof careerSaveSchema>;

export interface CareerIndexRecord {
  id: string;
  displayName: string;
  sport: "american-football";
  phase: "high-school-preseason";
  currentDate: string;
  updatedAt: string;
  revision: number;
  position: "QB" | "RB" | "WR" | "LB" | "CB";
  jerseyNumber: number;
  schoolName: string;
  stateCode: string;
  overall: number;
  potentialBand: "role-player" | "starter" | "high-upside" | "national-ceiling";
}
