import type {
  MatchDriveOutcome,
  MatchDriveSummary,
  MatchSnapResult,
  MatchTeamSide,
} from "../types";

export interface TeamRatings {
  offense: number;
  defense: number;
  coaching: number;
  cohesion: number;
}

export interface SpecialistSnapshot {
  name: string;
  overall: number;
  health: number;
}

export interface SnapSimulation {
  snapResult: MatchSnapResult;
  yards: number;
  points: number;
  scoringSide?: MatchTeamSide | undefined;
  turnover: boolean;
  firstDown: boolean;
  repeatDown: boolean;
  targetSlot?: string | undefined;
  ballCarrierSlot?: string | undefined;
  teamExecutionScore: number;
  description: string;
  pressureOccurred?: boolean;
  heroOpenWindow?: boolean;
  heroSeparationYards?: number;
  grossPuntYards?: number;
  puntReturnYards?: number;
  kickDistance?: number;
}

export interface DriveAdvance {
  driveEnded: boolean;
  outcome: MatchDriveOutcome;
  nextDown: 1 | 2 | 3 | 4;
  nextDistance: number;
  nextFieldPosition: number;
  firstDown: boolean;
}

export interface BackgroundDriveResult {
  summary: MatchDriveSummary;
  heroScoreDelta: number;
  opponentScoreDelta: number;
  nextControlledFieldPosition: number;
  gameClockSeconds: number;
}
