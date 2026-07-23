import type { GameDate } from "../../../core/calendar/types";
import type { CharacterState } from "../../../core/character/types";
import type { LifeState } from "../../../core/life/types";
import type { RelationshipState } from "../../../core/relationships/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import { createPlayerTacticalProfile, reevaluatePlayerTacticalProfile, refreshTacticalIdentityAfterCoachChange, tacticalDepthScore, tacticalDevelopmentMultiplier, tacticalTeamModifier } from "./tactics";
import type { FootballCareerState, FootballPosition } from "../career/types";
import type { RecruitingProgram } from "../recruiting/types";
import { evaluateDepthChart } from "../team/evaluateDepthChart";
import type { FootballRosterPlayer } from "../team/types";
import type {
  EcosystemCoach,
  EcosystemConference,
  EcosystemPlayer,
  EcosystemStory,
  EcosystemTeam,
  EcosystemTeamSeasonRecord,
  EcosystemTransaction,
  FootballEcosystemState,
} from "./types";
import { addGameDays, advanceAcademicWeek, createPlayerEligibility, isPlayerAvailable, refreshTeamCompliance, resolveWorldCycle, rollEligibilityIntoNextSeason } from "./constitution";
import { createTalentProfile, processAnnualTalentFlow, simulateTalentCamps } from "./talent";
import {
  availableNilCapacity,
  availableRecruitingBudget,
  coachRetentionPower,
  medicalRecoveryEnvironment,
  playerDevelopmentEnvironment,
  rebalanceAnnualResources,
  reserveRecruitingResources,
  resourceRecruitingPower,
  simulateWeeklyResources,
} from "./resources";
import { reviewRosterManagement } from "./rosterManagement";
import { advanceUnifiedMovementMarket, applyCoachMovementConsequences } from "./movementMarket";
import { resetCompetitionForSeason, simulateCompetitionPostseason, simulateCompetitionWeek } from "./competition";


