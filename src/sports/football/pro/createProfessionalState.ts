import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballPosition } from "../career/types";
import type { FootballProfessionalState, ProfessionalAgent, ProfessionalTeam } from "./types";

const TEAM_IDENTITIES = [
  ["Austin", "Outlaws", "AUS"],
  ["Baltimore", "Guardians", "BAL"],
  ["Boston", "Harbor", "BOS"],
  ["Charlotte", "Crown", "CAR"],
  ["Chicago", "Union", "CHI"],
  ["Dallas", "Wranglers", "DAL"],
  ["Denver", "Summit", "DEN"],
  ["Detroit", "Motors", "DET"],
  ["Las Vegas", "Aces", "LVA"],
  ["Los Angeles", "Stars", "LAS"],
  ["Miami", "Tide", "MIA"],
  ["New Orleans", "Brass", "NOL"],
  ["New York", "Empire", "NYE"],
  ["Philadelphia", "Foundry", "PHI"],
  ["Seattle", "Orcas", "SEA"],
  ["Washington", "Sentinels", "WAS"],
] as const;

const AGENTS = [
  ["agent-porter", "Elliot Porter", "Porter Sports", 86, 91, 72, 88, 3.5, 34, "Сильный переговорщик с прямым доступом к генеральным менеджерам."],
  ["agent-vega", "Sofia Vega", "Vega Athlete Group", 80, 78, 94, 79, 4.2, 46, "Создаёт медийный импульс и умеет поднимать интерес перед драфтом."],
  ["agent-brooks", "Malcolm Brooks", "Northline Representation", 73, 82, 61, 72, 2.5, 19, "Осторожно ведёт клиента и редко обещает то, чего не может получить."],
  ["agent-chen", "Audrey Chen", "Apex Football", 89, 87, 84, 93, 5.0, 57, "Работает с верхушкой драфта, но требует дорогую комиссию и агрессивную стратегию."],
] as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function createTeams(worldSeed: string): ProfessionalTeam[] {
  const random = new SeededRandom(worldSeed).fork("professional-teams");
  const positions: FootballPosition[] = ["QB", "RB", "WR", "LB", "CB"];
  return TEAM_IDENTITIES.map(([city, name, shortName], index) => {
    const teamRandom = random.fork(shortName);
    const rating = teamRandom.integer(66, 89);
    const wins = Math.max(2, Math.min(14, Math.round((rating - 58) / 3 + teamRandom.integer(-2, 2))));
    const losses = 17 - wins;
    const needs = Object.fromEntries(positions.map((position) => [position, clamp(teamRandom.integer(34, 94) + (rating < 73 ? 7 : 0))])) as Record<FootballPosition, number>;
    return {
      id: `pro-${shortName.toLowerCase()}`,
      city,
      name,
      shortName,
      conference: index < 8 ? "AFC" : "NFC",
      prestige: teamRandom.integer(58, 94),
      rosterStrength: rating,
      wins,
      losses,
      capSpace: teamRandom.integer(18, 74),
      needs,
    };
  });
}

function createAgents(): ProfessionalAgent[] {
  return AGENTS.map(([id, name, agency, reputation, negotiation, mediaReach, teamAccess, commission, risk, summary]) => ({
    id,
    name,
    agency,
    reputation,
    negotiation,
    mediaReach,
    teamAccess,
    commission,
    risk,
    summary,
  }));
}

export function createInitialProfessionalState(worldSeed: string, position: FootballPosition, draftYear = 2030): FootballProfessionalState {
  const teams = createTeams(worldSeed);
  const averageNeed = teams.reduce((sum, team) => sum + team.needs[position], 0) / teams.length;
  return {
    version: 1,
    status: "dormant",
    draftYear,
    declared: false,
    draftStock: 0,
    projectedRound: null,
    projectedRange: averageNeed >= 66 ? "Позиция востребована" : "Рынок позиции ограничен",
    agents: createAgents(),
    teams,
    prospects: [],
    draftOrder: [],
    draftResults: [],
    campInvites: [],
    lastSummary: "Профессиональные клубы ведут собственный сезон, обновляют потребности и готовят порядок драфта.",
  };
}
