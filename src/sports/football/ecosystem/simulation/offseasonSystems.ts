import { SeededRandom } from "../../../../core/random/SeededRandom";
import { createPlayerTacticalProfile, reevaluatePlayerTacticalProfile, refreshTacticalIdentityAfterCoachChange } from "../tactics";
import { createEcosystemCoach, staffRating } from "../coaching";
import { FOOTBALL_ROSTER_POSITIONS, POSITION_ROOM_TARGETS } from "../../team/positions";
import type { FootballRosterPosition } from "../../team/types";
import type { EcosystemCoach, EcosystemConference, EcosystemPlayer, EcosystemStory, EcosystemTeam, EcosystemTeamSeasonRecord, EcosystemTransaction, FootballEcosystemState } from "../types";
import { createPlayerEligibility, refreshTeamCompliance, rollEligibilityIntoNextSeason } from "../constitution";
import { createTalentProfile, processAnnualTalentFlow } from "../talent";
import { availableNilCapacity, availableRecruitingBudget, coachRetentionPower, rebalanceAnnualResources, reserveRecruitingResources } from "../resources";
import { reviewRosterManagement } from "../rosterManagement";
import { advanceUnifiedMovementMarket, applyCoachMovementConsequences } from "../movementMarket";
import { resetCompetitionForSeason } from "../competition";
import { playerTransferPressure, simulateSocialWeek } from "../social";
import type { EcosystemCareerState } from "./EcosystemCareerState";
import { clamp, story } from "./story";
import { market } from "./marketSystems";

export function conferenceOrder(conference: EcosystemConference, teams: EcosystemTeam[]): EcosystemTeam[] {
  return conference.teamIds
    .map((id) => teams.find((team) => team.id === id))
    .filter((team): team is EcosystemTeam => Boolean(team))
    .sort((left, right) => right.conferenceWins - left.conferenceWins || left.conferenceLosses - right.conferenceLosses || right.rating - left.rating);
}


const PORTAL_FIRST_NAMES = ["Avery", "Cam", "Darius", "Eli", "Isaiah", "Jalen", "Malik", "Noah", "Trey", "Xavier"] as const;
const PORTAL_LAST_NAMES = ["Banks", "Coleman", "Davis", "Fields", "Grant", "Harris", "Moore", "Reed", "Turner", "Walker"] as const;
const POSITIONS = FOOTBALL_ROSTER_POSITIONS;

export function nextClassYear(value: EcosystemPlayer["classYear"]): EcosystemPlayer["classYear"] | undefined {
  return value === "Freshman" ? "Sophomore" : value === "Sophomore" ? "Junior" : value === "Junior" ? "Senior" : undefined;
}

