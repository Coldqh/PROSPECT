import type { GameDate } from "../calendar/types";

export type RelationshipGroup = "family" | "team" | "school" | "media";

export type RelationshipRole =
  | "guardian"
  | "head-coach"
  | "position-coach"
  | "rival"
  | "teammate"
  | "counselor"
  | "reporter";

export type NpcTemperament = "direct" | "reserved" | "volatile" | "warm" | "calculating" | "demanding";
export type NpcStatus = "steady" | "under-pressure" | "hopeful" | "frustrated" | "focused" | "concerned";

export interface RelationshipMemory {
  id: string;
  date: GameDate;
  summary: string;
  impact: number;
  importance: 1 | 2 | 3 | 4 | 5;
}

export interface RelationshipNpc {
  id: string;
  seed: string;
  linkedEntityId?: string | undefined;
  name: string;
  age: number;
  role: RelationshipRole;
  group: RelationshipGroup;
  relationship: number;
  temperament: NpcTemperament;
  goal: string;
  fear: string;
  currentSituation: string;
  status: NpcStatus;
  memories: RelationshipMemory[];
}

export interface RelationshipEffectSet {
  relationship: number;
  coachTrust?: number | undefined;
  confidence?: number | undefined;
  stress?: number | undefined;
  energy?: number | undefined;
  gpa?: number | undefined;
  visibility?: number | undefined;
  teamMorale?: number | undefined;
}

export type RelationshipEventType =
  | "coach-accountability"
  | "coach-plan-review"
  | "rival-pressure"
  | "family-academics"
  | "family-check-in"
  | "teammate-film"
  | "counselor-warning"
  | "reporter-spotlight";

export interface RelationshipEventOption {
  id: string;
  label: string;
  detail: string;
  tone: "calm" | "firm" | "defensive" | "open";
  effects: RelationshipEffectSet;
  memory: string;
  outcome: string;
  followUp?: {
    type: RelationshipEventType;
    delayDays: number;
  } | undefined;
}

export interface RelationshipEvent {
  id: string;
  type: RelationshipEventType;
  createdOn: GameDate;
  title: string;
  scene: string;
  context: string[];
  participantIds: string[];
  primaryNpcId: string;
  options: RelationshipEventOption[];
}

export interface ResolvedRelationshipEvent {
  id: string;
  type: RelationshipEventType;
  title: string;
  resolvedOn: GameDate;
  resolvedAtCompletedDay: number;
  primaryNpcId: string;
  optionId: string;
  outcome: string;
  relationshipDelta: number;
}

export interface QueuedRelationshipEvent {
  id: string;
  type: RelationshipEventType;
  dueCompletedDay: number;
  primaryNpcId: string;
}

export interface RelationshipState {
  moduleVersion: 1;
  npcs: RelationshipNpc[];
  pendingEvent?: RelationshipEvent | undefined;
  resolvedEvents: ResolvedRelationshipEvent[];
  queuedEvents: QueuedRelationshipEvent[];
  lastGeneratedCompletedDay: number;
}
