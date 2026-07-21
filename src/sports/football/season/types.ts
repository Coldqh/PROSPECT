import type { GameDate } from "../../../core/calendar/types";
import type { MatchOutcomeGrade, MatchStatLine } from "../matches/types";

export type SeasonGameStatus = "scheduled" | "complete";

export interface SeasonOpponentProfile {
  id: string;
  name: string;
  shortName: string;
  mascot: string;
  city: string;
  stateCode: string;
  rating: number;
  offenseStyle: string;
  defenseStyle: string;
  strength: string;
  weakness: string;
  keyPlayer: string;
  scoutConfidence: number;
}

export interface SeasonScheduleGame {
  id: string;
  week: number;
  date: GameDate;
  home: boolean;
  opponentId: string;
  opponentName: string;
  opponentShortName: string;
  opponentRating: number;
  status: SeasonGameStatus;
  heroScore?: number | undefined;
  opponentScore?: number | undefined;
  won?: boolean | undefined;
  heroGrade?: MatchOutcomeGrade | undefined;
  spotlight?: string | undefined;
}

export interface SeasonStanding {
  teamId: string;
  name: string;
  shortName: string;
  rating: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: number;
  isHeroTeam: boolean;
}

export interface SeasonAward {
  id: string;
  week: number;
  title: string;
  playerName: string;
  teamName: string;
  detail: string;
  isHero: boolean;
}

export interface SeasonTeamLeader {
  id: string;
  name: string;
  position: string;
  category: string;
  value: string;
}

export interface FootballSeasonState {
  year: number;
  phase: "regular-season" | "complete";
  week: number;
  wins: number;
  losses: number;
  nextOpponent: {
    id: string;
    name: string;
    record: string;
    threat: string;
  };
  totalWeeks: number;
  opponents: SeasonOpponentProfile[];
  schedule: SeasonScheduleGame[];
  standings: SeasonStanding[];
  heroTotals: MatchStatLine;
  awards: SeasonAward[];
  teamLeaders: SeasonTeamLeader[];
}
