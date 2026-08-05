import { SeededRandom } from "../../../../core/random/SeededRandom";
import type { CareerSave } from "../../../../storage/saves/schema";
import { registerProfessionalDraftClass } from "../../ecosystem/lifecycle";
import type { EcosystemPlayerCareerRecord } from "../../ecosystem/types";
import type { ProfessionalDraftSelection, ProfessionalProspect, ProfessionalRosterPlayer, ProfessionalTeam, ProfessionalTransaction } from "../types";
import { clamp } from "./shared";

export function rookieFromProspect(
  prospect: ProfessionalProspect,
  teamId: string | undefined,
  seasonYear: number,
  round: number | null,
  overallPick: number | null,
): ProfessionalRosterPlayer {
  const random = new SeededRandom(`${prospect.id}:${seasonYear}:${teamId ?? "fa"}`);
  const annualSalary = round
    ? Math.max(760_000, Math.round((780_000 + Math.max(0, 8 - round) * 135_000 + Math.max(0, 120 - (overallPick ?? 120)) * 18_000) / 10_000) * 10_000)
    : Math.max(760_000, Math.round((740_000 + Math.max(0, prospect.overall - 55) * 90_000) / 10_000) * 10_000);
  return {
    id: `pro-rookie:${seasonYear}:${prospect.sourcePlayerId ?? prospect.id}`,
    sourcePlayerId: prospect.sourcePlayerId,
    collegeTeamId: prospect.collegeTeamId,
    collegeName: prospect.collegeName,
    draftYear: seasonYear,
    draftRound: round,
    draftPick: overallPick,
    name: prospect.name,
    ...(teamId ? { teamId } : {}),
    position: prospect.position,
    age: prospect.age,
    overall: clamp(prospect.overall * 0.78 + prospect.draftGrade * 0.22, 50, 96),
    potential: clamp(Math.max(prospect.potential, prospect.overall + random.integer(2, 8))),
    health: prospect.medicalScore,
    form: clamp(54 + prospect.production * 0.2 + random.integer(-5, 6)),
    schemeFit: 60,
    depthRank: teamId ? 6 : 0,
    yearsRemaining: teamId ? 4 : 0,
    annualSalary,
    guaranteedRemaining: teamId ? Math.round(annualSalary * (round && round <= 2 ? 1.8 : round && round <= 4 ? 0.9 : 0.35) / 10_000) * 10_000 : 0,
    status: teamId ? "active" : "free-agent",
    availability: "active",
    injuryWeeks: 0,
    isHero: false,
  };
}

export function injectDraftClass(
  state: CareerSave["football"]["professional"],
  seasonYear: number,
  roster: ProfessionalRosterPlayer[],
  freeAgents: ProfessionalRosterPlayer[],
): { roster: ProfessionalRosterPlayer[]; freeAgents: ProfessionalRosterPlayer[]; transactions: ProfessionalTransaction[] } {
  let nextRoster = [...roster];
  let nextFreeAgents = [...freeAgents];
  const transactions: ProfessionalTransaction[] = [];
  const prospectById = new Map(state.prospects.map((prospect) => [prospect.id, prospect]));
  for (const selection of state.draftResults.filter((pick) => !pick.isHero)) {
    const prospect = prospectById.get(selection.prospectId);
    if (!prospect) continue;
    const rookie = rookieFromProspect(prospect, selection.teamId, seasonYear, selection.round, selection.overallPick);
    const replacement = nextRoster
      .filter((player) => player.teamId === selection.teamId && player.position === rookie.position && player.status === "active" && !player.isHero)
      .sort((left, right) => left.overall - right.overall || right.age - left.age)[0];
    if (replacement) {
      nextRoster = nextRoster.filter((player) => player.id !== replacement.id);
      nextFreeAgents.push({ ...replacement, teamId: undefined, status: "free-agent", depthRank: 0, yearsRemaining: 0 });
    }
    nextRoster.push(rookie);
    transactions.push({
      id: `pro-tx:${seasonYear}:draft:${selection.overallPick}:${rookie.id}`,
      seasonYear,
      week: 0,
      kind: "signing",
      playerId: rookie.id,
      playerName: rookie.name,
      position: rookie.position,
      toTeamId: selection.teamId,
      value: rookie.annualSalary,
      summary: `${rookie.name} вошёл в состав после выбора №${selection.overallPick}.`,
    });
  }
  const selectedIds = new Set(state.draftResults.map((pick) => pick.prospectId));
  for (const prospect of state.prospects.filter((item) => !item.isHero && !selectedIds.has(item.id))) {
    nextFreeAgents.push(rookieFromProspect(prospect, undefined, seasonYear, null, null));
  }
  return { roster: nextRoster, freeAgents: nextFreeAgents, transactions };
}

