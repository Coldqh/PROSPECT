import type { GameDate } from "../../../../core/calendar/types";
import type { CharacterState } from "../../../../core/character/types";
import { SeededRandom } from "../../../../core/random/SeededRandom";
import { reevaluatePlayerTacticalProfile, tacticalDepthScore, tacticalDevelopmentMultiplier, tacticalTeamModifier } from "../tactics";
import type { FootballCareerState } from "../../career/types";
import { FOOTBALL_ROSTER_POSITIONS, POSITION_STARTER_TARGETS } from "../../team/positions";
import { evaluateDepthChart } from "../../team/evaluateDepthChart";
import type { FootballRosterPlayer } from "../../team/types";
import type { EcosystemCoach, EcosystemPlayer, EcosystemStory, EcosystemTeam, FootballEcosystemState } from "../types";
import { advanceAcademicWeek, isPlayerAvailable } from "../constitution";
import { medicalRecoveryEnvironment, playerDevelopmentEnvironment, simulateWeeklyResources } from "../resources";
import { playerSocialDevelopmentMultiplier } from "../social";
import type { EcosystemCareerState } from "./EcosystemCareerState";
import type { SimulationContext } from "./SimulationContext";
import { createSimulationContext } from "./SimulationContext";
import { clamp, playerLabel, story } from "./story";

export function syncHeroSeasonTeams(teams: EcosystemTeam[], save: EcosystemCareerState): EcosystemTeam[] {
  return teams.map((team) => {
    const standing = save.football.season.standings.find((item) => item.teamId === team.id);
    if (!standing) return team;
    return {
      ...team,
      wins: standing.wins,
      losses: standing.losses,
      streak: standing.streak,
      trend: standing.streak >= 2 ? "rising" : standing.streak <= -2 ? "falling" : "stable",
    };
  });
}

export function updatePlayersDaily(
  players: EcosystemPlayer[],
  context: SimulationContext,
  save: EcosystemCareerState,
  random: SeededRandom,
  day: number,
): { players: EcosystemPlayer[]; stories: EcosystemStory[] } {
  const stories: EcosystemStory[] = [];
  const heroTeamId = save.football.college.signedProgramId ?? save.football.school.id;
  const nextPlayers = players.map((player) => {
    const team = context.teamById.get(player.teamId);
    const playerRandom = random.fork(player.id);
    let health = player.health;
    let form = player.form;
    let status = player.status;
    let overall = player.overall;

    if (status === "injured") {
      const recoveryEnvironment = team ? medicalRecoveryEnvironment(team.resources) : 50;
      const recoveryBoost = Math.max(-1, Math.min(3, Math.round((recoveryEnvironment - 50) / 18)));
      health = clamp(health + playerRandom.integer(2, 6) + recoveryBoost);
      form = clamp(form - playerRandom.integer(0, 2));
      if (health >= 72) {
        const starterCount = POSITION_STARTER_TARGETS[player.position];
        status = player.depthRank <= starterCount ? "starter" : player.depthRank <= starterCount + 2 ? "rotation" : "backup";
      }
    } else {
      form = clamp(form + playerRandom.integer(-3, 3) + (team?.trend === "rising" ? 1 : team?.trend === "falling" ? -1 : 0));
      health = clamp(health + playerRandom.integer(-2, 2));
      const medicalEnvironment = team ? medicalRecoveryEnvironment(team.resources) : 50;
      const resourceProtection = Math.max(0.58, 1 - medicalEnvironment * 0.0045);
      const injuryChance = (0.0012 + Math.max(0, 70 - health) * 0.00012) * resourceProtection;
      if (playerRandom.chance(injuryChance)) {
        health = clamp(playerRandom.integer(42, 66));
        status = "injured";
        stories.push(story(
          save,
          day,
          "injury",
          `${player.name} выбыл из ротации`,
          `${playerLabel(player)} получил повреждение. ${team?.shortName ?? "Команда"} должна перестроить depth chart.`,
          player.depthRank === 1 ? 4 : 2,
          [player.teamId],
          [player.id],
          [],
          player.teamId === heroTeamId ||
            player.teamId === save.football.season.nextOpponent.id ||
            (player.position === save.football.position && save.football.recruitment.programs.some((program) => program.id === player.teamId && program.interest >= 50)),
        ));
      }
    }

    let eligibility = player.eligibility;
    if (day % 7 === 0) {
      eligibility = advanceAcademicWeek(player, team, save.world.seasonWeek, save.world.seasonYear, playerRandom.fork("academics"), save.world.constitution);
      if (status !== "injured" && eligibility.athleticallyEligible) {
        const developmentRoom = Math.max(0, player.potential - overall);
        const developmentEnvironment = team ? playerDevelopmentEnvironment(team.resources) : 50;
        const development = developmentRoom > 0
          ? (
              playerRandom.next() * 0.34
              + (team?.rating ?? 60) * 0.00115
              + developmentEnvironment * 0.0022
            ) * Math.min(1, developmentRoom / 18)
          : 0;
        const tacticalMultiplier = team ? tacticalDevelopmentMultiplier(player, team, context.coachesByTeamId.get(team.id) ?? []) : 1;
        const socialMultiplier = playerSocialDevelopmentMultiplier(save.world.social, player.id);
        overall = clamp(overall + development * tacticalMultiplier * socialMultiplier, 40, 99);
      }
    }

    const trajectory: EcosystemPlayer["trajectory"] = form >= 72 ? "surging" : form <= 42 ? "slipping" : "steady";
    return {
      ...player,
      health,
      form,
      overall,
      status,
      trajectory,
      eligibility,
      tactical: team && day % 7 === 0
        ? reevaluatePlayerTacticalProfile({ ...player, health, form, overall, status, trajectory, eligibility }, team.tactical, save.world.seasonYear)
        : player.tactical,
    };
  });
  return { players: nextPlayers, stories };
}