interface EcosystemCareerState {
  meta: {
    worldSeed: string;
    currentDate: GameDate;
    updatedAt: string;
  };
  character: CharacterState;
  life: LifeState;
  football: FootballCareerState;
  relationships: RelationshipState;
  world: FootballEcosystemState;
  history: Array<{
    id: string;
    occurredAt: string;
    type: string;
    title: string;
    description: string;
  }>;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function importance(value: number): 1 | 2 | 3 | 4 | 5 {
  if (value >= 5) return 5;
  if (value >= 4) return 4;
  if (value >= 3) return 3;
  if (value >= 2) return 2;
  return 1;
}

function story(
  save: EcosystemCareerState,
  day: number,
  kind: EcosystemStory["kind"],
  title: string,
  detail: string,
  weight: number,
  teamIds: string[] = [],
  playerIds: string[] = [],
  coachIds: string[] = [],
  relatedToHero = false,
): EcosystemStory {
  return {
    id: `world-${day}-${kind}-${teamIds[0] ?? playerIds[0] ?? coachIds[0] ?? "global"}-${title.length}`,
    kind,
    createdOn: save.meta.currentDate,
    week: save.life.weekNumber,
    title,
    detail,
    importance: importance(weight),
    teamIds,
    playerIds,
    coachIds,
    relatedToHero,
  };
}

function playerLabel(player: EcosystemPlayer): string {
  return `${player.name}, ${player.position}`;
}

function syncHeroSeasonTeams(teams: EcosystemTeam[], save: EcosystemCareerState): EcosystemTeam[] {
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

function updatePlayersDaily(
  players: EcosystemPlayer[],
  teams: EcosystemTeam[],
  save: EcosystemCareerState,
  random: SeededRandom,
  day: number,
): { players: EcosystemPlayer[]; stories: EcosystemStory[] } {
  const stories: EcosystemStory[] = [];
  const heroTeamId = save.football.school.id;
  const nextPlayers = players.map((player) => {
    const team = teams.find((item) => item.id === player.teamId);
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
        status = player.depthRank === 1 ? "starter" : player.depthRank === 2 ? "rotation" : "backup";
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
        const tacticalMultiplier = team ? tacticalDevelopmentMultiplier(player, team) : 1;
        overall = clamp(overall + development * tacticalMultiplier, 40, 99);
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

function reorderDepthCharts(
  players: EcosystemPlayer[],
  save: EcosystemCareerState,
  day: number,
): { players: EcosystemPlayer[]; stories: EcosystemStory[] } {
  const stories: EcosystemStory[] = [];
  const next = [...players];
  const teamIds = [...new Set(players.map((player) => player.teamId))];
  for (const teamId of teamIds) {
    for (const position of ["QB", "RB", "WR", "LB", "CB"] as const satisfies readonly FootballPosition[]) {
      const room = next
        .filter((player) => player.teamId === teamId && player.position === position)
        .sort((left, right) => {
          const leftScore = !isPlayerAvailable(left) ? -100 : left.overall * 0.55 + left.form * 0.23 + left.health * 0.06 + tacticalDepthScore(left);
          const rightScore = !isPlayerAvailable(right) ? -100 : right.overall * 0.55 + right.form * 0.23 + right.health * 0.06 + tacticalDepthScore(right);
          return rightScore - leftScore;
        });
      room.forEach((player, index) => {
        const original = next.find((item) => item.id === player.id);
        if (!original) return;
        const nextRank = index + 1;
        const changed = original.depthRank !== nextRank && isPlayerAvailable(original);
        const targetIndex = next.findIndex((item) => item.id === player.id);
        next[targetIndex] = {
          ...original,
          depthRank: nextRank,
          status: original.status === "injured" ? "injured" : nextRank === 1 ? "starter" : nextRank === 2 ? "rotation" : "backup",
        };
        const directlyRelevant = teamId === save.football.school.id || teamId === save.football.season.nextOpponent.id;
        if (changed && nextRank === 1 && (directlyRelevant || player.overall >= 72)) {
          stories.push(story(
            save,
            day,
            "depth-change",
            `${player.name} забрал стартовое место`,
            `${playerLabel(player)} поднялся на первую строку после изменения формы внутри команды.`,
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


function advanceTacticalInstallation(
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  day: number,
): { teams: EcosystemTeam[]; players: EcosystemPlayer[] } {
  if (day % 7 !== 0) return { teams, players };
  const nextTeams = teams.map((team) => {
    const headCoach = coaches.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
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

function recalculateTeamStrength(
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
): EcosystemTeam[] {
  return teams.map((team) => {
    const roster = players.filter((player) => player.teamId === team.id);
    if (roster.length === 0) return team;
    const starters = roster.filter((player) => player.depthRank === 1);
    const rotation = roster.filter((player) => player.depthRank <= 2);
    const lineup = starters.length >= 3 ? starters : rotation;
    const lineupStrength = lineup.reduce((total, player) => {
      const availability = isPlayerAvailable(player) ? 1 : 0.62;
      return total + (player.overall * 0.68 + player.form * 0.2 + player.health * 0.12) * availability;
    }, 0) / Math.max(1, lineup.length);
    const depthStrength = rotation.reduce((total, player) => total + player.overall, 0) / Math.max(1, rotation.length);
    const resourceEnvironment = playerDevelopmentEnvironment(team.resources);
    const nextRating = clamp(
      team.rating * 0.54
        + lineupStrength * 0.32
        + depthStrength * 0.07
        + resourceEnvironment * 0.07
        + tacticalTeamModifier(team, roster),
      42,
      96,
    );
    const positionNeeds = { ...team.positionNeeds };
    for (const position of ["QB", "RB", "WR", "LB", "CB"] as const satisfies readonly FootballPosition[]) {
      const room = roster.filter((player) => player.position === position);
      if (room.length === 0) continue;
      const best = Math.max(...room.map((player) => player.overall));
      const healthyDepth = room.filter(isPlayerAvailable).length;
      const departing = room.filter((player) => player.classYear === "Senior").length;
      const structuralNeed = clamp((82 - best) * 1.35 + Math.max(0, 2 - healthyDepth) * 13 + departing * 6, 8, 96);
      positionNeeds[position] = clamp(positionNeeds[position] * 0.58 + structuralNeed * 0.42, 8, 96);
    }
    return { ...team, rating: nextRating, positionNeeds };
  });
}


function updateProgramResourcesWeekly(
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  save: EcosystemCareerState,
  random: SeededRandom,
  day: number,
  cyclePhase: string,
): { teams: EcosystemTeam[]; stories: EcosystemStory[] } {
  const stories: EcosystemStory[] = [];
  const nextTeams = teams.map((team) => {
    const teamRandom = random.fork(team.id);
    const injuredPlayers = players.filter((player) => player.teamId === team.id && player.status === "injured").length;
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


function syncEcosystemIntoFootball(
  football: FootballCareerState,
  character: CharacterState,
  world: FootballEcosystemState,
  date: GameDate,
): FootballCareerState {
  const heroTeamPlayers = world.players.filter((player) => player.teamId === football.school.id);
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
    const team = world.teams.find((item) => item.id === opponent.id);
    return team ? { ...opponent, rating: Math.round(team.rating) } : opponent;
  });
  const schedule = football.season.schedule.map((game) => {
    const team = world.teams.find((item) => item.id === game.opponentId);
    return team ? { ...game, opponentRating: Math.round(team.rating) } : game;
  });
  const standings = football.season.standings.map((standing) => {
    const team = world.teams.find((item) => item.id === standing.teamId);
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

function simulateCollegeTeams(
  teams: EcosystemTeam[],
  coaches: EcosystemCoach[],
  save: EcosystemCareerState,
  random: SeededRandom,
  day: number,
): { teams: EcosystemTeam[]; coaches: EcosystemCoach[]; stories: EcosystemStory[] } {
  const stories: EcosystemStory[] = [];
  const nextTeams = teams.map((team) => {
    if (team.level !== "college") return team;
    const teamRandom = random.fork(team.id);
    const opponentStrength = teamRandom.integer(52, 88);
    const performance = team.rating + teamRandom.integer(-16, 16);
    const won = performance >= opponentStrength;
    const wins = team.wins + (won ? 1 : 0);
    const losses = team.losses + (won ? 0 : 1);
    const streak = won ? Math.max(1, team.streak + 1) : Math.min(-1, team.streak - 1);
    const trend: EcosystemTeam["trend"] = streak >= 2 ? "rising" : streak <= -2 ? "falling" : "stable";
    if ((won && opponentStrength >= team.rating + 8) || (!won && opponentStrength <= team.rating - 10)) {
      stories.push(story(
        save,
        day,
        "upset",
        won ? `${team.shortName} перевернул прогноз` : `${team.shortName} сорвал обязательную победу`,
        won
          ? `${team.name} обыграл более сильного соперника. Репутация штаба и игроков выросла.`
          : `${team.name} уступил команде ниже классом. Давление на штаб усилилось.`,
        4,
        [team.id],
        [],
        team.coachIds,
        save.football.recruitment.programs.some((program) => program.id === team.id && program.interest >= 45),
      ));
    }
    return { ...team, wins, losses, streak, trend };
  });

  const nextCoaches = coaches.map((coach) => {
    if (coach.role !== "head-coach") return coach;
    const team = nextTeams.find((item) => item.id === coach.teamId);
    if (!team || team.level !== "college") return coach;
    const total = Math.max(1, team.wins + team.losses);
    const winRate = team.wins / total;
    const expectedRate = team.expectation / 125;
    const performanceDelta = (winRate - expectedRate) * 18;
    let jobSecurity = clamp(coach.jobSecurity + performanceDelta + random.fork(coach.id).integer(-3, 3));
    let status: EcosystemCoach["status"] = jobSecurity < 35 ? "hot-seat" : jobSecurity < 55 ? "watched" : "secure";
    let name = coach.name;
    let reputation = coach.reputation;
    if (jobSecurity < 12 && team.losses >= 5 && day >= 42) {
      stories.push(story(
        save,
        day,
        "coach-move",
        `${team.shortName} сменил главного тренера`,
        `${coach.name} уволен после провального отрезка. Старые обещания рекрутам больше не гарантированы.`,
        5,
        [team.id],
        [],
        [coach.id],
        save.football.recruitment.programs.some((program) => program.id === team.id && program.interest >= 30),
      ));
      const replacementRandom = random.fork(`${coach.id}:replacement:${day}`);
      name = `Coach ${replacementRandom.integer(100, 999)}`;
      reputation = clamp(team.prestige + replacementRandom.integer(-18, 12));
      jobSecurity = clamp(62 + replacementRandom.integer(-8, 12));
      status = "secure";
    } else if (status === "hot-seat" && coach.status !== "hot-seat") {
      stories.push(story(
        save,
        day,
        "coach-pressure",
        `${coach.name} оказался на грани увольнения`,
        `${team.name} не выполняет ожидания. Стабильность штаба и рекрутинговые обещания под вопросом.`,
        4,
        [team.id],
        [],
        [coach.id],
        save.football.recruitment.programs.some((program) => program.id === team.id && program.interest >= 35),
      ));
    }
    return {
      ...coach,
      name,
      reputation,
      jobSecurity,
      pressure: clamp(100 - jobSecurity + team.losses * 2),
      status,
    };
  });
  return { teams: nextTeams, coaches: nextCoaches, stories };
}

function chooseCommitment(
  player: EcosystemPlayer,
  collegeTeams: EcosystemTeam[],
  reservations: ReadonlyMap<string, number>,
  random: SeededRandom,
): EcosystemTeam | undefined {
  const candidates = collegeTeams
    .map((team) => {
      const reserved = reservations.get(team.id) ?? 0;
      const rosterRoom = team.compliance.rosterLimit - team.compliance.estimatedRosterSize - reserved;
      const scholarshipRoom = team.compliance.fundedScholarships - team.compliance.scholarshipsUsed - reserved;
      const requiresScholarship = player.overall >= 65 || player.nationalRank <= 900;
      const recruitingRoom = availableRecruitingBudget(team.resources);
      const nilRoom = availableNilCapacity(team.resources);
      const recruitingCost = Math.max(0.08, player.nationalRank <= 300 ? 0.42 : player.nationalRank <= 900 ? 0.24 : 0.12);
      return {
        team,
        eligible:
          team.compliance.status !== "violation"
          && rosterRoom > 0
          && (reservations.get(team.id) ?? 0) < Math.max(1, team.rosterPlan.targetClassSize)
          && team.rosterPlan.positionProjections[player.position].targetAdds > 0
          && recruitingRoom >= recruitingCost
          && (!requiresScholarship || scholarshipRoom > 0),
        score:
          team.prestige * 0.28
          + team.positionNeeds[player.position] * 0.34
          + team.rating * 0.14
          + resourceRecruitingPower(team.resources) * 0.18
          + Math.max(0, scholarshipRoom) * 0.08
          + nilRoom * 0.5
          + random.integer(-10, 10),
      };
    })
    .filter((candidate) => candidate.eligible && candidate.team.positionNeeds[player.position] >= 30)
    .sort((left, right) => right.score - left.score);
  return candidates[0]?.team;
}

function simulateRecruitingMarket(
  players: EcosystemPlayer[],
  teams: EcosystemTeam[],
  save: EcosystemCareerState,
  random: SeededRandom,
  day: number,
): { players: EcosystemPlayer[]; teams: EcosystemTeam[]; stories: EcosystemStory[] } {
  const stories: EcosystemStory[] = [];
  const collegeTeams = teams.filter((team) => team.level === "college");
  const newCommitments: Array<{ playerId: string; teamId: string; position: FootballPosition; recruitingCost: number; nilCost: number }> = [];
  let commitments = 0;
  const reservations = new Map<string, number>();
  const nextPlayers = players.map((player) => {
    if (
      commitments >= 5 ||
      player.level !== "high-school" ||
      player.classYear !== "Senior" ||
      player.recruitingStage === "committed" ||
      player.overall < 56
    ) return player;
    const playerRandom = random.fork(player.id);
    const urgency = player.recruitingStage === "offered" ? 0.24 : player.recruitingStage === "tracked" ? 0.1 : 0.025;
    if (!playerRandom.chance(urgency)) return player;
    const target = chooseCommitment(player, collegeTeams, reservations, playerRandom);
    if (!target) return player;
    commitments += 1;
    reservations.set(target.id, (reservations.get(target.id) ?? 0) + 1);
    const recruitingCost = Math.max(0.08, player.nationalRank <= 300 ? 0.42 : player.nationalRank <= 900 ? 0.24 : 0.12);
    const nilCost = target.level === "college"
      ? Math.min(availableNilCapacity(target.resources), Math.max(0, (player.overall - 62) * 0.018))
      : 0;
    newCommitments.push({ playerId: player.id, teamId: target.id, position: player.position, recruitingCost, nilCost });
    const related = player.position === save.football.position && save.football.recruitment.programs.some((program) => program.id === target.id && program.interest >= 25);
    stories.push(story(
      save,
      day,
      "commitment",
      `${player.name} выбрал ${target.shortName}`,
      `${playerLabel(player)} занял одну из будущих позиций в наборе ${target.name}. Потребность программы на позиции снизилась.`,
      player.nationalRank <= 300 ? 5 : player.nationalRank <= 800 ? 4 : 3,
      [player.teamId, target.id],
      [player.id],
      [],
      related,
    ));
    return { ...player, recruitingStage: "committed" as const, committedTeamId: target.id };
  });

  const nextTeams = teams.map((team) => {
    if (team.level !== "college") return team;
    const incoming = newCommitments.filter((item) => item.teamId === team.id);
    if (incoming.length === 0) return team;
    const needs = { ...team.positionNeeds };
    for (const item of incoming) needs[item.position] = clamp(needs[item.position] - 8);
    const scholarshipAdds = incoming.filter((item) => (players.find((player) => player.id === item.playerId)?.overall ?? 0) >= 65).length;
    return {
      ...team,
      positionNeeds: needs,
      compliance: {
        ...team.compliance,
        estimatedRosterSize: Math.min(team.compliance.rosterLimit, team.compliance.estimatedRosterSize + incoming.length),
        scholarshipsUsed: Math.min(team.compliance.fundedScholarships, team.compliance.scholarshipsUsed + scholarshipAdds),
      },
      resources: incoming.reduce(
        (resources, item) => reserveRecruitingResources(resources, item.recruitingCost, item.nilCost),
        team.resources,
      ),
    };
  });
  return { players: nextPlayers, teams: nextTeams, stories };
}


const PORTAL_FIRST_NAMES = ["Avery", "Cam", "Darius", "Eli", "Isaiah", "Jalen", "Malik", "Noah", "Trey", "Xavier"] as const;
const PORTAL_LAST_NAMES = ["Banks", "Coleman", "Davis", "Fields", "Grant", "Harris", "Moore", "Reed", "Turner", "Walker"] as const;
const POSITIONS = ["QB", "RB", "WR", "LB", "CB"] as const satisfies readonly FootballPosition[];

function conferencePairs(teamIds: string[], round: number): Array<[string, string]> {
  const ids = [...teamIds].sort();
  if (ids.length % 2 === 1) ids.push("");
  if (ids.length < 2) return [];
  const fixed = ids[0] ?? "";
  const rotating = ids.slice(1);
  for (let index = 0; index < round % Math.max(1, rotating.length); index += 1) {
    const moved = rotating.pop();
    if (moved !== undefined) rotating.unshift(moved);
  }
  const arranged = [fixed, ...rotating];
  const pairs: Array<[string, string]> = [];
  for (let index = 0; index < arranged.length / 2; index += 1) {
    const left = arranged[index];
    const right = arranged[arranged.length - 1 - index];
    if (left && right) pairs.push([left, right]);
  }
  return pairs;
}

function gameScore(team: EcosystemTeam, opponent: EcosystemTeam, random: SeededRandom): number {
  const trend = team.trend === "rising" ? 3 : team.trend === "falling" ? -3 : 0;
  const matchup = (team.rating - opponent.rating) * 0.22;
  return Math.max(6, Math.min(52, Math.round(24 + trend + matchup + random.integer(-11, 12))));
}

function simulateConferenceRound(
  teams: EcosystemTeam[],
  coaches: EcosystemCoach[],
  conferences: EcosystemConference[],
  save: EcosystemCareerState,
  random: SeededRandom,
  day: number,
  seasonWeek: number,
): { teams: EcosystemTeam[]; coaches: EcosystemCoach[]; stories: EcosystemStory[] } {
  const stories: EcosystemStory[] = [];
  const teamMap = new Map(teams.map((team) => [team.id, { ...team }]));
  const coachMap = new Map(coaches.map((coach) => [coach.id, { ...coach }]));
  for (const conference of conferences) {
    for (const [leftId, rightId] of conferencePairs(conference.teamIds, seasonWeek - 1)) {
      const left = teamMap.get(leftId);
      const right = teamMap.get(rightId);
      if (!left || !right) continue;
      const matchRandom = random.fork(`${conference.id}:${leftId}:${rightId}`);
      let leftScore = gameScore(left, right, matchRandom.fork("left"));
      let rightScore = gameScore(right, left, matchRandom.fork("right"));
      if (leftScore === rightScore) leftScore += matchRandom.chance(0.5) ? 3 : -3;
      const leftWon = leftScore > rightScore;
      const winner = leftWon ? left : right;
      const loser = leftWon ? right : left;
      const applyResult = (team: EcosystemTeam, won: boolean): EcosystemTeam => ({
        ...team,
        wins: team.wins + (won ? 1 : 0),
        losses: team.losses + (won ? 0 : 1),
        conferenceWins: team.conferenceWins + (won ? 1 : 0),
        conferenceLosses: team.conferenceLosses + (won ? 0 : 1),
        streak: won ? Math.max(1, team.streak + 1) : Math.min(-1, team.streak - 1),
        trend: won && team.streak >= 0 ? "rising" : !won && team.streak <= 0 ? "falling" : "stable",
      });
      teamMap.set(left.id, applyResult(left, leftWon));
      teamMap.set(right.id, applyResult(right, !leftWon));
      for (const team of [left, right]) {
        const coach = coaches.find((item) => item.teamId === team.id && item.role === "head-coach");
        if (!coach) continue;
        const next = coachMap.get(coach.id) ?? coach;
        const won = team.id === winner.id;
        coachMap.set(coach.id, { ...next, careerWins: next.careerWins + (won ? 1 : 0), careerLosses: next.careerLosses + (won ? 0 : 1) });
      }
      const upset = winner.rating + 7 < loser.rating;
      if (upset) {
        stories.push(story(
          save,
          day,
          "upset",
          `${winner.shortName} сорвал прогноз`,
          `${winner.name} обыграл ${loser.name} ${leftWon ? `${leftScore}:${rightScore}` : `${rightScore}:${leftScore}`}. Результат меняет гонку ${conference.shortName}.`,
          4,
          [winner.id, loser.id],
          [],
          winner.coachIds,
          save.football.recruitment.programs.some((program) => program.id === winner.id || program.id === loser.id),
        ));
      }
    }
  }
  const nextTeams = [...teamMap.values()];
  const nextCoaches = [...coachMap.values()].map((coach) => {
    if (coach.role !== "head-coach") return coach;
    const team = teamMap.get(coach.teamId);
    if (!team || team.level !== "college") return coach;
    const games = Math.max(1, team.wins + team.losses);
    const rate = team.wins / games;
    const expected = team.expectation / 125;
    const security = clamp(coach.jobSecurity + (rate - expected) * 14 + random.fork(`security:${coach.id}`).integer(-2, 2));
    const status: EcosystemCoach["status"] = security < 35 ? "hot-seat" : security < 55 ? "watched" : "secure";
    if (status === "hot-seat" && coach.status !== "hot-seat") {
      stories.push(story(
        save,
        day,
        "coach-pressure",
        `${coach.name} оказался на грани`,
        `${team.name} отстаёт от ожиданий. Рекруты и действующие игроки ждут решения руководства до конца сезона.`,
        4,
        [team.id],
        [],
        [coach.id],
        save.football.recruitment.programs.some((program) => program.id === team.id && program.interest >= 30),
      ));
    }
    return { ...coach, jobSecurity: security, pressure: clamp(100 - security + team.losses * 2), status };
  });
  return { teams: nextTeams, coaches: nextCoaches, stories };
}

function conferenceOrder(conference: EcosystemConference, teams: EcosystemTeam[]): EcosystemTeam[] {
  return conference.teamIds
    .map((id) => teams.find((team) => team.id === id))
    .filter((team): team is EcosystemTeam => Boolean(team))
    .sort((left, right) => right.conferenceWins - left.conferenceWins || left.conferenceLosses - right.conferenceLosses || right.rating - left.rating);
}

function simulateConferenceChampionships(
  teams: EcosystemTeam[],
  conferences: EcosystemConference[],
  coaches: EcosystemCoach[],
  save: EcosystemCareerState,
  random: SeededRandom,
  day: number,
  seasonYear: number,
): { teams: EcosystemTeam[]; conferences: EcosystemConference[]; coaches: EcosystemCoach[]; stories: EcosystemStory[] } {
  const teamMap = new Map(teams.map((team) => [team.id, { ...team }]));
  const coachMap = new Map(coaches.map((coach) => [coach.id, { ...coach }]));
  const stories: EcosystemStory[] = [];
  const nextConferences = conferences.map((conference) => {
    const finalists = conferenceOrder(conference, teams).slice(0, 2);
    const first = finalists[0];
    const second = finalists[1];
    if (!first || !second) return conference;
    const finalRandom = random.fork(conference.id);
    const firstScore = gameScore(first, second, finalRandom.fork("first"));
    let secondScore = gameScore(second, first, finalRandom.fork("second"));
    if (firstScore === secondScore) secondScore += 3;
    const champion = firstScore > secondScore ? first : second;
    const runnerUp = champion.id === first.id ? second : first;
    const currentChampion = teamMap.get(champion.id) ?? champion;
    teamMap.set(champion.id, { ...currentChampion, wins: currentChampion.wins + 1, championships: currentChampion.championships + 1 });
    const currentRunner = teamMap.get(runnerUp.id) ?? runnerUp;
    teamMap.set(runnerUp.id, { ...currentRunner, losses: currentRunner.losses + 1 });
    const coach = coaches.find((item) => item.teamId === champion.id && item.role === "head-coach");
    if (coach) {
      const nextCoach = coachMap.get(coach.id) ?? coach;
      coachMap.set(coach.id, { ...nextCoach, careerWins: nextCoach.careerWins + 1, reputation: clamp(nextCoach.reputation + 3), jobSecurity: clamp(nextCoach.jobSecurity + 10), status: "secure" });
    }
    stories.push(story(
      save,
      day,
      "championship",
      `${champion.shortName} выиграл ${conference.shortName}`,
      `${champion.name} победил ${runnerUp.name} и забрал титул сезона ${seasonYear}. Результат изменит престиж, набор и тренерский рынок.`,
      5,
      [champion.id, runnerUp.id],
      [],
      coach ? [coach.id] : [],
      save.football.recruitment.programs.some((program) => program.id === champion.id || program.id === runnerUp.id),
    ));
    return { ...conference, champions: [...conference.champions, { seasonYear, teamId: champion.id }].slice(-12) };
  });
  return { teams: [...teamMap.values()], conferences: nextConferences, coaches: [...coachMap.values()], stories };
}

function nextClassYear(value: EcosystemPlayer["classYear"]): EcosystemPlayer["classYear"] | undefined {
  return value === "Freshman" ? "Sophomore" : value === "Sophomore" ? "Junior" : value === "Junior" ? "Senior" : undefined;
}

function createIncomingPlayer(team: EcosystemTeam, position: FootballPosition, seasonYear: number, slot: number, random: SeededRandom): EcosystemPlayer {
  const overall = clamp(team.rating - 13 + random.integer(-7, 8), 45, 88);
  return {
    id: `${team.id}:incoming:${seasonYear}:${position}:${slot}`,
    seed: `${team.seed}:incoming:${seasonYear}:${position}:${slot}`,
    name: `${random.pick(PORTAL_FIRST_NAMES)} ${random.pick(PORTAL_LAST_NAMES)}`,
    teamId: team.id,
    level: "college",
    age: 18,
    classYear: "Freshman",
    position,
    overall,
    potential: clamp(overall + random.integer(5, 18), overall, 96),
    health: clamp(90 + random.integer(-8, 9)),
    form: clamp(54 + random.integer(-9, 13)),
    status: "backup",
    depthRank: 3,
    trajectory: "steady",
    nationalRank: random.integer(150, 2200),
    recruitingStage: "committed",
    committedTeamId: team.id,
    eligibilityYears: 4,
    seasonsPlayed: 0,
    transferStatus: "none",
    previousTeamIds: [],
    isHero: false,
    eligibility: createPlayerEligibility("college", 18, "Freshman", seasonYear, random.fork("eligibility"), "full"),
    talent: createTalentProfile({ level: "college", classYear: "Freshman", overall, potential: clamp(overall + 12, overall, 96), nationalRank: random.integer(150, 2200), isHero: false }, team.stateCode, seasonYear, random.fork("talent")),
    usagePlan: "developmental",
    positionHistory: [],
    tactical: createPlayerTacticalProfile({ seed: `${team.seed}:incoming:${seasonYear}:${position}:${slot}`, position, overall, potential: clamp(overall + random.integer(5, 18), overall, 96), classYear: "Freshman" }, team.tactical, random.fork("tactical")),
  };
}

function ensureMinimumCollegePositionRooms(
  players: EcosystemPlayer[],
  teams: EcosystemTeam[],
  seasonYear: number,
  random: SeededRandom,
): EcosystemPlayer[] {
  const next = [...players];
  for (const team of teams.filter((item) => item.level === "college")) {
    for (const position of POSITIONS) {
      let room = next.filter((player) => player.teamId === team.id && player.position === position);
      while (room.length < 2) {
        let slot = 0;
        while (next.some((player) => player.id === `${team.id}:incoming:${seasonYear}:${position}:${slot}`)) slot += 1;
        const incoming = createIncomingPlayer(
          team,
          position,
          seasonYear,
          slot,
          random.fork(`${team.id}:${position}:${slot}`),
        );
        next.push(incoming);
        room = [...room, incoming];
      }
    }
  }
  return next;
}

function rebuildTeamRosters(teams: EcosystemTeam[], players: EcosystemPlayer[], coaches: EcosystemCoach[], constitution: FootballEcosystemState["constitution"]): EcosystemTeam[] {
  return teams.map((team) => ({
    ...team,
    rosterIds: players.filter((player) => player.teamId === team.id).map((player) => player.id),
    coachIds: coaches.filter((coach) => coach.teamId === team.id).map((coach) => coach.id),
    compliance: refreshTeamCompliance(team, players, new SeededRandom(`${team.seed}:compliance:${players.length}`), constitution),
  }));
}

function processTransfers(
  players: EcosystemPlayer[],
  teams: EcosystemTeam[],
  save: EcosystemCareerState,
  random: SeededRandom,
  day: number,
  seasonYear: number,
): { players: EcosystemPlayer[]; teams: EcosystemTeam[]; transactions: EcosystemTransaction[]; stories: EcosystemStory[] } {
  const transactions: EcosystemTransaction[] = [];
  const stories: EcosystemStory[] = [];
  const collegeTeams = teams.filter((team) => team.level === "college");
  const resourceReservations = new Map<string, { recruiting: number; nil: number }>();
  let moves = 0;
  const next = players.map((player) => {
    if (moves >= 10 || player.level !== "college" || player.isHero || player.eligibilityYears <= 1 || player.depthRank < 3) return player;
    const source = teams.find((team) => team.id === player.teamId);
    const coach = save.world.coaches.find((item) => item.teamId === player.teamId && item.role === "head-coach");
    const desire = 0.08 + Math.max(0, 55 - player.form) * 0.003 + (coach?.status === "hot-seat" ? 0.12 : 0);
    const playerRandom = random.fork(player.id);
    if (!playerRandom.chance(desire)) return player;
    const target = collegeTeams
      .filter((team) => {
        const reserved = resourceReservations.get(team.id) ?? { recruiting: 0, nil: 0 };
        return team.id !== player.teamId
          && team.compliance.status !== "violation"
          && team.compliance.estimatedRosterSize < team.compliance.rosterLimit
          && availableRecruitingBudget(team.resources) - reserved.recruiting >= 0.05
          && availableNilCapacity(team.resources) - reserved.nil >= Math.max(0.08, (player.overall - 64) * 0.015);
      })
      .map((team) => {
        const reserved = resourceReservations.get(team.id) ?? { recruiting: 0, nil: 0 };
        return {
          team,
          score:
            team.positionNeeds[player.position] * 0.48
            + (100 - team.rating) * 0.1
            + team.prestige * 0.14
            + resourceRecruitingPower(team.resources) * 0.22
            + Math.max(0, availableNilCapacity(team.resources) - reserved.nil) * 0.7
            + playerRandom.integer(-8, 8),
        };
      })
      .sort((left, right) => right.score - left.score)[0]?.team;
    if (!target) return player;
    const recruitingCost = 0.05;
    const nilCost = Math.max(0.08, (player.overall - 64) * 0.015);
    const reserved = resourceReservations.get(target.id) ?? { recruiting: 0, nil: 0 };
    resourceReservations.set(target.id, {
      recruiting: reserved.recruiting + recruitingCost,
      nil: reserved.nil + nilCost,
    });
    moves += 1;
    const related = player.position === save.football.position && (target.id === save.football.college.signedProgramId || source?.id === save.football.college.signedProgramId);
    const detail = `${player.name}, ${player.position}, ушёл из ${source?.shortName ?? "программы"} в ${target.shortName}. Причина — ограниченная роль и более свободная позиционная комната.`;
    transactions.push({
      id: `portal:${seasonYear}:${player.id}`,
      kind: "portal-entry",
      seasonYear,
      week: save.life.weekNumber,
      createdOn: save.meta.currentDate,
      title: `${player.name} вошёл в трансферный портал`,
      detail: `${player.name} отказался от текущего места в depth chart ${source?.shortName ?? "программы"} и открыл рекрутинг заново.`,
      playerId: player.id,
      fromTeamId: player.teamId,
      relatedToHero: related,
    });
    const transaction: EcosystemTransaction = {
      id: `transfer:${seasonYear}:${player.id}:${target.id}`,
      kind: "transfer",
      seasonYear,
      week: save.life.weekNumber,
      createdOn: save.meta.currentDate,
      title: `${player.name} перешёл в ${target.shortName}`,
      detail,
      playerId: player.id,
      fromTeamId: player.teamId,
      toTeamId: target.id,
      relatedToHero: related,
    };
    transactions.push(transaction);
    stories.push(story(save, day, "transfer", transaction.title, detail, related ? 5 : player.overall >= 78 ? 4 : 2, [player.teamId, target.id], [player.id], [], related));
    return {
      ...player,
      teamId: target.id,
      previousTeamIds: [...player.previousTeamIds, player.teamId].slice(-6),
      transferStatus: "transferred" as const,
      depthRank: 3,
      status: "backup" as const,
      form: clamp(player.form + 4),
    };
  });
  const nextTeams = teams.map((team) => {
    const reserved = resourceReservations.get(team.id);
    if (!reserved) return team;
    return {
      ...team,
      resources: reserveRecruitingResources(team.resources, reserved.recruiting, reserved.nil),
    };
  });
  return { players: next, teams: nextTeams, transactions, stories };
}

function processCoachCarousel(
  teams: EcosystemTeam[],
  coaches: EcosystemCoach[],
  save: EcosystemCareerState,
  random: SeededRandom,
  seasonYear: number,
): { coaches: EcosystemCoach[]; transactions: EcosystemTransaction[]; stories: EcosystemStory[] } {
  const transactions: EcosystemTransaction[] = [];
  const stories: EcosystemStory[] = [];
  let next = [...coaches];
  const openings = teams
    .filter((team) => team.level === "college")
    .filter((team) => {
      const coach = next.find((item) => item.teamId === team.id && item.role === "head-coach");
      const retention = coachRetentionPower(team.resources);
      return Boolean(
        coach
        && coach.status === "hot-seat"
        && team.losses >= 6
        && (team.resources.boardPatience < 58 || retention < 52),
      );
    })
    .sort((left, right) => right.prestige - left.prestige)
    .slice(0, 3);
  const openingTeamIds = new Set(openings.map((team) => team.id));
  const originalCoachIds = new Set(coaches.map((coach) => coach.id));
  const movedCoachIds = new Set<string>();

  for (const team of openings) {
    const fired = next.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
    if (!fired) continue;

    const candidate = [...next]
      .filter((coach) => (
        coach.id !== fired.id
        && coach.teamId !== team.id
        && !openingTeamIds.has(coach.teamId)
        && originalCoachIds.has(coach.id)
        && !movedCoachIds.has(coach.id)
      ))
      .map((coach) => {
        const candidateTeam = teams.find((item) => item.id === coach.teamId);
        const promotion = coach.role === "coordinator" ? 10 : 0;
        const upward = candidateTeam && candidateTeam.prestige < team.prestige ? 7 : 0;
        const sourceRetention = candidateTeam ? coachRetentionPower(candidateTeam.resources) : 45;
        const targetPower = coachRetentionPower(team.resources);
        return {
          coach,
          score:
            coach.reputation * 0.3
            + coach.development * 0.23
            + coach.recruiting * 0.17
            + targetPower * 0.22
            - sourceRetention * 0.08
            + promotion
            + upward
            + random.fork(`${team.id}:${coach.id}`).integer(-7, 7),
        };
      })
      .sort((left, right) => right.score - left.score)[0]?.coach;
    if (!candidate) continue;

    const oldTeamId = candidate.teamId;
    const oldRole = candidate.role;
    next = next.filter((coach) => coach.id !== fired.id);
    const firedDetail = `${team.name} уволил ${fired.name} после сезона ${team.wins}–${team.losses}. Его рекрутинговые обещания потеряли силу.`;
    transactions.push({
      id: `coach-fired:${seasonYear}:${fired.id}`,
      kind: "coach-fired",
      seasonYear,
      week: save.life.weekNumber,
      createdOn: save.meta.currentDate,
      title: `${team.shortName} открыл вакансию`,
      detail: firedDetail,
      coachId: fired.id,
      fromTeamId: team.id,
      relatedToHero: team.id === save.football.college.signedProgramId || save.football.recruitment.programs.some((program) => program.id === team.id && program.interest >= 35),
    });

    next = next.map((coach) => coach.id === candidate.id ? {
      ...coach,
      teamId: team.id,
      role: "head-coach" as const,
      previousTeamIds: [...coach.previousTeamIds, oldTeamId].slice(-8),
      tenureYears: 0,
      jobSecurity: 68,
      pressure: 24,
      status: "secure" as const,
      reputation: clamp(coach.reputation + (oldRole === "coordinator" ? 3 : 1)),
    } : coach);
    movedCoachIds.add(candidate.id);

    const replacementRandom = random.fork(`replacement:${oldTeamId}:${seasonYear}:${candidate.id}`);
    const replacementBaseId = `${oldTeamId}:replacement:${seasonYear}:${oldRole}:${candidate.id}`;
    let replacementId = replacementBaseId;
    let replacementSuffix = 1;
    while (next.some((coach) => coach.id === replacementId)) {
      replacementId = `${replacementBaseId}:${replacementSuffix}`;
      replacementSuffix += 1;
    }
    const replacement: EcosystemCoach = {
      id: replacementId,
      seed: replacementId,
      name: `Coach ${replacementRandom.integer(100, 999)}`,
      teamId: oldTeamId,
      role: oldRole,
      age: replacementRandom.integer(31, 61),
      reputation: clamp(
        (teams.find((item) => item.id === oldTeamId)?.prestige ?? 60)
        + (teams.find((item) => item.id === oldTeamId) ? coachRetentionPower(teams.find((item) => item.id === oldTeamId)!.resources) * 0.12 : 0)
        + replacementRandom.integer(-18, 6),
      ),
      development: clamp(58 + replacementRandom.integer(-12, 18)),
      recruiting: clamp(56 + replacementRandom.integer(-12, 18)),
      pressure: 28,
      jobSecurity: 66,
      status: "secure",
      philosophy: "Новый штаб перестраивает роли и требования",
      tenureYears: 0,
      careerWins: 0,
      careerLosses: 0,
      previousTeamIds: [],
    };
    next.push(replacement);

    const hired = next.find((coach) => coach.id === candidate.id);
    if (!hired) continue;
    const related = team.id === save.football.college.signedProgramId || oldTeamId === save.football.college.signedProgramId;
    const detail = `${hired.name} покинул ${teams.find((item) => item.id === oldTeamId)?.shortName ?? "прежнюю программу"} и возглавил ${team.name}. Схема, роли и набор будут пересмотрены.`;
    transactions.push({
      id: `coach-hired:${seasonYear}:${hired.id}:${team.id}`,
      kind: "coach-hired",
      seasonYear,
      week: save.life.weekNumber,
      createdOn: save.meta.currentDate,
      title: `${team.shortName} нанял ${hired.name}`,
      detail,
      coachId: hired.id,
      fromTeamId: oldTeamId,
      toTeamId: team.id,
      relatedToHero: related,
    });
    stories.push(story(save, save.life.completedDays, "coach-move", `${team.shortName} сменил направление`, detail, related ? 5 : 4, [oldTeamId, team.id], [], [hired.id], related));
  }
  return { coaches: next, transactions, stories };
}

function archiveSeason(teams: EcosystemTeam[], conferences: EcosystemConference[], coaches: EcosystemCoach[], seasonYear: number): EcosystemTeamSeasonRecord[] {
  return conferences.flatMap((conference) => conferenceOrder(conference, teams).map((team, index) => {
    const headCoach = coaches.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
    return {
      id: `${seasonYear}:${team.id}`,
      seasonYear,
      teamId: team.id,
      conferenceId: conference.id,
      wins: team.wins,
      losses: team.losses,
      conferenceWins: team.conferenceWins,
      conferenceLosses: team.conferenceLosses,
      finalRating: team.rating,
      finish: index + 1,
      conferenceChampion: conference.champions.some((champion) => champion.seasonYear === seasonYear && champion.teamId === team.id),
      ...(headCoach ? { headCoachId: headCoach.id } : {}),
    };
  }));
}

function processOffseason(
  world: FootballEcosystemState,
  save: EcosystemCareerState,
  random: SeededRandom,
  day: number,
): FootballEcosystemState {
  const seasonYear = world.seasonYear;
  const unsignedSeniors = world.players.filter((player) => player.level === "high-school" && player.classYear === "Senior" && !player.committedTeamId);
  const transactions: EcosystemTransaction[] = [];
  const stories: EcosystemStory[] = [];
  const archived = archiveSeason(world.teams, world.conferences, world.coaches, seasonYear);
  let players: EcosystemPlayer[] = [];
  for (const player of world.players) {
    if (player.isHero) {
      if (player.level === "college") {
        const nextEligibility = rollEligibilityIntoNextSeason(player, seasonYear + 1, random.fork(`eligibility:${player.id}`), world.constitution);
        const nextYear = nextClassYear(player.classYear) ?? "Senior";
        players.push({
          ...player,
          age: Math.min(24, player.age + 1),
          classYear: nextYear,
          eligibilityYears: Math.max(0, player.eligibilityYears - 1),
          seasonsPlayed: player.seasonsPlayed + 1,
          transferStatus: "none",
          eligibility: nextEligibility,
        });
      } else {
        players.push(player);
      }
      continue;
    }
    if (player.level === "college") {
      const nextYear = nextClassYear(player.classYear) ?? "Senior";
      const nextEligibility = rollEligibilityIntoNextSeason(player, seasonYear + 1, random.fork(`eligibility:${player.id}`), world.constitution);
      if (!nextEligibility.athleticallyEligible) {
        const detail = `${player.name}, ${player.position}, завершил университетскую карьеру в ${world.teams.find((team) => team.id === player.teamId)?.shortName ?? "программе"}: окно eligibility закрыто.`;
        transactions.push({ id: `graduation:${seasonYear}:${player.id}`, kind: "graduation", seasonYear, week: save.life.weekNumber, createdOn: save.meta.currentDate, title: `${player.name} завершил eligibility`, detail, playerId: player.id, fromTeamId: player.teamId, relatedToHero: player.teamId === save.football.college.signedProgramId && player.position === save.football.position });
        continue;
      }
      const consumedSeason = player.eligibility.model === "age-based-five-year" || player.eligibility.gamesPlayedThisSeason > world.constitution.legacyRedshirtGameLimit;
      players.push({ ...player, age: Math.min(24, player.age + 1), classYear: nextYear, eligibilityYears: Math.max(0, player.eligibilityYears - (consumedSeason ? 1 : 0)), seasonsPlayed: player.seasonsPlayed + (consumedSeason ? 1 : 0), transferStatus: "none", eligibility: nextEligibility });
      continue;
    }
    if (player.classYear === "Senior" && player.committedTeamId) {
      const target = world.teams.find((team) => team.id === player.committedTeamId);
      if (target) {
        const enrolled = { ...player, teamId: target.id, level: "college" as const, age: 18, classYear: "Freshman" as const, eligibilityYears: 5, seasonsPlayed: 0, depthRank: 3, status: "backup" as const, transferStatus: "none" as const, previousTeamIds: [...player.previousTeamIds, player.teamId].slice(-6), eligibility: createPlayerEligibility("college", 18, "Freshman", seasonYear + 1, random.fork(`enrollment:${player.id}`), "full") };
        players.push(enrolled);
        const detail = `${player.name}, ${player.position}, прибыл в ${target.name} и занял место в новой позиционной комнате.`;
        transactions.push({ id: `enroll:${seasonYear}:${player.id}:${target.id}`, kind: "recruit-enrolled", seasonYear, week: save.life.weekNumber, createdOn: save.meta.currentDate, title: `${player.name} зачислен в ${target.shortName}`, detail, playerId: player.id, fromTeamId: player.teamId, toTeamId: target.id, relatedToHero: target.id === save.football.college.signedProgramId && player.position === save.football.position });
        continue;
      }
    }
    const nextYear = nextClassYear(player.classYear);
    if (nextYear) players.push({ ...player, age: Math.min(19, player.age + 1), classYear: nextYear, recruitingStage: nextYear === "Senior" ? "tracked" : "unranked" });
  }
  let teams = world.teams.map((team) => {
    const resources = rebalanceAnnualResources(
      team,
      team.resources,
      seasonYear + 1,
      random.fork(`budget:${team.id}:${seasonYear + 1}`),
    );
    if (team.level === "college" && resources.annualBudget < team.resources.annualBudget * 0.94) {
      const detail = `${team.name} сократил футбольный бюджет с $${team.resources.annualBudget.toFixed(1)}M до $${resources.annualBudget.toFixed(1)}M. Штаб будет экономить на рекрутинге, удержании тренеров или поддержке состава.`;
      transactions.push({
        id: `budget-cut:${seasonYear}:${team.id}`,
        kind: "budget-cut",
        seasonYear,
        week: save.life.weekNumber,
        createdOn: save.meta.currentDate,
        title: `${team.shortName} сократил бюджет`,
        detail,
        fromTeamId: team.id,
        relatedToHero: team.id === save.football.college.signedProgramId,
      });
      stories.push(story(
        save,
        day,
        "budget-crunch",
        `${team.shortName} урезал расходы`,
        detail,
        team.id === save.football.college.signedProgramId ? 5 : 3,
        [team.id],
        [],
        team.coachIds,
        team.id === save.football.college.signedProgramId,
      ));
    } else if (team.level === "college" && resources.annualBudget > team.resources.annualBudget * 1.08) {
      const detail = `${team.name} увеличил футбольный бюджет до $${resources.annualBudget.toFixed(1)}M после роста донорской поддержки и результатов.`;
      stories.push(story(
        save,
        day,
        "resource-shift",
        `${team.shortName} получил больше ресурсов`,
        detail,
        team.id === save.football.college.signedProgramId ? 4 : 2,
        [team.id],
        [],
        team.coachIds,
        team.id === save.football.college.signedProgramId,
      ));
    }
    return { ...team, resources };
  });
  const rosterManagement = reviewRosterManagement(
    teams,
    players,
    world.coaches,
    world.constitution,
    seasonYear + 1,
    1,
    random.fork("roster-management"),
    { applyOffseasonDecisions: true, reason: "Межсезонный аудит после выпусков и трансферного портала." },
  );
  teams = rosterManagement.teams;
  players = rosterManagement.players;
  for (const [index, draft] of rosterManagement.drafts.entries()) {
    const related = draft.teamId === save.football.college.signedProgramId || draft.playerId === "hero";
    stories.push(story(
      save,
      day,
      draft.kind,
      draft.title,
      draft.detail,
      related ? 5 : draft.importance,
      [draft.teamId],
      draft.playerId ? [draft.playerId] : [],
      [],
      related,
    ));
    const transactionKind = draft.kind === "position-change"
      ? "position-change" as const
      : draft.kind === "scholarship"
        ? "scholarship-awarded" as const
        : draft.kind === "redshirt"
          ? "redshirt-assigned" as const
          : undefined;
    if (transactionKind) {
      transactions.push({
        id: `roster:${seasonYear + 1}:${transactionKind}:${draft.playerId ?? draft.teamId}:${index}`,
        kind: transactionKind,
        seasonYear: seasonYear + 1,
        week: save.life.weekNumber,
        createdOn: save.meta.currentDate,
        title: draft.title,
        detail: draft.detail,
        ...(draft.playerId ? { playerId: draft.playerId } : {}),
        fromTeamId: draft.teamId,
        toTeamId: draft.teamId,
        relatedToHero: related,
      });
    }
  }

  const talentFlow = processAnnualTalentFlow(
    { ...world, players, teams },
    players,
    teams,
    unsignedSeniors,
    seasonYear + 1,
    random.fork("talent-flow"),
    save.football.college.signedProgramId,
  );
  players = talentFlow.players;
  teams = talentFlow.teams;
  stories.push(...talentFlow.stories.map((draft, index) => story(
    save,
    day,
    draft.kind,
    draft.title,
    draft.detail,
    draft.importance,
    draft.teamIds,
    draft.playerIds,
    [],
    draft.relatedToHero,
  )));
  transactions.push(...talentFlow.transactions.map((draft, index) => ({
    id: `talent:${seasonYear + 1}:${draft.kind}:${draft.playerId ?? draft.toTeamId ?? index}`,
    kind: draft.kind,
    seasonYear: seasonYear + 1,
    week: save.life.weekNumber,
    createdOn: save.meta.currentDate,
    title: draft.title,
    detail: draft.detail,
    ...(draft.playerId ? { playerId: draft.playerId } : {}),
    ...(draft.fromTeamId ? { fromTeamId: draft.fromTeamId } : {}),
    ...(draft.toTeamId ? { toTeamId: draft.toTeamId } : {}),
    relatedToHero: draft.relatedToHero,
  })));

  players = ensureMinimumCollegePositionRooms(
    players,
    teams,
    seasonYear + 1,
    random.fork("minimum-position-rooms"),
  );
  const carousel = processCoachCarousel(teams, world.coaches, save, random.fork("carousel"), seasonYear);
  transactions.push(...carousel.transactions);
  stories.push(...carousel.stories);
  const tacticalChangeTeamIds = new Set(carousel.transactions.filter((item) => item.kind === "coach-hired").map((item) => item.toTeamId).filter((id): id is string => Boolean(id)));
  teams = teams.map((team) => {
    if (!tacticalChangeTeamIds.has(team.id)) return team;
    const headCoach = carousel.coaches.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
    if (!headCoach) return team;
    const changed = refreshTacticalIdentityAfterCoachChange(team, headCoach, seasonYear + 1);
    const related = team.id === save.football.college.signedProgramId || save.football.recruitment.programs.some((program) => program.id === team.id && program.interest >= 35);
    const detail = `${team.shortName} устанавливает ${changed.offenseStyle} / ${changed.defenseStyle}. Старые роли пересматриваются, а освоение системы начинается заново.`;
    transactions.push({ id: `tactical-change:${seasonYear + 1}:${team.id}`, kind: "tactical-change", seasonYear: seasonYear + 1, week: save.life.weekNumber, createdOn: save.meta.currentDate, title: `${team.shortName} меняет систему`, detail, toTeamId: team.id, relatedToHero: related });
    stories.push(story(save, day, "tactical-change", `${team.shortName} перестраивает футбол`, detail, related ? 5 : 3, [team.id], [], [headCoach.id], related));
    return changed;
  });
  players = players.map((player) => {
    const team = teams.find((item) => item.id === player.teamId);
    return team ? { ...player, tactical: reevaluatePlayerTacticalProfile(player, team.tactical, seasonYear + 1) } : player;
  });
  const coachReaction = applyCoachMovementConsequences({
    movementMarket: world.movementMarket,
    coachTransactions: carousel.transactions,
    players,
    teams,
    coaches: carousel.coaches,
    context: {
      seasonYear: seasonYear + 1,
      week: Math.max(1, save.life.weekNumber),
      day,
      date: save.meta.currentDate,
      phase: "offseason",
      heroProgramId: save.football.college.signedProgramId,
      heroPosition: save.football.position,
      relevantProgramIds: save.football.recruitment.programs.filter((program) => program.interest >= 25).map((program) => program.id),
    },
    random: random.fork("coach-market-reaction"),
  });
  players = coachReaction.players;
  transactions.push(...coachReaction.transactions);
  stories.push(...coachReaction.stories);
  const postCoachMarket = advanceUnifiedMovementMarket({
    teams,
    players,
    coaches: carousel.coaches,
    talentPipeline: talentFlow.pipeline,
    movementMarket: coachReaction.movementMarket,
    context: {
      seasonYear: seasonYear + 1,
      week: Math.max(1, save.life.weekNumber),
      day,
      date: save.meta.currentDate,
      phase: "offseason",
      heroProgramId: save.football.college.signedProgramId,
      heroPosition: save.football.position,
      relevantProgramIds: save.football.recruitment.programs.filter((program) => program.interest >= 25).map((program) => program.id),
    },
    random: random.fork("post-coach-market"),
  });
  teams = postCoachMarket.teams;
  players = postCoachMarket.players;
  transactions.push(...postCoachMarket.transactions);
  stories.push(...postCoachMarket.stories);
  teams = rebuildTeamRosters(teams, players, carousel.coaches, world.constitution);
  const finalRosterReview = reviewRosterManagement(
    teams,
    players,
    carousel.coaches,
    world.constitution,
    seasonYear + 1,
    1,
    random.fork("final-roster-review"),
    { applyOffseasonDecisions: false, reason: "Новый штаб пересмотрел состав после зачисления класса и тренерской карусели." },
  );
  players = ensureMinimumCollegePositionRooms(
    finalRosterReview.players,
    finalRosterReview.teams,
    seasonYear + 1,
    random.fork("final-minimum-position-rooms"),
  );
  teams = rebuildTeamRosters(finalRosterReview.teams, players, carousel.coaches, world.constitution);
  return {
    ...world,
    players,
    coaches: carousel.coaches,
    teams,
    stories: [...world.stories, ...stories].slice(-120),
    transactions: [...world.transactions, ...transactions].slice(-160),
    teamHistory: [...world.teamHistory, ...archived].slice(-240),
    lastOffseasonYear: seasonYear,
    seasonWeek: 13,
    market: { ...market(players, carousel.coaches, teams, postCoachMarket.talentPipeline, postCoachMarket.movementMarket), coachOpenings: postCoachMarket.movementMarket.coachVacancies.filter((vacancy) => vacancy.status === "open").length },
    talentPipeline: postCoachMarket.talentPipeline,
    movementMarket: postCoachMarket.movementMarket,
  };
}

function resetForNewSeason(world: FootballEcosystemState, nextYear: number): FootballEcosystemState {
  const teams = world.teams.map((team) => team.level === "college" ? { ...team, wins: 0, losses: 0, conferenceWins: 0, conferenceLosses: 0, streak: 0, trend: "stable" as const } : team);
  return {
    ...world,
    seasonYear: nextYear,
    seasonWeek: 1,
    phase: "regular-season",
    teams,
    players: world.players.map((player) => ({ ...player, transferStatus: "none", eligibility: { ...player.eligibility, gamesPlayedThisSeason: 0 } })),
    coaches: world.coaches.map((coach) => ({ ...coach, age: Math.min(80, coach.age + 1), tenureYears: coach.tenureYears + 1 })),
    competition: resetCompetitionForSeason(world.competition, nextYear, world.conferences, teams, new SeededRandom(`competition:${nextYear}`)),
  };
}

function updateHeroPrograms(
  programs: RecruitingProgram[],
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  save: EcosystemCareerState,
): RecruitingProgram[] {
  return programs.map((program) => {
    const team = teams.find((item) => item.id === program.id);
    if (!team) return program;
    const competingCommits = players.filter(
      (player) => player.committedTeamId === program.id && player.position === save.football.position,
    ).length;
    const headCoach = save.world.coaches.find((coach) => coach.teamId === program.id && coach.role === "head-coach");
    const positionNeed = clamp(team.positionNeeds[save.football.position]);
    const depthCompetition = clamp(100 - positionNeed * 0.55 + team.rating * 0.22 + competingCommits * 8);
    const recruitingPower = resourceRecruitingPower(team.resources);
    const staffTrust = clamp(
      22
        + (headCoach?.reputation ?? 50) * 0.32
        + (headCoach?.jobSecurity ?? 55) * 0.24
        + team.resources.boardPatience * 0.1
        - team.resources.financialPressure * 0.12
        - (headCoach?.status === "hot-seat" ? 12 : 0),
    );
    const roleClarity = clamp(
      18
        + positionNeed * 0.31
        + (100 - depthCompetition) * 0.18
        + recruitingPower * 0.08
        - team.resources.financialPressure * 0.08
        - (headCoach?.status === "hot-seat" ? 8 : 0),
    );
    let lastUpdate = program.lastUpdate;
    if (competingCommits > 0) {
      lastUpdate = `В наборе уже ${competingCommits} игрок(а) на позицию ${save.football.position}; свободное место стало уже.`;
    }
    if (headCoach?.status === "hot-seat") {
      lastUpdate = `${headCoach.name} находится под давлением; стабильность обещаний снизилась.`;
    }
    if (team.resources.financialPressure >= 68) {
      lastUpdate = `${team.shortName} работает в режиме экономии; ресурсы на набор, NIL и удержание штаба ограничены.`;
    }
    return { ...program, positionNeed, depthCompetition, staffTrust, roleClarity, lastUpdate };
  });
}

function market(players: EcosystemPlayer[], coaches: EcosystemCoach[], teams: EcosystemTeam[], talentPipeline: FootballEcosystemState["talentPipeline"], movementMarket: FootballEcosystemState["movementMarket"]) {
  const seniors = players.filter((player) => player.level === "high-school" && player.classYear === "Senior");
  const committedPlayers = seniors.filter((player) => player.recruitingStage === "committed").length;
  const collegeTeams = teams.filter((team) => team.level === "college");
  return {
    openScholarships: collegeTeams.reduce((sum, team) => sum + Math.max(0, team.compliance.fundedScholarships - team.compliance.scholarshipsUsed), 0),
    activeRecruitments: seniors.filter((player) => player.recruitingStage === "tracked" || player.recruitingStage === "offered").length,
    committedPlayers,
    coachingHotSeats: coaches.filter((coach) => coach.status === "hot-seat").length,
    portalPlayers: players.filter((player) => player.transferStatus === "portal").length,
    coachOpenings: 0,
    totalRecruitingBudget: Math.round(collegeTeams.reduce((sum, team) => sum + availableRecruitingBudget(team.resources), 0) * 100) / 100,
    totalNilCapacity: Math.round(collegeTeams.reduce((sum, team) => sum + availableNilCapacity(team.resources), 0) * 100) / 100,
    programsUnderFinancialPressure: collegeTeams.filter((team) => team.resources.financialPressure >= 65).length,
    annualProspects: players.filter((player) => player.level === "high-school" && player.talent.graduationYear >= talentPipeline.generationYear).length,
    jucoProspects: talentPipeline.independentProspects.filter((prospect) => prospect.route === "juco").length,
    walkOnProspects: talentPipeline.independentProspects.filter((prospect) => prospect.route === "walk-on").length,
    nationallyExposedProspects: players.filter((player) => player.level === "high-school" && player.talent.exposure === "national").length,
    plannedClassSpots: collegeTeams.reduce((sum, team) => sum + team.rosterPlan.targetClassSize, 0),
    developmentalPlayers: players.filter((player) => player.usagePlan === "developmental" || player.usagePlan === "redshirt").length,
    plannedPositionChanges: collegeTeams.reduce((sum, team) => sum + team.rosterPlan.positionChanges.filter((change) => !change.applied).length, 0),
    activeNegotiations: movementMarket.negotiations.filter((negotiation) => negotiation.status === "offered").length,
    withdrawnOffers: movementMarket.withdrawnOffers,
    transferCandidates: players.filter((player) => player.level === "college" && (player.transferStatus === "portal" || player.depthRank >= 3) && player.eligibilityYears > 1).length,
    lowSchemeFitPlayers: players.filter((player) => player.level === "college" && player.tactical.schemeFit < 55).length,
    programsInstallingNewSystems: collegeTeams.filter((team) => team.tactical.installation < 58 || team.tactical.continuity < 48).length,
  };
}

function buildDigest(stories: EcosystemStory[], world: FootballEcosystemState): string[] {
  const recent = stories
    .slice(-18)
    .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.importance - left.importance)
    .slice(0, 4)
    .map((item) => item.detail);
  if (recent.length > 0) return recent;
  return [
    `${world.market.activeRecruitments} выпускников остаются в активном рекрутинге.`,
    `${world.market.coachingHotSeats} тренерских штабов работают под угрозой перемен.`,
    `${world.market.activeNegotiations} предложений остаются активными на едином рынке движения.`,
  ];
}

export function advanceFootballEcosystem<T extends EcosystemCareerState>(save: T): T {
  let world = save.world;
  let talentPipeline = world.talentPipeline;
  let programs = save.football.recruitment.programs;
  let movementMarket = world.movementMarket;
  let competition = world.competition;
  const generatedStories: EcosystemStory[] = [];
  const generatedTransactions: EcosystemTransaction[] = [];
  const targetDay = save.life.completedDays;
  const startDay = world.lastSimulatedDay;
  const startDate = world.lastUpdatedOn;

  for (let day = startDay + 1; day <= targetDay; day += 1) {
    const simulatedDate = addGameDays(startDate, day - startDay);
    const cycle = resolveWorldCycle(simulatedDate);
    const random = new SeededRandom(`${save.meta.worldSeed}:ecosystem-day:${day}`);
    const daySave: EcosystemCareerState = {
      ...save,
      meta: { ...save.meta, currentDate: simulatedDate },
      world,
    };
    let teams = syncHeroSeasonTeams(world.teams, daySave);
    let conferences = world.conferences;
    const dailyPlayers = updatePlayersDaily(world.players, teams, daySave, random.fork("players"), day);
    let players = dailyPlayers.players;
    generatedStories.push(...dailyPlayers.stories);
    const tacticalProgress = advanceTacticalInstallation(teams, players, world.coaches, day);
    teams = tacticalProgress.teams;
    players = tacticalProgress.players;
    let coaches = world.coaches;

    if (day % 7 === 0) {
      const campResult = simulateTalentCamps(
        talentPipeline,
        players,
        cycle,
        random.fork("talent-camps"),
        save.football.school.id,
      );
      talentPipeline = campResult.pipeline;
      players = campResult.players;
      generatedStories.push(...campResult.stories.map((draft) => story(
        daySave,
        day,
        draft.kind,
        draft.title,
        draft.detail,
        draft.importance,
        draft.teamIds,
        draft.playerIds,
        [],
        draft.relatedToHero,
      )));

      const depth = reorderDepthCharts(players, daySave, day);
      players = depth.players;
      generatedStories.push(...depth.stories);

      const rosterReview = reviewRosterManagement(
        teams,
        players,
        coaches,
        world.constitution,
        cycle.seasonYear,
        cycle.phaseWeek,
        random.fork("roster-review"),
        { applyOffseasonDecisions: false, reason: `Недельный аудит: ${cycle.phase}, неделя ${cycle.phaseWeek}.` },
      );
      teams = rosterReview.teams;
      players = rosterReview.players;
      generatedStories.push(...rosterReview.drafts.map((draft) => story(
        daySave,
        day,
        draft.kind,
        draft.title,
        draft.detail,
        draft.teamId === save.football.college.signedProgramId ? 4 : draft.importance,
        [draft.teamId],
        draft.playerId ? [draft.playerId] : [],
        [],
        draft.teamId === save.football.college.signedProgramId || draft.playerId === "hero",
      )));

      const resourceUpdate = updateProgramResourcesWeekly(
        teams,
        players,
        daySave,
        random.fork("resources"),
        day,
        cycle.phase,
      );
      teams = resourceUpdate.teams;
      generatedStories.push(...resourceUpdate.stories);

      const unifiedMarket = advanceUnifiedMovementMarket({
        teams,
        players,
        coaches,
        talentPipeline,
        movementMarket,
        context: {
          seasonYear: cycle.seasonYear,
          week: Math.max(1, cycle.phaseWeek),
          day,
          date: simulatedDate,
          phase: cycle.phase,
          heroProgramId: save.football.college.signedProgramId,
          heroPosition: save.football.position,
          relevantProgramIds: save.football.recruitment.programs.filter((program) => program.interest >= 25).map((program) => program.id),
        },
        random: random.fork("unified-movement-market"),
      });
      teams = unifiedMarket.teams;
      players = unifiedMarket.players;
      talentPipeline = unifiedMarket.talentPipeline;
      movementMarket = unifiedMarket.movementMarket;
      generatedStories.push(...unifiedMarket.stories);
      generatedTransactions.push(...unifiedMarket.transactions);

      if (cycle.phase === "regular-season" && world.seasonYear === cycle.seasonYear && world.seasonWeek <= 10) {
        const round = simulateCompetitionWeek(competition, teams, players, coaches, cycle.seasonYear, world.seasonWeek, random.fork("competition-week"));
        competition = round.competition;
        teams = round.teams;
        coaches = round.coaches;
        const played = new Set(round.playedTeamIds);
        players = players.map((player) => player.level === "college"
          && played.has(player.teamId)
          && (player.usagePlan === "starter" || player.usagePlan === "rotation" || player.usagePlan === "special-teams")
          && isPlayerAvailable(player)
          ? { ...player, eligibility: { ...player.eligibility, gamesPlayedThisSeason: player.eligibility.gamesPlayedThisSeason + 1 } }
          : player);
        generatedStories.push(...round.stories.map((draft) => story(daySave, day, draft.kind, draft.title, draft.detail, draft.importance, draft.teamIds, draft.playerIds, [], draft.teamIds.includes(save.football.college.signedProgramId ?? ""))));
        teams = recalculateTeamStrength(teams, players);
        world = { ...world, seasonWeek: Math.min(11, world.seasonWeek + 1), phase: world.seasonWeek >= 10 ? "postseason" : "regular-season" };
      } else if (cycle.phase === "postseason" && competition.playoff.stage !== "complete") {
        const postseason = simulateCompetitionPostseason(competition, teams, players, coaches, conferences, random.fork(`postseason:${competition.playoff.stage}`));
        competition = postseason.competition;
        teams = postseason.teams;
        coaches = postseason.coaches;
        conferences = postseason.conferences;
        const played = new Set(postseason.playedTeamIds);
        players = players.map((player) => player.level === "college"
          && played.has(player.teamId)
          && (player.usagePlan === "starter" || player.usagePlan === "rotation" || player.usagePlan === "special-teams")
          && isPlayerAvailable(player)
          ? { ...player, eligibility: { ...player.eligibility, gamesPlayedThisSeason: player.eligibility.gamesPlayedThisSeason + 1 } }
          : player);
        generatedStories.push(...postseason.stories.map((draft) => story(daySave, day, draft.kind, draft.title, draft.detail, draft.importance, draft.teamIds, draft.playerIds, [], draft.teamIds.includes(save.football.college.signedProgramId ?? ""))));
        world = { ...world, conferences, phase: postseason.complete ? "offseason" : "postseason", seasonWeek: postseason.complete ? 15 : world.seasonWeek + 1 };
      } else if (cycle.phase === "winter-evaluation" && world.lastOffseasonYear < cycle.seasonYear) {
        const offseasonWorld = processOffseason({ ...world, teams, players, coaches, movementMarket }, daySave, random.fork("offseason"), day);
        teams = offseasonWorld.teams;
        players = offseasonWorld.players;
        coaches = offseasonWorld.coaches;
        world = offseasonWorld;
        talentPipeline = offseasonWorld.talentPipeline;
        movementMarket = offseasonWorld.movementMarket;
        competition = offseasonWorld.competition;
        conferences = offseasonWorld.conferences;
      } else if (cycle.phase === "preseason" && world.seasonYear < cycle.seasonYear) {
        world = resetForNewSeason({ ...world, teams, players, coaches }, cycle.seasonYear);
        teams = world.teams;
        players = world.players;
        coaches = world.coaches;
        movementMarket = world.movementMarket;
        competition = world.competition;
        conferences = world.conferences;
      }
    }

    world = {
      ...world,
      lastSimulatedDay: day,
      currentWeek: save.life.weekNumber,
      lastUpdatedOn: simulatedDate,
      cycle,
      teams,
      players,
      coaches,
      conferences,
      talentPipeline,
      movementMarket,
      competition,
      market: market(players, coaches, teams, talentPipeline, movementMarket),
    };
  }

  programs = updateHeroPrograms(programs, world.teams, world.players, { ...save, world });
  const synchronizedFootball = syncEcosystemIntoFootball(
    {
      ...save.football,
      recruitment: { ...save.football.recruitment, programs },
    },
    save.character,
    world,
    save.meta.currentDate,
  );
  const stories = [...world.stories, ...generatedStories].slice(-90);
  const transactions = [...world.transactions, ...generatedTransactions].slice(-220);
  world = { ...world, stories, transactions, digest: buildDigest(generatedStories.length > 0 ? generatedStories : world.stories.slice(-12), world) };
  const important = generatedStories.filter((item) => item.relatedToHero && item.importance >= 4).slice(-3);

  return {
    ...save,
    world,
    football: synchronizedFootball,
    history: [
      ...save.history,
      ...important.map((item) => ({
        id: item.id,
        occurredAt: save.meta.updatedAt,
        type: `ecosystem-${item.kind}`,
        title: item.title,
        description: item.detail,
      })),
    ],
  } as T;
}