export function createIncomingPlayer(team: EcosystemTeam, position: FootballRosterPosition, seasonYear: number, slot: number, random: SeededRandom): EcosystemPlayer {
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

export function ensureMinimumCollegePositionRooms(
  players: EcosystemPlayer[],
  teams: EcosystemTeam[],
  seasonYear: number,
  random: SeededRandom,
): EcosystemPlayer[] {
  const next = [...players];
  for (const team of teams.filter((item) => item.level === "college")) {
    for (const position of POSITIONS) {
      let room = next.filter((player) => player.teamId === team.id && player.position === position && !player.isHero);
      const target = POSITION_ROOM_TARGETS.college[position];
      while (room.length < target) {
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

export function rebuildTeamRosters(teams: EcosystemTeam[], players: EcosystemPlayer[], coaches: EcosystemCoach[], constitution: FootballEcosystemState["constitution"]): EcosystemTeam[] {
  return teams.map((team) => ({
    ...team,
    rosterIds: players.filter((player) => player.teamId === team.id).map((player) => player.id),
    coachIds: coaches.filter((coach) => coach.teamId === team.id).map((coach) => coach.id),
    compliance: refreshTeamCompliance(team, players, new SeededRandom(`${team.seed}:compliance:${players.length}`), constitution),
  }));
}

export function processCoachCarousel(
  teams: EcosystemTeam[],
  coaches: EcosystemCoach[],
  save: EcosystemCareerState,
  random: SeededRandom,
  seasonYear: number,
): { coaches: EcosystemCoach[]; transactions: EcosystemTransaction[]; stories: EcosystemStory[]; changedTeamIds: string[] } {
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
  const changedTeamIds = new Set<string>();

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
        const promotion = coach.role === "offensive-coordinator" || coach.role === "defensive-coordinator" ? 10 : coach.role === "position-coach" ? 4 : 0;
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
      reputation: clamp(coach.reputation + (oldRole === "offensive-coordinator" || oldRole === "defensive-coordinator" ? 3 : oldRole === "position-coach" ? 2 : 1)),
    } : coach);
    movedCoachIds.add(candidate.id);
    changedTeamIds.add(team.id);

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
      tactics: clamp(58 + replacementRandom.integer(-12, 18)),
      adaptability: clamp(56 + replacementRandom.integer(-14, 24)),
      gameManagement: clamp(57 + replacementRandom.integer(-14, 22)),
      temperament: replacementRandom.pick(["calm", "demanding", "volatile", "player-first"] as const),
      offenseSystem: replacementRandom.pick(["air-raid", "west-coast", "power-run", "spread-option", "multiple"] as const),
      defenseSystem: replacementRandom.pick(["quarters-425", "multiple-34", "over-43", "nickel-match", "man-pressure", "multiple-defense"] as const),
      specialtyPositions: oldRole === "offensive-coordinator" ? ["QB", "WR", "RB"] : oldRole === "defensive-coordinator" ? ["EDGE", "LB", "CB"] : ["QB"],
      contractYears: replacementRandom.integer(1, oldRole === "head-coach" ? 5 : 3),
      annualSalary: replacementRandom.integer(180_000, oldRole === "head-coach" ? 4_800_000 : 1_600_000),
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

  const staffRoles = ["head-coach", "offensive-coordinator", "defensive-coordinator", "position-coach"] as const;
  for (const team of teams.filter((item) => item.level === "college")) {
    for (const role of staffRoles) {
      const current = next.find((coach) => coach.teamId === team.id && coach.role === role);
      if (!current) {
        const added = createEcosystemCoach(team, role, random.fork(`missing:${team.id}:${role}:${seasonYear}`));
        next.push({ ...added, id: `${added.id}:${seasonYear}`, seed: `${added.seed}:${seasonYear}` });
        changedTeamIds.add(team.id);
        continue;
      }
      if (current.contractYears > 1) {
        next = next.map((coach) => coach.id === current.id ? { ...coach, contractYears: coach.contractYears - 1 } : coach);
        continue;
      }
      const performance = current.reputation * .28 + current.tactics * .34 + current.development * .2 + current.adaptability * .18;
      const replace = role !== "head-coach" && (performance < 56 || current.jobSecurity < 38 || random.fork(`staff-expiry:${current.id}:${seasonYear}`).chance(.22));
      if (!replace) {
        const renewedYears = random.fork(`staff-renew:${current.id}:${seasonYear}`).integer(2, role === "head-coach" ? 5 : 4);
        next = next.map((coach) => coach.id === current.id ? { ...coach, contractYears: renewedYears } : coach);
        continue;
      }
      const generated = createEcosystemCoach(team, role, random.fork(`staff-replacement:${team.id}:${role}:${seasonYear}`));
      const replacement = {
        ...generated,
        id: `${team.id}-${role}:${seasonYear}`,
        seed: `${team.seed}:${role}:${seasonYear}`,
      };
      next = [...next.filter((coach) => coach.id !== current.id), replacement];
      changedTeamIds.add(team.id);
      const related = team.id === save.football.college.signedProgramId || save.football.recruitment.programs.some((program) => program.id === team.id && program.interest >= 35);
      stories.push(story(
        save,
        save.life.completedDays,
        "coach-move",
        `${team.shortName}: ${role}`,
        `${current.name} → ${replacement.name}`,
        related ? 5 : 3,
        [team.id],
        [],
        [current.id, replacement.id],
        related,
      ));
    }
  }
  return { coaches: next, transactions, stories, changedTeamIds: [...changedTeamIds] };
}

export function archiveSeason(teams: EcosystemTeam[], conferences: EcosystemConference[], coaches: EcosystemCoach[], seasonYear: number): EcosystemTeamSeasonRecord[] {
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

export function processOffseason(
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
      if (player.level === "college" && (save.football.stage === "professional-draft" || save.football.stage === "professional-career") && save.football.professional.declared) {
        const detail = `${player.name} покинул университетскую программу и вошёл в профессиональный пул.`;
        transactions.push({ id: `graduation:${seasonYear}:${player.id}`, kind: "graduation", seasonYear, week: save.life.weekNumber, createdOn: save.meta.currentDate, title: `${player.name} завершил колледж`, detail, playerId: player.id, fromTeamId: player.teamId, relatedToHero: true });
        continue;
      }
      if (player.level === "college") {
        const nextEligibility = rollEligibilityIntoNextSeason(player, seasonYear + 1, random.fork(`eligibility:${player.id}`), world.constitution);
        const consumedSeason = player.eligibility.model === "age-based-five-year"
          || player.eligibility.gamesPlayedThisSeason > world.constitution.legacyRedshirtGameLimit;
        const nextYear = consumedSeason ? nextClassYear(player.classYear) ?? "Senior" : player.classYear;
        players.push({
          ...player,
          age: Math.min(24, player.age + 1),
          classYear: nextYear,
          eligibilityYears: Math.max(0, player.eligibilityYears - (consumedSeason ? 1 : 0)),
          seasonsPlayed: player.seasonsPlayed + (consumedSeason ? 1 : 0),
          transferStatus: player.transferStatus,
          usagePlan: consumedSeason ? player.usagePlan : "redshirt",
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
  const tacticalChangeTeamIds = new Set([
    ...carousel.changedTeamIds,
    ...carousel.transactions.filter((item) => item.kind === "coach-hired").map((item) => item.toTeamId).filter((id): id is string => Boolean(id)),
  ]);
  teams = teams.map((team) => {
    if (!tacticalChangeTeamIds.has(team.id)) return team;
    const headCoach = carousel.coaches.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
    if (!headCoach) return team;
    const staff = carousel.coaches.filter((coach) => coach.teamId === team.id);
    const changed = refreshTacticalIdentityAfterCoachChange(team, headCoach, seasonYear + 1, staff);
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
  const socialRefresh = simulateSocialWeek(
    world.social,
    teams,
    players,
    carousel.coaches,
    seasonYear + 1,
    1,
    day,
    random.fork("social-offseason"),
  );
  players = socialRefresh.players;
  stories.push(...socialRefresh.stories.map((draft) => {
    const related = draft.teamIds.includes(save.football.college.signedProgramId ?? "")
      || draft.playerIds.some((playerId) => players.find((player) => player.id === playerId)?.isHero);
    return story(save, day, draft.kind, draft.title, draft.detail, related ? 5 : draft.importance, draft.teamIds, draft.playerIds, draft.coachIds, related);
  }));
  teams = rebuildTeamRosters(teams, players, carousel.coaches, world.constitution);
  return {
    ...world,
    players,
    coaches: carousel.coaches,
    teams,
    stories: [...world.stories, ...stories].slice(-90),
    transactions: [...world.transactions, ...transactions].slice(-800),
    teamHistory: [...world.teamHistory, ...archived].slice(-240),
    lastOffseasonYear: seasonYear,
    seasonWeek: 13,
    market: { ...market(players, carousel.coaches, teams, postCoachMarket.talentPipeline, postCoachMarket.movementMarket), coachOpenings: postCoachMarket.movementMarket.coachVacancies.filter((vacancy) => vacancy.status === "open").length },
    talentPipeline: postCoachMarket.talentPipeline,
    movementMarket: postCoachMarket.movementMarket,
    social: socialRefresh.social,
  };
}

export function resetForNewSeason(world: FootballEcosystemState, nextYear: number): FootballEcosystemState {
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
    social: { ...world.social, seasonYear: nextYear },
  };
}

