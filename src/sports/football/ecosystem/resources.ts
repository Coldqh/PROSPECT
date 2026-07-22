import { SeededRandom } from "../../../core/random/SeededRandom";
import type {
  EcosystemProgramResources,
  EcosystemResourceTier,
  EcosystemSpendingPriority,
  EcosystemTeam,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function tierFor(team: Pick<EcosystemTeam, "level" | "prestige">): EcosystemResourceTier {
  if (team.level === "high-school") return team.prestige >= 72 ? "regional" : "local";
  if (team.prestige >= 84) return "elite";
  if (team.prestige >= 68) return "power";
  if (team.prestige >= 48) return "regional";
  return "local";
}

function priorityFor(team: Pick<EcosystemTeam, "offenseStyle" | "defenseStyle" | "prestige">, random: SeededRandom): EcosystemSpendingPriority {
  if (team.prestige >= 82 && random.chance(0.45)) return "recruiting";
  if (/pressure|blitz|man/i.test(team.defenseStyle) && random.chance(0.45)) return "medical";
  if (/air|spread|west coast/i.test(team.offenseStyle) && random.chance(0.45)) return "development";
  return random.pick(["balanced", "recruiting", "development", "medical", "facilities"] as const);
}

export function createProgramResources(
  team: Pick<EcosystemTeam, "level" | "prestige" | "offenseStyle" | "defenseStyle">,
  random: SeededRandom,
  seasonYear: number,
): EcosystemProgramResources {
  const tier = tierFor(team);
  const baseAnnual = team.level === "high-school"
    ? 0.35 + team.prestige * 0.045
    : 18 + team.prestige * 1.45;
  const annualBudget = roundMoney(baseAnnual * (0.88 + random.next() * 0.24));
  const footballShare = team.level === "high-school" ? 0.72 : 0.58 + random.next() * 0.09;
  const footballBudget = roundMoney(annualBudget * footballShare);
  const spendingPriority = priorityFor(team, random.fork("priority"));

  const recruitingWeight = spendingPriority === "recruiting" ? 0.15 : 0.1;
  const medicalWeight = spendingPriority === "medical" ? 0.15 : 0.1;
  const facilitiesWeight = spendingPriority === "facilities" ? 0.18 : 0.12;
  const academicWeight = 0.08;
  const coachingWeight = Math.max(0.22, 0.41 - recruitingWeight - medicalWeight * 0.2);
  const weightTotal = coachingWeight + recruitingWeight + medicalWeight + facilitiesWeight + academicWeight;
  const scale = footballBudget / weightTotal;

  const coachingBudget = roundMoney(coachingWeight * scale);
  const recruitingBudget = roundMoney(recruitingWeight * scale);
  const medicalBudget = roundMoney(medicalWeight * scale);
  const facilitiesBudget = roundMoney(facilitiesWeight * scale);
  const academicBudget = roundMoney(academicWeight * scale);
  const nilCapacity = team.level === "college"
    ? roundMoney(Math.max(0, (team.prestige - 32) * 0.23 * (0.72 + random.next() * 0.5)))
    : 0;
  const donorSupport = clamp(team.prestige * 0.72 + random.integer(-12, 14));
  const mediaRevenue = team.level === "college"
    ? roundMoney(Math.max(1.2, annualBudget * (0.18 + team.prestige * 0.0016)))
    : roundMoney(annualBudget * 0.08);
  const facilitiesLevel = clamp(team.prestige * 0.72 + facilitiesBudget * (team.level === "college" ? 0.35 : 4.5) + random.integer(-8, 8));
  const medicalLevel = clamp(team.prestige * 0.52 + medicalBudget * (team.level === "college" ? 0.65 : 7) + random.integer(-8, 8));
  const academicSupportLevel = clamp(team.prestige * 0.42 + academicBudget * (team.level === "college" ? 0.82 : 8) + random.integer(-8, 8));

  return {
    tier,
    annualBudget,
    footballBudget,
    coachingBudget,
    recruitingBudget,
    medicalBudget,
    facilitiesBudget,
    academicBudget,
    nilCapacity,
    donorSupport,
    mediaRevenue,
    currentBalance: roundMoney(annualBudget * (0.04 + random.next() * 0.08)),
    recruitingCommitted: 0,
    medicalCommitted: 0,
    nilCommitted: 0,
    facilitiesLevel,
    medicalLevel,
    academicSupportLevel,
    donorConfidence: clamp(donorSupport + random.integer(-7, 9)),
    boardPatience: clamp(52 + team.prestige * 0.34 + random.integer(-10, 10)),
    financialPressure: clamp(team.prestige >= 80 ? random.integer(8, 26) : random.integer(16, 42)),
    spendingPriority,
    lastBudgetYear: seasonYear,
  };
}

export function availableRecruitingBudget(resources: EcosystemProgramResources): number {
  return Math.max(0, roundMoney(resources.recruitingBudget - resources.recruitingCommitted));
}

export function availableNilCapacity(resources: EcosystemProgramResources): number {
  return Math.max(0, roundMoney(resources.nilCapacity - resources.nilCommitted));
}

export function reserveRecruitingResources(
  resources: EcosystemProgramResources,
  recruitingCost: number,
  nilCost: number,
): EcosystemProgramResources {
  return {
    ...resources,
    recruitingCommitted: roundMoney(Math.min(resources.recruitingBudget, resources.recruitingCommitted + recruitingCost)),
    nilCommitted: roundMoney(Math.min(resources.nilCapacity, resources.nilCommitted + nilCost)),
  };
}

export function playerDevelopmentEnvironment(resources: EcosystemProgramResources): number {
  return clamp(
    resources.facilitiesLevel * 0.35
      + resources.academicSupportLevel * 0.12
      + (resources.coachingBudget / Math.max(0.1, resources.footballBudget)) * 100 * 0.32
      + resources.donorConfidence * 0.12
      - resources.financialPressure * 0.12,
  );
}

export function medicalRecoveryEnvironment(resources: EcosystemProgramResources): number {
  return clamp(resources.medicalLevel * 0.72 + resources.facilitiesLevel * 0.12 + resources.financialPressure * -0.16 + 18);
}

export function coachRetentionPower(resources: EcosystemProgramResources): number {
  return clamp(
    (resources.coachingBudget / Math.max(0.1, resources.footballBudget)) * 170
      + resources.donorConfidence * 0.3
      + resources.boardPatience * 0.24
      - resources.financialPressure * 0.3,
  );
}

export function resourceRecruitingPower(resources: EcosystemProgramResources): number {
  return clamp(
    resources.recruitingBudget * 1.7
      + resources.nilCapacity * 1.1
      + resources.facilitiesLevel * 0.22
      + resources.donorConfidence * 0.18
      - resources.financialPressure * 0.2,
  );
}

export function rebalanceAnnualResources(
  team: Pick<EcosystemTeam, "level" | "prestige" | "wins" | "losses" | "expectation" | "offenseStyle" | "defenseStyle">,
  current: EcosystemProgramResources,
  seasonYear: number,
  random: SeededRandom,
): EcosystemProgramResources {
  if (current.lastBudgetYear >= seasonYear) return current;
  const totalGames = Math.max(1, team.wins + team.losses);
  const winRate = team.wins / totalGames;
  const expectationRate = Math.min(0.82, Math.max(0.28, team.expectation / 120));
  const performanceDelta = (winRate - expectationRate) * 22;
  const donorConfidence = clamp(current.donorConfidence + performanceDelta + random.integer(-5, 5));
  const boardPatience = clamp(current.boardPatience + performanceDelta * 0.75 - current.financialPressure * 0.06 + random.integer(-3, 4));
  const budgetGrowth = team.level === "college"
    ? 1 + (donorConfidence - 50) * 0.0025 + performanceDelta * 0.003
    : 1 + performanceDelta * 0.0015;
  const nextSeedTeam = {
    level: team.level,
    prestige: clamp(team.prestige + performanceDelta * 0.18),
    offenseStyle: team.offenseStyle,
    defenseStyle: team.defenseStyle,
  };
  const regenerated = createProgramResources(nextSeedTeam, random.fork("annual-plan"), seasonYear);
  const annualBudget = roundMoney(Math.max(current.annualBudget * 0.82, current.annualBudget * budgetGrowth * 0.45 + regenerated.annualBudget * 0.55));
  const footballScale = annualBudget / Math.max(0.01, regenerated.annualBudget);
  const financialPressure = clamp(
    current.financialPressure
      + Math.max(0, -performanceDelta) * 0.7
      + (current.currentBalance < 0 ? 12 : -4)
      + random.integer(-4, 4),
  );
  return {
    ...regenerated,
    annualBudget,
    footballBudget: roundMoney(regenerated.footballBudget * footballScale),
    coachingBudget: roundMoney(regenerated.coachingBudget * footballScale),
    recruitingBudget: roundMoney(regenerated.recruitingBudget * footballScale),
    medicalBudget: roundMoney(regenerated.medicalBudget * footballScale),
    facilitiesBudget: roundMoney(regenerated.facilitiesBudget * footballScale),
    academicBudget: roundMoney(regenerated.academicBudget * footballScale),
    nilCapacity: roundMoney(regenerated.nilCapacity * footballScale),
    currentBalance: roundMoney(Math.max(-annualBudget * 0.12, current.currentBalance * 0.35 + annualBudget * (0.03 + donorConfidence * 0.0008))),
    recruitingCommitted: 0,
    medicalCommitted: 0,
    nilCommitted: 0,
    donorConfidence,
    boardPatience,
    financialPressure,
    lastBudgetYear: seasonYear,
  };
}

export function simulateWeeklyResources(
  team: EcosystemTeam,
  injuredPlayers: number,
  cyclePhase: string,
  random: SeededRandom,
): EcosystemProgramResources {
  const resources = team.resources;
  const weeksInOperatingYear = 48;
  const weeklyRevenue = (resources.mediaRevenue + resources.annualBudget * 0.34) / weeksInOperatingYear;
  const recruitingIntensity = cyclePhase === "summer-recruiting" || cyclePhase === "regular-season" ? 1 : 0.45;
  const medicalIntensity = 0.65 + injuredPlayers * 0.17;
  const weeklyExpense = (
    resources.coachingBudget
      + resources.facilitiesBudget * 0.72
      + resources.academicBudget * 0.82
      + resources.recruitingBudget * recruitingIntensity
      + resources.medicalBudget * medicalIntensity
  ) / weeksInOperatingYear;
  const currentBalance = roundMoney(resources.currentBalance + weeklyRevenue - weeklyExpense + random.integer(-2, 2) * 0.01);
  const deficitRatio = currentBalance < 0 ? Math.min(1, Math.abs(currentBalance) / Math.max(0.1, resources.annualBudget * 0.08)) : 0;
  const financialPressure = clamp(
    resources.financialPressure
      + deficitRatio * 9
      + (team.losses > team.wins ? 0.5 : -0.35)
      + random.integer(-2, 2) * 0.25,
  );
  return {
    ...resources,
    currentBalance,
    medicalCommitted: roundMoney(Math.min(resources.medicalBudget, resources.medicalCommitted + injuredPlayers * 0.015)),
    donorConfidence: clamp(resources.donorConfidence + (team.streak >= 2 ? 0.8 : team.streak <= -2 ? -0.9 : 0) + random.integer(-1, 1) * 0.2),
    boardPatience: clamp(resources.boardPatience + (team.wins >= team.losses ? 0.25 : -0.35) - deficitRatio * 1.4),
    financialPressure,
  };
}
