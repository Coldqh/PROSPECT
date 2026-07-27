import type { FootballPosition } from "../career/types";
import type {
  EcosystemCoachVacancy,
  EcosystemMarketNegotiation,
  EcosystemRosterOpening,
  EcosystemCandidateKind,
  EcosystemNegotiationStatus,
  EcosystemOpeningStatus,
  EcosystemPromiseRole,
  EcosystemRosterStrategy,
  EcosystemCoachVacancyStatus,
  EcosystemTeamSeasonRecord,
  EcosystemTransaction,
  FootballEcosystemState,
} from "./types";

const MARKET_TRANSACTION_KINDS = new Set<EcosystemTransaction["kind"]>([
  "portal-entry", "transfer", "graduation", "recruit-enrolled", "juco-entry", "walk-on-entry",
  "talent-enrolled", "position-change", "scholarship-awarded", "redshirt-assigned",
  "offer-issued", "offer-withdrawn", "commitment",
]);
const COACH_TRANSACTION_KINDS = new Set<EcosystemTransaction["kind"]>([
  "coach-fired", "coach-hired", "coach-vacancy", "tactical-change", "scheme-fit",
]);


export function candidateKindLabel(kind: EcosystemCandidateKind): string {
  return { "high-school": "школьник", juco: "JUCO", "walk-on": "walk-on", transfer: "трансфер" }[kind];
}

export function promiseRoleLabel(role: EcosystemPromiseRole): string {
  return { "starter-path": "путь в старт", rotation: "ротация", developmental: "развитие" }[role];
}

export function negotiationStatusLabel(status: EcosystemNegotiationStatus): string {
  return { offered: "предложение", accepted: "принято", withdrawn: "отозвано", expired: "истекло" }[status];
}

export function scholarshipLabel(status: "none" | "partial" | "full"): string {
  return { none: "без стипендии", partial: "частичная", full: "полная" }[status];
}

export function rosterStrategyLabel(strategy: EcosystemRosterStrategy): string {
  return { contend: "борьба за титул", balanced: "баланс", develop: "развитие", rebuild: "перестройка" }[strategy];
}

export function openingStatusLabel(status: EcosystemOpeningStatus): string {
  return { open: "открыто", filled: "закрыто", closed: "снято" }[status];
}

export function vacancyStatusLabel(status: EcosystemCoachVacancyStatus): string {
  return { open: "открыта", filled: "закрыта", cancelled: "отменена" }[status];
}

export interface TeamEcosystemSnapshot {
  openings: EcosystemRosterOpening[];
  negotiations: EcosystemMarketNegotiation[];
  vacancies: EcosystemCoachVacancy[];
  transactions: EcosystemTransaction[];
  history: EcosystemTeamSeasonRecord[];
  inboundMoves: number;
  outboundMoves: number;
}

export function getTeamEcosystemSnapshot(world: FootballEcosystemState, teamId: string): TeamEcosystemSnapshot {
  const transactions = world.transactions
    .filter((item) => item.fromTeamId === teamId || item.toTeamId === teamId)
    .slice()
    .sort((left, right) => right.seasonYear - left.seasonYear || right.week - left.week);
  return {
    openings: world.movementMarket.openings.filter((item) => item.teamId === teamId),
    negotiations: world.movementMarket.negotiations.filter((item) => item.teamId === teamId).slice().sort((left, right) => right.createdWeek - left.createdWeek || right.score - left.score),
    vacancies: world.movementMarket.coachVacancies.filter((item) => item.teamId === teamId).slice().sort((left, right) => right.openedSeasonYear - left.openedSeasonYear || right.openedWeek - left.openedWeek),
    transactions,
    history: world.teamHistory.filter((item) => item.teamId === teamId).slice().sort((left, right) => right.seasonYear - left.seasonYear),
    inboundMoves: transactions.filter((item) => item.toTeamId === teamId && item.fromTeamId !== teamId).length,
    outboundMoves: transactions.filter((item) => item.fromTeamId === teamId && item.toTeamId !== teamId).length,
  };
}

export function getMarketTransactions(world: FootballEcosystemState): EcosystemTransaction[] {
  return world.transactions.filter((item) => MARKET_TRANSACTION_KINDS.has(item.kind)).slice().sort((left, right) => right.seasonYear - left.seasonYear || right.week - left.week).slice(0, 80);
}

export function getCoachTransactions(world: FootballEcosystemState): EcosystemTransaction[] {
  return world.transactions.filter((item) => COACH_TRANSACTION_KINDS.has(item.kind)).slice().sort((left, right) => right.seasonYear - left.seasonYear || right.week - left.week).slice(0, 60);
}

export function getPositionPressure(world: FootballEcosystemState): Array<{ position: FootballPosition; openings: number; targetAdds: number; activeOffers: number }> {
  const positions: FootballPosition[] = ["QB", "RB", "WR", "LB", "CB"];
  return positions.map((position) => ({
    position,
    openings: world.movementMarket.openings.filter((item) => item.position === position && item.status === "open").reduce((sum, item) => sum + Math.max(0, item.slots - item.filledByCandidateIds.length), 0),
    targetAdds: world.teams.filter((team) => team.level === "college").reduce((sum, team) => sum + team.rosterPlan.positionProjections[position].targetAdds, 0),
    activeOffers: world.movementMarket.negotiations.filter((item) => item.position === position && item.status === "offered").length,
  }));
}
