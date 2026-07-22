import type { GameDate } from "../../../core/calendar/types";
import type { CharacterState } from "../../../core/character/types";
import type { LifeState } from "../../../core/life/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { FootballCareerState, FootballPosition } from "../career/types";
import type { RecruitingProgram } from "../recruiting/types";
import { evaluateDepthChart } from "../team/evaluateDepthChart";
import type { FootballRosterPlayer } from "../team/types";
import type {
  EcosystemCoach,
  EcosystemPlayer,
  EcosystemStory,
  EcosystemTeam,
  FootballEcosystemState,
} from "./types";


interface EcosystemCareerState {
  meta: {
    worldSeed: string;
    currentDate: GameDate;
    updatedAt: string;
  };
  character: CharacterState;
  life: LifeState;
  football: FootballCareerState;
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
      health = clamp(health + playerRandom.integer(2, 6));
      form = clamp(form - playerRandom.integer(0, 2));
      if (health >= 72) {
        status = player.depthRank === 1 ? "starter" : player.depthRank === 2 ? "rotation" : "backup";
      }
    } else {
      form = clamp(form + playerRandom.integer(-3, 3) + (team?.trend === "rising" ? 1 : team?.trend === "falling" ? -1 : 0));
      health = clamp(health + playerRandom.integer(-2, 2));
      const injuryChance = 0.0012 + Math.max(0, 70 - health) * 0.00012;
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

    if (day % 7 === 0 && status !== "injured") {
      const developmentRoom = Math.max(0, player.potential - overall);
      const development = developmentRoom > 0
        ? (playerRandom.next() * 0.45 + (team?.rating ?? 60) * 0.0015) * Math.min(1, developmentRoom / 18)
        : 0;
      overall = clamp(overall + development, 40, 99);
    }

    const trajectory: EcosystemPlayer["trajectory"] = form >= 72 ? "surging" : form <= 42 ? "slipping" : "steady";
    return {
      ...player,
      health,
      form,
      overall,
      status,
      trajectory,
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
          const leftScore = left.status === "injured" ? -100 : left.overall * 0.62 + left.form * 0.28 + left.health * 0.1;
          const rightScore = right.status === "injured" ? -100 : right.overall * 0.62 + right.form * 0.28 + right.health * 0.1;
          return rightScore - leftScore;
        });
      room.forEach((player, index) => {
        const original = next.find((item) => item.id === player.id);
        if (!original) return;
        const nextRank = index + 1;
        const changed = original.depthRank !== nextRank && original.status !== "injured";
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
      const availability = player.status === "injured" ? 0.72 : 1;
      return total + (player.overall * 0.68 + player.form * 0.2 + player.health * 0.12) * availability;
    }, 0) / Math.max(1, lineup.length);
    const depthStrength = rotation.reduce((total, player) => total + player.overall, 0) / Math.max(1, rotation.length);
    const nextRating = clamp(team.rating * 0.58 + lineupStrength * 0.34 + depthStrength * 0.08, 42, 96);
    const positionNeeds = { ...team.positionNeeds };
    for (const position of ["QB", "RB", "WR", "LB", "CB"] as const satisfies readonly FootballPosition[]) {
      const room = roster.filter((player) => player.position === position);
      if (room.length === 0) continue;
      const best = Math.max(...room.map((player) => player.overall));
      const healthyDepth = room.filter((player) => player.status !== "injured").length;
      const departing = room.filter((player) => player.classYear === "Senior").length;
      const structuralNeed = clamp((82 - best) * 1.35 + Math.max(0, 2 - healthyDepth) * 13 + departing * 6, 8, 96);
      positionNeeds[position] = clamp(positionNeeds[position] * 0.58 + structuralNeed * 0.42, 8, 96);
    }
    return { ...team, rating: nextRating, positionNeeds };
  });
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
  random: SeededRandom,
): EcosystemTeam | undefined {
  const candidates = collegeTeams
    .map((team) => ({
      team,
      score: team.prestige * 0.35 + team.positionNeeds[player.position] * 0.38 + team.rating * 0.18 + random.integer(-10, 10),
    }))
    .filter((candidate) => candidate.team.positionNeeds[player.position] >= 30)
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
  const newCommitments: Array<{ playerId: string; teamId: string; position: FootballPosition }> = [];
  let commitments = 0;
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
    const target = chooseCommitment(player, collegeTeams, playerRandom);
    if (!target) return player;
    commitments += 1;
    newCommitments.push({ playerId: player.id, teamId: target.id, position: player.position });
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
    return { ...team, positionNeeds: needs };
  });
  return { players: nextPlayers, teams: nextTeams, stories };
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
    const staffTrust = clamp(
      28 + (headCoach?.reputation ?? 50) * 0.38 + (headCoach?.jobSecurity ?? 55) * 0.28 - (headCoach?.status === "hot-seat" ? 12 : 0),
    );
    const roleClarity = clamp(22 + positionNeed * 0.34 + (100 - depthCompetition) * 0.2 - (headCoach?.status === "hot-seat" ? 8 : 0));
    let lastUpdate = program.lastUpdate;
    if (competingCommits > 0) {
      lastUpdate = `В наборе уже ${competingCommits} игрок(а) на позицию ${save.football.position}; свободное место стало уже.`;
    }
    if (headCoach?.status === "hot-seat") {
      lastUpdate = `${headCoach.name} находится под давлением; стабильность обещаний снизилась.`;
    }
    return { ...program, positionNeed, depthCompetition, staffTrust, roleClarity, lastUpdate };
  });
}