export function reorderDepthCharts(
  players: EcosystemPlayer[],
  context: SimulationContext,
  save: EcosystemCareerState,
  day: number,
): { players: EcosystemPlayer[]; stories: EcosystemStory[] } {
  const stories: EcosystemStory[] = [];
  const next = [...players];
  const playerIndexById = new Map(next.map((player, index) => [player.id, index]));
  for (const [teamId, roster] of context.playersByTeamId) {
    for (const position of FOOTBALL_ROSTER_POSITIONS) {
      const room = roster
        .filter((player) => player.position === position)
        .sort((left, right) => {
          const leftScore = !isPlayerAvailable(left) ? -100 : left.overall * 0.55 + left.form * 0.23 + left.health * 0.06 + tacticalDepthScore(left);
          const rightScore = !isPlayerAvailable(right) ? -100 : right.overall * 0.55 + right.form * 0.23 + right.health * 0.06 + tacticalDepthScore(right);
          return rightScore - leftScore;
        });
      room.forEach((player, index) => {
        const targetIndex = playerIndexById.get(player.id);
        if (targetIndex === undefined) return;
        const original = next[targetIndex];
        if (!original) return;
        const nextRank = index + 1;
        const changed = original.depthRank !== nextRank && isPlayerAvailable(original);
        next[targetIndex] = {
          ...original,
          depthRank: nextRank,
          status: original.status === "injured" ? "injured" : nextRank <= POSITION_STARTER_TARGETS[position] ? "starter" : nextRank <= POSITION_STARTER_TARGETS[position] + 2 ? "rotation" : "backup",
        };
        const directlyRelevant = teamId === (save.football.college.signedProgramId ?? save.football.school.id) || teamId === save.football.season.nextOpponent.id;
        if (changed && nextRank <= POSITION_STARTER_TARGETS[position] && (directlyRelevant || player.overall >= 72)) {
          stories.push(story(
            save,
            day,
            "depth-change",
            `${player.name} вошёл в стартовый пакет`,
            `${playerLabel(player)} вошёл в основной пакет после изменения формы внутри команды.`,
            directlyRelevant ? 4 : 2,
            [teamId],
            [player.id],
            [],
            directlyRelevant,
          ));
        }
      });
    }
  }
  return { players: next, stories };
}


export function advanceTacticalInstallation(
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  context: SimulationContext,
  day: number,
): { teams: EcosystemTeam[]; players: EcosystemPlayer[] } {
  if (day % 7 !== 0) return { teams, players };
  const nextTeams = teams.map((team) => {
    const headCoach = context.headCoachByTeamId.get(team.id);
    const staffDevelopment = headCoach?.development ?? 50;
    const installationGain = 0.5 + staffDevelopment * 0.008 + team.resources.facilitiesLevel * 0.004;
    const continuityGain = team.tactical.headCoachFingerprint === (headCoach?.seed ?? team.tactical.headCoachFingerprint) ? 0.45 : 0.1;
    return {
      ...team,
      tactical: {
        ...team.tactical,
        installation: clamp(team.tactical.installation + installationGain, 0, 100),
        continuity: clamp(team.tactical.continuity + continuityGain, 0, 100),
      },
    };
  });
  const teamMap = new Map(nextTeams.map((team) => [team.id, team]));
  const nextPlayers = players.map((player) => {
    const team = teamMap.get(player.teamId);
    return team ? { ...player, tactical: reevaluatePlayerTacticalProfile(player, team.tactical, team.rosterPlan.seasonYear) } : player;
  });
  return { teams: nextTeams, players: nextPlayers };
}