export function prospectFromCareerRecord(record: EcosystemPlayerCareerRecord): ProfessionalProspect {
  const production = clamp(record.overall * 0.68 + record.potential * 0.2 + 8);
  const athleticScore = clamp(record.overall * 0.7 + record.potential * 0.3);
  const medicalScore = clamp(78 + Math.max(-12, record.overall - 70) * 0.25);
  const interviewScore = clamp(58 + record.potential * 0.28);
  const draftGrade = clamp(record.overall * 0.48 + record.potential * 0.28 + production * 0.12 + athleticScore * 0.07 + medicalScore * 0.03 + interviewScore * 0.02);
  return {
    id: `prospect:${record.playerId}`,
    sourcePlayerId: record.playerId,
    collegeTeamId: record.collegeTeamIds.at(-1),
    previousTeamIds: [...record.highSchoolTeamIds, ...record.collegeTeamIds],
    seasonsPlayed: Math.max(1, record.events.filter((item) => item.kind === "enrolled").length),
    declaredEarly: false,
    name: record.name,
    position: record.position,
    collegeName: record.collegeTeamIds.at(-1)?.replace(/^college-/, "").toUpperCase() ?? "College",
    age: Math.max(20, record.age),
    overall: record.overall,
    potential: record.potential,
    production,
    athleticScore,
    medicalScore,
    interviewScore,
    draftGrade,
    projectedRound: draftGrade >= 88 ? 1 : draftGrade >= 81 ? 2 : draftGrade >= 75 ? 3 : draftGrade >= 69 ? 4 : draftGrade >= 64 ? 5 : draftGrade >= 59 ? 6 : draftGrade >= 54 ? 7 : null,
    isHero: record.isHero,
  };
}

export function runLifecycleRookieDraft(
  save: CareerSave,
  seasonYear: number,
  teams: ProfessionalTeam[],
  roster: ProfessionalRosterPlayer[],
  freeAgents: ProfessionalRosterPlayer[],
): {
  roster: ProfessionalRosterPlayer[];
  freeAgents: ProfessionalRosterPlayer[];
  transactions: ProfessionalTransaction[];
  selections: ProfessionalDraftSelection[];
  careerRegistry: CareerSave["world"]["careerRegistry"];
} {
  const pool = save.world.careerRegistry.records
    .filter((record) => record.currentStage === "draft-pool" && !record.isHero)
    .map(prospectFromCareerRecord)
    .sort((left, right) => right.draftGrade - left.draftGrade || left.id.localeCompare(right.id));
  if (pool.length === 0) {
    return { roster, freeAgents, transactions: [], selections: [], careerRegistry: save.world.careerRegistry };
  }
  const order = [...teams].sort((left, right) => left.wins - right.wins || left.rosterStrength - right.rosterStrength || left.id.localeCompare(right.id));
  let nextRoster = [...roster];
  const nextFreeAgents = [...freeAgents];
  const selections: ProfessionalDraftSelection[] = [];
  const transactions: ProfessionalTransaction[] = [];
  const remaining = [...pool];
  for (let round = 1; round <= 7 && remaining.length > 0; round += 1) {
    for (let index = 0; index < order.length && remaining.length > 0; index += 1) {
      const team = order[index]!;
      const prospect = [...remaining]
        .sort((left, right) => (right.draftGrade + team.needs[right.position] * 0.17) - (left.draftGrade + team.needs[left.position] * 0.17) || left.id.localeCompare(right.id))[0]!;
      remaining.splice(remaining.findIndex((item) => item.id === prospect.id), 1);
      const overallPick = (round - 1) * order.length + index + 1;
      const selection: ProfessionalDraftSelection = {
        id: `${seasonYear}:round-${round}:pick-${index + 1}:${prospect.id}`,
        sourcePlayerId: prospect.sourcePlayerId,
        round,
        pickInRound: index + 1,
        overallPick,
        teamId: team.id,
        prospectId: prospect.id,
        prospectName: prospect.name,
        position: prospect.position,
        collegeName: prospect.collegeName,
        grade: prospect.draftGrade,
        isHero: false,
      };
      selections.push(selection);
      const rookie = rookieFromProspect(prospect, team.id, seasonYear, round, overallPick);
      const replacement = nextRoster
        .filter((player) => player.teamId === team.id && player.position === rookie.position && player.status === "active" && !player.isHero)
        .sort((left, right) => left.overall - right.overall || right.age - left.age)[0];
      if (replacement) {
        nextRoster = nextRoster.filter((player) => player.id !== replacement.id);
        nextFreeAgents.push({ ...replacement, teamId: undefined, status: "free-agent", depthRank: 0, yearsRemaining: 0 });
      }
      nextRoster.push(rookie);
      transactions.push({
        id: `pro-tx:${seasonYear}:draft:${overallPick}:${rookie.id}`,
        seasonYear,
        week: 0,
        kind: "signing",
        playerId: rookie.id,
        playerName: rookie.name,
        position: rookie.position,
        toTeamId: team.id,
        value: rookie.annualSalary,
        summary: `${team.shortName} выбрали ${prospect.name} под №${overallPick}.`,
      });
    }
  }
  for (const prospect of remaining) nextFreeAgents.push(rookieFromProspect(prospect, undefined, seasonYear, null, null));
  const careerRegistry = registerProfessionalDraftClass(save.world.careerRegistry, pool, selections, nextRoster, seasonYear, 0);
  return { roster: nextRoster, freeAgents: nextFreeAgents, transactions, selections, careerRegistry };
}

