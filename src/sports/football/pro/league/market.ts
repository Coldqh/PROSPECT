import { SeededRandom } from "../../../../core/random/SeededRandom";
import { CAREER_FOOTBALL_POSITIONS } from "../../career/types";
import { professionalSchemeFit } from "../coaching";
import type { ProfessionalRosterPlayer, ProfessionalTeam, ProfessionalTransaction } from "../types";
import { playerDepthScore, rebuildProfessionalDepthCharts, recalculateTeams } from "./roster";

export function runNpcFreeAgency(seed: string, seasonYear: number, teams: ProfessionalTeam[], roster: ProfessionalRosterPlayer[], freeAgents: ProfessionalRosterPlayer[], week = 0): {
  teams: ProfessionalTeam[];
  roster: ProfessionalRosterPlayer[];
  freeAgents: ProfessionalRosterPlayer[];
  transactions: ProfessionalTransaction[];
} {
  let nextRoster = [...roster];
  let nextTeams = recalculateTeams(teams, nextRoster);
  const available = [...freeAgents].sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  const transactions: ProfessionalTransaction[] = [];
  for (const team of [...nextTeams].sort((a, b) => b.capSpace - a.capSpace)) {
    let safety = 0;
    while ((nextTeams.find((item) => item.id === team.id)?.rosterSize ?? 53) < 53 && safety < 60) {
      safety += 1;
      const currentTeam = nextTeams.find((item) => item.id === team.id)!;
      const spotsLeft = 53 - currentTeam.rosterSize;
      const maxSalary = currentTeam.capSpace - Math.max(0, spotsLeft - 1) * 760_000;
      if (maxSalary < 760_000) break;
      const target = available
        .map((player) => {
          const fit = professionalSchemeFit(currentTeam, player);
          return { player, fit, score: player.overall + currentTeam.needs[player.position] * 0.28 + fit * 0.16 - Math.max(0, player.annualSalary - maxSalary) / 1_000_000 * 2.4 };
        })
        .sort((a, b) => b.score - a.score || a.player.annualSalary - b.player.annualSalary || a.player.id.localeCompare(b.player.id))[0];
      if (!target) break;
      const candidate = target.player;
      const random = new SeededRandom(seed).fork(`fa:${seasonYear}:${team.id}:${candidate.id}`);
      const proposedSalary = Math.max(760_000, Math.round(candidate.annualSalary * (random.integer(92, 112) + Math.max(0, target.fit - 65) * .18) / 100 / 10_000) * 10_000);
      const salary = Math.max(760_000, Math.min(proposedSalary, Math.floor(maxSalary / 10_000) * 10_000));
      const depthRank = nextRoster.filter((player) => player.teamId === team.id && player.position === candidate.position && player.status === "active").length + 1;
      const signed: ProfessionalRosterPlayer = { ...candidate, teamId: team.id, schemeFit: target.fit, status: "active", depthRank, yearsRemaining: random.integer(1, 3), annualSalary: salary, guaranteedRemaining: Math.round(salary * 0.35 / 10_000) * 10_000 };
      nextRoster.push(signed);
      available.splice(available.findIndex((player) => player.id === candidate.id), 1);
      transactions.push({
        id: `pro-tx:${seasonYear}:w${week}:fa:${team.id}:${candidate.id}`,
        seasonYear,
        week,
        kind: "signing",
        playerId: candidate.id,
        playerName: candidate.name,
        position: candidate.position,
        toTeamId: team.id,
        value: salary,
        summary: `${team.shortName} подписали ${candidate.position} ${candidate.name} на ${Math.round(salary / 100_000) / 10}M в год.`,
      });
      nextTeams = recalculateTeams(nextTeams, nextRoster);
    }
  }
  return { teams: nextTeams, roster: nextRoster, freeAgents: available, transactions };
}