export function recalculateTeamStrength(
  teams: EcosystemTeam[],
  context: SimulationContext,
): EcosystemTeam[] {
  return teams.map((team) => {
    const roster = [...(context.playersByTeamId.get(team.id) ?? [])];
    if (roster.length === 0) return team;

    const lineup = FOOTBALL_ROSTER_POSITIONS.flatMap((position) => {
      const required = POSITION_STARTER_TARGETS[position];
      return roster
        .filter((player) => player.position === position)
        .sort((left, right) => {
          const leftAvailability = isPlayerAvailable(left) ? 0 : -40;
          const rightAvailability = isPlayerAvailable(right) ? 0 : -40;
          return (right.overall + right.form * 0.18 + rightAvailability) - (left.overall + left.form * 0.18 + leftAvailability);
        })
        .slice(0, required);
    });
    const rotation = roster.filter((player) => player.status === "starter" || player.status === "rotation");
    const lineupStrength = lineup.reduce((total, player) => {
      const availability = isPlayerAvailable(player) ? 1 : 0.58;
      return total + (player.overall * 0.68 + player.form * 0.2 + player.health * 0.12) * availability;
    }, 0) / Math.max(1, lineup.length);
    const depthStrength = rotation.reduce((total, player) => total + player.overall, 0) / Math.max(1, rotation.length);
    const missingStarterSlots = FOOTBALL_ROSTER_POSITIONS.reduce((total, position) => {
      const healthy = roster.filter((player) => player.position === position && isPlayerAvailable(player)).length;
      return total + Math.max(0, POSITION_STARTER_TARGETS[position] - healthy);
    }, 0);
    const resourceEnvironment = playerDevelopmentEnvironment(team.resources);
    const nextRating = clamp(
      team.rating * 0.5
        + lineupStrength * 0.36
        + depthStrength * 0.07
        + resourceEnvironment * 0.07
        + tacticalTeamModifier(team, roster)
        - missingStarterSlots * 0.85,
      42,
      96,
    );
    const positionNeeds = { ...team.positionNeeds };
    for (const position of FOOTBALL_ROSTER_POSITIONS) {
      const room = roster.filter((player) => player.position === position);
      const targetRoom = team.level === "college" ? POSITION_STARTER_TARGETS[position] + 2 : POSITION_STARTER_TARGETS[position] + 1;
      if (room.length === 0) {
        positionNeeds[position] = 99;
        continue;
      }
      const best = Math.max(...room.map((player) => player.overall));
      const healthyDepth = room.filter(isPlayerAvailable).length;
      const departing = room.filter((player) => player.classYear === "Senior").length;
      const starterShortage = Math.max(0, POSITION_STARTER_TARGETS[position] - healthyDepth);
      const depthShortage = Math.max(0, targetRoom - healthyDepth);
      const structuralNeed = clamp((82 - best) * 1.2 + starterShortage * 22 + depthShortage * 8 + departing * 6, 8, 99);
      positionNeeds[position] = clamp(positionNeeds[position] * 0.54 + structuralNeed * 0.46, 8, 99);
    }
    return { ...team, rating: nextRating, positionNeeds };
  });
}