function market(players: EcosystemPlayer[], coaches: EcosystemCoach[]) {
  const seniors = players.filter((player) => player.level === "high-school" && player.classYear === "Senior");
  const committedPlayers = seniors.filter((player) => player.recruitingStage === "committed").length;
  return {
    openScholarships: Math.max(0, 240 - committedPlayers),
    activeRecruitments: seniors.filter((player) => player.recruitingStage === "tracked" || player.recruitingStage === "offered").length,
    committedPlayers,
    coachingHotSeats: coaches.filter((coach) => coach.status === "hot-seat").length,
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
    "Depth chart команд продолжает меняться из-за формы, здоровья и конкуренции.",
  ];
}

export function advanceFootballEcosystem<T extends EcosystemCareerState>(save: T): T {
  let world = save.world;
  let programs = save.football.recruitment.programs;
  const generatedStories: EcosystemStory[] = [];
  const targetDay = save.life.completedDays;

  for (let day = world.lastSimulatedDay + 1; day <= targetDay; day += 1) {
    const random = new SeededRandom(`${save.meta.worldSeed}:ecosystem-day:${day}`);
    let teams = syncHeroSeasonTeams(world.teams, save);
    const dailyPlayers = updatePlayersDaily(world.players, teams, save, random.fork("players"), day);
    let players = dailyPlayers.players;
    generatedStories.push(...dailyPlayers.stories);
    let coaches = world.coaches;

    if (day % 7 === 0) {
      const depth = reorderDepthCharts(players, save, day);
      players = depth.players;
      generatedStories.push(...depth.stories);

      const teamWeek = simulateCollegeTeams(teams, coaches, save, random.fork("teams"), day);
      teams = teamWeek.teams;
      coaches = teamWeek.coaches;
      generatedStories.push(...teamWeek.stories);

      const recruiting = simulateRecruitingMarket(players, teams, save, random.fork("market"), day);
      players = recruiting.players;
      teams = recalculateTeamStrength(recruiting.teams, players);
      generatedStories.push(...recruiting.stories);
    }

    world = {
      ...world,
      lastSimulatedDay: day,
      currentWeek: save.life.weekNumber,
      lastUpdatedOn: save.meta.currentDate,
      teams,
      players,
      coaches,
      market: market(players, coaches),
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
  world = { ...world, stories, digest: buildDigest(generatedStories, world) };
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