export function balanceProfessionalActiveRosters(
  seed: string,
  seasonYear: number,
  currentWeek: number,
  teams: ProfessionalTeam[],
  roster: ProfessionalRosterPlayer[],
  freeAgents: ProfessionalRosterPlayer[],
  transactions: ProfessionalTransaction[],
): { teams: ProfessionalTeam[]; roster: ProfessionalRosterPlayer[]; freeAgents: ProfessionalRosterPlayer[]; transactions: ProfessionalTransaction[] } {
  let nextRoster = [...roster];
  let nextFreeAgents = [...freeAgents];
  let nextTransactions = [...transactions];

  for (const team of teams) {
    const active = nextRoster
      .filter((player) => player.teamId === team.id && player.status === "active")
      .sort((left, right) => playerDepthScore(left) - playerDepthScore(right) || right.annualSalary - left.annualSalary || left.id.localeCompare(right.id));
    let excess = Math.max(0, active.length - 53);
    for (const player of active) {
      if (excess <= 0) break;
      if (player.isHero) continue;
      nextRoster = nextRoster.filter((candidate) => candidate.id !== player.id);
      nextFreeAgents.push({ ...player, teamId: undefined, status: "free-agent", availability: "active", injuryWeeks: 0, depthRank: 0, yearsRemaining: 0, guaranteedRemaining: 0 });
      nextTransactions.push({
        id: `pro-tx:${seasonYear}:w${currentWeek}:roster-balance:${player.id}`,
        seasonYear,
        week: currentWeek,
        kind: "release",
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        fromTeamId: team.id,
        value: player.annualSalary,
        summary: `${team.shortName} освободили ${player.position} ${player.name} после возвращения игрока из списка травмированных.`,
      });
      excess -= 1;
    }
  }

  const market = runNpcFreeAgency(seed, seasonYear, recalculateTeams(teams, nextRoster), nextRoster, nextFreeAgents, currentWeek);
  return {
    teams: market.teams,
    roster: market.roster,
    freeAgents: market.freeAgents,
    transactions: [...nextTransactions, ...market.transactions].slice(-600),
  };
}

export function runProfessionalTradeDeadline(
  seed: string,
  seasonYear: number,
  currentWeek: number,
  teams: ProfessionalTeam[],
  roster: ProfessionalRosterPlayer[],
  transactions: ProfessionalTransaction[],
): { teams: ProfessionalTeam[]; roster: ProfessionalRosterPlayer[]; transactions: ProfessionalTransaction[] } {
  if (currentWeek !== 8) return { teams, roster, transactions };
  const random = new SeededRandom(seed).fork(`professional-trade-deadline:${seasonYear}`);
  const buyers = [...teams].sort((left, right) => Math.max(...Object.values(right.needs)) - Math.max(...Object.values(left.needs)));
  const buyer = buyers[0];
  if (!buyer) return { teams, roster, transactions };
  const position = [...CAREER_FOOTBALL_POSITIONS].sort((left, right) => buyer.needs[right] - buyer.needs[left])[0];
  if (!position) return { teams, roster, transactions };
  const candidates = roster.filter((player) => !player.isHero && player.teamId && player.teamId !== buyer.id && player.position === position && player.status === "active" && player.depthRank >= 2 && player.availability === "active" && player.annualSalary <= buyer.capSpace);
  if (candidates.length === 0) return { teams, roster, transactions };
  const target = [...candidates].sort((left, right) => professionalSchemeFit(buyer, right) - professionalSchemeFit(buyer, left) || right.overall - left.overall || left.id.localeCompare(right.id))[0] ?? random.pick(candidates);
  if (!target.teamId) return { teams, roster, transactions };
  const seller = teams.find((team) => team.id === target.teamId);
  const moved = rebuildProfessionalDepthCharts(roster.map((player) => player.id === target.id ? { ...player, teamId: buyer.id, schemeFit: professionalSchemeFit(buyer, player) } : player));
  const nextTeams = recalculateTeams(teams, moved);
  return {
    teams: nextTeams,
    roster: moved,
    transactions: [...transactions, {
      id: `pro-tx:${seasonYear}:w${currentWeek}:trade:${target.id}`,
      seasonYear,
      week: currentWeek,
      kind: "trade" as const,
      playerId: target.id,
      playerName: target.name,
      position: target.position,
      fromTeamId: seller?.id,
      toTeamId: buyer.id,
      value: target.annualSalary,
      summary: `${seller?.shortName ?? "Клуб"} обменяли ${target.position} ${target.name} в ${buyer.shortName}.`,
    }].slice(-600),
  };
}