export function updateProgramResourcesWeekly(
  teams: EcosystemTeam[],
  context: SimulationContext,
  save: EcosystemCareerState,
  random: SeededRandom,
  day: number,
  cyclePhase: string,
): { teams: EcosystemTeam[]; stories: EcosystemStory[] } {
  const stories: EcosystemStory[] = [];
  const nextTeams = teams.map((team) => {
    const teamRandom = random.fork(team.id);
    const injuredPlayers = (context.playersByTeamId.get(team.id) ?? []).filter((player) => player.status === "injured").length;
    const before = team.resources;
    let resources = simulateWeeklyResources(team, injuredPlayers, cyclePhase, teamRandom.fork("weekly"));

    const canInvest = team.level === "college"
      && resources.currentBalance > resources.annualBudget * 0.065
      && resources.financialPressure < 58
      && (cyclePhase === "spring-development" || cyclePhase === "preseason")
      && teamRandom.chance(0.08);
    if (canInvest) {
      const investment = Math.min(resources.currentBalance * 0.28, Math.max(0.35, resources.facilitiesBudget * 0.18));
      const medicalProject = resources.spendingPriority === "medical";
      resources = {
        ...resources,
        currentBalance: Math.round((resources.currentBalance - investment) * 100) / 100,
        facilitiesLevel: medicalProject ? resources.facilitiesLevel : clamp(resources.facilitiesLevel + investment * 0.72),
        medicalLevel: medicalProject ? clamp(resources.medicalLevel + investment * 0.86) : resources.medicalLevel,
        donorConfidence: clamp(resources.donorConfidence + 1.5),
      };
      stories.push(story(
        save,
        day,
        "investment",
        `${team.shortName} вложился в инфраструктуру`,
        medicalProject
          ? `${team.name} направил свободный резерв в медицинский блок. Восстановление и доступность состава должны улучшиться.`
          : `${team.name} направил свободный резерв в тренировочную базу. Качество развития игроков должно вырасти.`,
        team.id === save.football.college.signedProgramId ? 4 : 2,
        [team.id],
        [],
        team.coachIds,
        team.id === save.football.college.signedProgramId,
      ));
    }

    if (before.financialPressure < 68 && resources.financialPressure >= 68) {
      stories.push(story(
        save,
        day,
        "budget-crunch",
        `${team.shortName} вошёл в режим экономии`,
        `${team.name} испытывает финансовое давление. Рекрутинг, удержание штаба и качество поддержки состава будут ограничены.`,
        team.id === save.football.college.signedProgramId ? 5 : team.prestige >= 75 ? 4 : 3,
        [team.id],
        [],
        team.coachIds,
        team.id === save.football.college.signedProgramId
          || save.football.recruitment.programs.some((program) => program.id === team.id && program.interest >= 45),
      ));
    }

    if (before.donorConfidence < 76 && resources.donorConfidence >= 76 && team.level === "college") {
      stories.push(story(
        save,
        day,
        "resource-shift",
        `Доноры усилили поддержку ${team.shortName}`,
        `${team.name} получил более устойчивую финансовую базу после результатов и роста доверия. Программа сможет агрессивнее работать на рынке.`,
        3,
        [team.id],
        [],
        team.coachIds,
        team.id === save.football.college.signedProgramId,
      ));
    }

    return { ...team, resources };
  });
  return { teams: nextTeams, stories };
}


export function syncEcosystemIntoFootball(
  football: FootballCareerState,
  character: CharacterState,
  world: FootballEcosystemState,
  date: GameDate,
): FootballCareerState {
  if (football.stage === "college-season") return football;
  const context = createSimulationContext(world.teams, world.players, world.coaches);
  const heroTeamPlayers = context.playersByTeamId.get(football.school.id) ?? [];
  const byId = new Map(heroTeamPlayers.map((player) => [player.id, player]));
  const roster: FootballRosterPlayer[] = football.roster.map((player) => {
    const worldPlayer = byId.get(player.id);
    if (!worldPlayer) return player;
    return {
      ...player,
      overall: Math.round(worldPlayer.overall),
      potential: Math.max(Math.round(worldPlayer.potential), Math.round(worldPlayer.overall)),
      health: Math.round(worldPlayer.health),
      coachStanding: Math.round(clamp(worldPlayer.form * 0.68 + worldPlayer.overall * 0.2 + worldPlayer.health * 0.12)),
      status: worldPlayer.status,
      depthRank: worldPlayer.depthRank,
    };
  });

  const opponents = football.season.opponents.map((opponent) => {
    const team = context.teamById.get(opponent.id);
    return team ? { ...opponent, rating: Math.round(team.rating) } : opponent;
  });
  const schedule = football.season.schedule.map((game) => {
    const team = context.teamById.get(game.opponentId);
    return team ? { ...game, opponentRating: Math.round(team.rating) } : game;
  });
  const standings = football.season.standings.map((standing) => {
    const team = context.teamById.get(standing.teamId);
    return team ? { ...standing, rating: Math.round(team.rating) } : standing;
  });
  const provisional: FootballCareerState = {
    ...football,
    roster,
    season: { ...football.season, opponents, schedule, standings },
  };
  const depth = evaluateDepthChart(provisional, character, date);
  return {
    ...provisional,
    depthChart: {
      ...provisional.depthChart,
      ...depth,
    },
  };
}
