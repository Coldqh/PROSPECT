import { SeededRandom } from "../../../core/random/SeededRandom";
import type {
  EcosystemCoach,
  EcosystemPlayer,
  EcosystemSocialBond,
  EcosystemSocialBondKind,
  EcosystemSocialIncident,
  EcosystemSocialIncidentKind,
  EcosystemSocialState,
  EcosystemStoryKind,
  EcosystemTeam,
  EcosystemTeamCulture,
} from "./types";

const MAX_INACTIVE_BONDS = 700;
const MAX_INCIDENTS = 180;

interface BondDraft {
  entityAId: string;
  entityBId: string;
  entityAKind: EcosystemSocialBond["entityAKind"];
  entityBKind: EcosystemSocialBond["entityBKind"];
  teamId: string;
  kind: EcosystemSocialBondKind;
}

export interface SocialStoryDraft {
  kind: Extract<EcosystemStoryKind, EcosystemSocialIncidentKind>;
  title: string;
  detail: string;
  importance: 2 | 3 | 4 | 5;
  teamIds: string[];
  playerIds: string[];
  coachIds: string[];
}

export interface SocialWeekResult {
  social: EcosystemSocialState;
  players: EcosystemPlayer[];
  stories: SocialStoryDraft[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function pairId(left: string, right: string): string {
  return left < right ? `social:${left}:${right}` : `social:${right}:${left}`;
}

function orderedPair<T extends { id: string }>(left: T, right: T): [T, T] {
  return left.id < right.id ? [left, right] : [right, left];
}

function kindPriority(kind: EcosystemSocialBondKind): number {
  return { "position-rival": 5, mentor: 4, "coach-player": 3, staff: 2, teammate: 1 }[kind];
}

function addDraft(drafts: Map<string, BondDraft>, draft: BondDraft): void {
  const id = pairId(draft.entityAId, draft.entityBId);
  const current = drafts.get(id);
  if (!current || kindPriority(draft.kind) > kindPriority(current.kind)) drafts.set(id, draft);
}

function requiredBonds(teams: EcosystemTeam[], players: EcosystemPlayer[], coaches: EcosystemCoach[]): BondDraft[] {
  const drafts = new Map<string, BondDraft>();
  for (const team of teams) {
    const roster = players.filter((player) => player.teamId === team.id);
    const staff = coaches.filter((coach) => coach.teamId === team.id);
    const headCoach = staff.find((coach) => coach.role === "head-coach");
    const coordinator = staff.find((coach) => coach.role === "coordinator");

    if (headCoach && coordinator) {
      const [left, right] = orderedPair(headCoach, coordinator);
      addDraft(drafts, {
        entityAId: left.id,
        entityBId: right.id,
        entityAKind: "coach",
        entityBKind: "coach",
        teamId: team.id,
        kind: "staff",
      });
    }

    for (const player of roster) {
      if (headCoach) {
        const playerFirst = player.id < headCoach.id;
        addDraft(drafts, {
          entityAId: playerFirst ? player.id : headCoach.id,
          entityBId: playerFirst ? headCoach.id : player.id,
          entityAKind: playerFirst ? "player" : "coach",
          entityBKind: playerFirst ? "coach" : "player",
          teamId: team.id,
          kind: "coach-player",
        });
      }
      if (coordinator && player.depthRank <= 2) {
        const playerFirst = player.id < coordinator.id;
        addDraft(drafts, {
          entityAId: playerFirst ? player.id : coordinator.id,
          entityBId: playerFirst ? coordinator.id : player.id,
          entityAKind: playerFirst ? "player" : "coach",
          entityBKind: playerFirst ? "coach" : "player",
          teamId: team.id,
          kind: "coach-player",
        });
      }
    }

    for (const position of ["QB", "RB", "WR", "LB", "CB"] as const) {
      const room = roster
        .filter((player) => player.position === position)
        .sort((left, right) => left.depthRank - right.depthRank || right.overall - left.overall);
      const first = room[0];
      const second = room[1];
      if (first && second) {
        const [left, right] = orderedPair(first, second);
        addDraft(drafts, {
          entityAId: left.id,
          entityBId: right.id,
          entityAKind: "player",
          entityBKind: "player",
          teamId: team.id,
          kind: "position-rival",
        });
      }
    }

    const leader = [...roster]
      .sort((left, right) => Number(right.classYear === "Senior") - Number(left.classYear === "Senior") || right.overall - left.overall)[0];
    const developing = [...roster]
      .filter((player) => player.id !== leader?.id && (player.classYear === "Freshman" || player.depthRank >= 3))
      .sort((left, right) => left.overall - right.overall)
      .slice(0, 2);
    if (leader) {
      for (const player of developing) {
        const [left, right] = orderedPair(leader, player);
        addDraft(drafts, {
          entityAId: left.id,
          entityBId: right.id,
          entityAKind: "player",
          entityBKind: "player",
          teamId: team.id,
          kind: "mentor",
        });
      }
    }

    const core = [...roster]
      .filter((player) => player.status !== "injured")
      .sort((left, right) => right.overall - left.overall)
      .slice(0, 5);
    for (let index = 0; index < core.length - 1; index += 1) {
      const leftPlayer = core[index];
      const rightPlayer = core[index + 1];
      if (!leftPlayer || !rightPlayer) continue;
      const [left, right] = orderedPair(leftPlayer, rightPlayer);
      addDraft(drafts, {
        entityAId: left.id,
        entityBId: right.id,
        entityAKind: "player",
        entityBKind: "player",
        teamId: team.id,
        kind: "teammate",
      });
    }
  }
  return [...drafts.values()];
}

function createBond(draft: BondDraft, seasonYear: number, week: number, random: SeededRandom): EcosystemSocialBond {
  const base = {
    teammate: { trust: 52, respect: 55, chemistry: 56, tension: 18, influence: 46 },
    "position-rival": { trust: 40, respect: 58, chemistry: 43, tension: 48, influence: 62 },
    mentor: { trust: 64, respect: 68, chemistry: 61, tension: 12, influence: 72 },
    "coach-player": { trust: 52, respect: 64, chemistry: 48, tension: 22, influence: 76 },
    staff: { trust: 60, respect: 66, chemistry: 58, tension: 20, influence: 82 },
  }[draft.kind];
  const variance = (value: number, key: string) => clamp(value + random.fork(key).integer(-9, 9));
  return {
    id: pairId(draft.entityAId, draft.entityBId),
    ...draft,
    trust: variance(base.trust, "trust"),
    respect: variance(base.respect, "respect"),
    chemistry: variance(base.chemistry, "chemistry"),
    tension: variance(base.tension, "tension"),
    influence: variance(base.influence, "influence"),
    familiarityWeeks: 0,
    active: true,
    lastSeasonYear: seasonYear,
    lastWeek: week,
  };
}

function entityPlayer(bond: EcosystemSocialBond, players: EcosystemPlayer[]): EcosystemPlayer | undefined {
  return players.find((player) => player.id === bond.entityAId || player.id === bond.entityBId);
}

function bondPlayers(bond: EcosystemSocialBond, players: EcosystemPlayer[]): EcosystemPlayer[] {
  return players.filter((player) => player.id === bond.entityAId || player.id === bond.entityBId);
}

function bondCoaches(bond: EcosystemSocialBond, coaches: EcosystemCoach[]): EcosystemCoach[] {
  return coaches.filter((coach) => coach.id === bond.entityAId || coach.id === bond.entityBId);
}

function updateBond(
  bond: EcosystemSocialBond,
  teamMap: Map<string, EcosystemTeam>,
  playerMap: Map<string, EcosystemPlayer>,
  coachMap: Map<string, EcosystemCoach>,
  seasonYear: number,
  week: number,
  random: SeededRandom,
): EcosystemSocialBond {
  if (!bond.active || !bond.teamId) return bond;
  const team = teamMap.get(bond.teamId);
  if (!team) return { ...bond, active: false };
  const people = [playerMap.get(bond.entityAId), playerMap.get(bond.entityBId)].filter((person): person is EcosystemPlayer => Boolean(person));
  const staff = [coachMap.get(bond.entityAId), coachMap.get(bond.entityBId)].filter((person): person is EcosystemCoach => Boolean(person));
  const result = team.trend === "rising" ? 1.4 : team.trend === "falling" ? -1.5 : 0;
  let trustDelta = result * 0.35;
  let respectDelta = result * 0.2;
  let chemistryDelta = result * 0.45;
  let tensionDelta = result < 0 ? Math.abs(result) * 0.55 : -result * 0.3;

  if (bond.kind === "coach-player") {
    const player = people[0];
    const coach = staff[0];
    if (player) {
      trustDelta += player.trajectory === "surging" ? 1.2 : player.trajectory === "slipping" ? -1.1 : 0;
      trustDelta += player.depthRank === 1 ? 0.7 : player.depthRank >= 3 ? -0.7 : 0;
      trustDelta += (player.tactical.schemeFit - 50) / 55;
      tensionDelta += player.depthRank >= 3 ? 0.8 : -0.25;
    }
    if (coach?.status === "hot-seat") {
      trustDelta -= 1.2;
      tensionDelta += 1.3;
    }
  } else if (bond.kind === "position-rival") {
    const [left, right] = people;
    if (left && right) {
      const overallGap = Math.abs(left.overall - right.overall);
      const depthGap = Math.abs(left.depthRank - right.depthRank);
      tensionDelta += overallGap <= 4 && depthGap <= 1 ? 1.5 : -0.4;
      respectDelta += left.form >= 65 && right.form >= 65 ? 0.8 : 0;
      chemistryDelta -= overallGap <= 4 ? 0.4 : 0;
    }
  } else if (bond.kind === "mentor") {
    trustDelta += 0.9;
    respectDelta += 0.8;
    chemistryDelta += 0.9;
    tensionDelta -= 0.7;
  } else if (bond.kind === "staff") {
    const hotSeats = staff.filter((coach) => coach.status === "hot-seat").length;
    trustDelta += team.tactical.continuity >= 60 ? 0.7 : -0.6;
    chemistryDelta += team.tactical.installation >= 60 ? 0.6 : -0.5;
    tensionDelta += hotSeats > 0 ? 1.4 : -0.4;
  } else {
    chemistryDelta += 0.5;
    tensionDelta -= 0.25;
  }

  const noise = random.integer(-5, 5) / 10;
  return {
    ...bond,
    trust: clamp(bond.trust + trustDelta + noise),
    respect: clamp(bond.respect + respectDelta + noise * 0.5),
    chemistry: clamp(bond.chemistry + chemistryDelta + noise),
    tension: clamp(bond.tension + tensionDelta - noise * 0.4),
    influence: clamp(bond.influence + (bond.kind === "mentor" || bond.kind === "staff" ? 0.3 : 0.1)),
    familiarityWeeks: Math.min(999, bond.familiarityWeeks + 1),
    lastSeasonYear: seasonYear,
    lastWeek: week,
  };
}

function deriveTeamCulture(
  team: EcosystemTeam,
  bonds: EcosystemSocialBond[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  previous: EcosystemTeamCulture | undefined,
  seasonYear: number,
  week: number,
): EcosystemTeamCulture {
  const active = bonds.filter((bond) => bond.active && bond.teamId === team.id);
  const average = (read: (bond: EcosystemSocialBond) => number, fallback: number) => active.length > 0
    ? active.reduce((sum, bond) => sum + read(bond), 0) / active.length
    : fallback;
  const coachBonds = active.filter((bond) => bond.kind === "coach-player");
  const mentorBonds = active.filter((bond) => bond.kind === "mentor");
  const teamPlayers = players.filter((player) => player.teamId === team.id);
  const teamCoaches = coaches.filter((coach) => coach.teamId === team.id);
  const averageTrust = average((bond) => bond.trust, 50);
  const averageChemistry = average((bond) => bond.chemistry, 50);
  const averageRespect = average((bond) => bond.respect, 50);
  const averageTension = average((bond) => bond.tension, 25);
  const coachTrust = coachBonds.length > 0 ? coachBonds.reduce((sum, bond) => sum + bond.trust, 0) / coachBonds.length : 50;
  const leaders = teamPlayers.filter((player) => player.classYear === "Senior" || player.depthRank === 1);
  const headCoach = teamCoaches.find((coach) => coach.role === "head-coach");
  const resultBoost = team.trend === "rising" ? 6 : team.trend === "falling" ? -7 : 0;
  const raw = {
    cohesion: clamp(averageChemistry * 0.48 + averageTrust * 0.34 + (100 - averageTension) * 0.18 + resultBoost),
    accountability: clamp(averageRespect * 0.55 + (headCoach?.development ?? 50) * 0.25 + team.tactical.installation * 0.2),
    coachTrust: clamp(coachTrust + (headCoach?.status === "hot-seat" ? -8 : 0)),
    leadership: clamp(42 + leaders.length * 3.2 + mentorBonds.length * 4 + averageRespect * 0.18),
    conflict: clamp(averageTension + active.filter((bond) => bond.tension >= 70).length * 4),
    morale: clamp(averageChemistry * 0.35 + averageTrust * 0.25 + (100 - averageTension) * 0.2 + 20 + resultBoost),
    stability: clamp(team.tactical.continuity * 0.42 + coachTrust * 0.3 + averageTrust * 0.18 + (100 - averageTension) * 0.1),
  };
  const smooth = (key: keyof typeof raw) => previous ? clamp(previous[key] * 0.55 + raw[key] * 0.45) : raw[key];
  return {
    teamId: team.id,
    cohesion: smooth("cohesion"),
    accountability: smooth("accountability"),
    coachTrust: smooth("coachTrust"),
    leadership: smooth("leadership"),
    conflict: smooth("conflict"),
    morale: smooth("morale"),
    stability: smooth("stability"),
    lastSeasonYear: seasonYear,
    lastWeek: week,
  };
}

function reconcileBonds(
  current: EcosystemSocialBond[],
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  seasonYear: number,
  week: number,
  random: SeededRandom,
): EcosystemSocialBond[] {
  const required = requiredBonds(teams, players, coaches);
  const requiredMap = new Map(required.map((draft) => [pairId(draft.entityAId, draft.entityBId), draft]));
  const existingMap = new Map(current.map((bond) => [bond.id, bond]));
  const active = required.map((draft) => {
    const id = pairId(draft.entityAId, draft.entityBId);
    const existing = existingMap.get(id);
    if (!existing) return createBond(draft, seasonYear, week, random.fork(id));
    return {
      ...existing,
      ...draft,
      active: true,
      lastSeasonYear: seasonYear,
      lastWeek: week,
    };
  });
  const entityIds = new Set([...players.map((player) => player.id), ...coaches.map((coach) => coach.id)]);
  const inactive = current
    .filter((bond) => !requiredMap.has(bond.id))
    .filter((bond) => entityIds.has(bond.entityAId) && entityIds.has(bond.entityBId))
    .map((bond) => ({ ...bond, active: false, teamId: undefined }))
    .filter((bond) => seasonYear - bond.lastSeasonYear <= 2 || bond.influence >= 82)
    .sort((left, right) => right.influence - left.influence || right.lastSeasonYear - left.lastSeasonYear)
    .slice(0, MAX_INACTIVE_BONDS);
  return [...active, ...inactive];
}

function displayName(id: string, players: EcosystemPlayer[], coaches: EcosystemCoach[]): string {
  return players.find((player) => player.id === id)?.name ?? coaches.find((coach) => coach.id === id)?.name ?? id;
}

function createIncident(
  kind: EcosystemSocialIncidentKind,
  team: EcosystemTeam,
  participants: string[],
  seasonYear: number,
  week: number,
  day: number,
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
): EcosystemSocialIncident {
  const names = participants.map((id) => displayName(id, players, coaches));
  const content = {
    mentorship: {
      title: `${names[0] ?? "Лидер"} взял игрока под опеку`,
      detail: `${names[0] ?? "Старший игрок"} регулярно помогает ${names[1] ?? "молодому партнёру"}. В ${team.shortName} появился рабочий канал развития внутри состава.`,
      impact: 3,
    },
    "locker-room-conflict": {
      title: `Конфликт внутри ${team.shortName}`,
      detail: `${names[0] ?? "Игрок"} и ${names[1] ?? "партнёр"} перестали скрывать напряжение. Спор затронул тренировки и разделил часть раздевалки.`,
      impact: -5,
    },
    leadership: {
      title: `${team.shortName} собрался вокруг лидеров`,
      detail: `${names[0] ?? "Лидеры команды"} удержали дисциплину после сложной недели. Молодые игроки приняли требования без открытого конфликта.`,
      impact: 4,
    },
    reconciliation: {
      title: `${names[0] ?? "Игроки"} закрыли старый спор`,
      detail: `${names[0] ?? "Один игрок"} и ${names[1] ?? "другой"} договорились после нескольких напряжённых недель. Конфликт больше не ломает работу группы.`,
      impact: 3,
    },
    "staff-friction": {
      title: `Штаб ${team.shortName} спорит о составе`,
      detail: `${names[0] ?? "Главный тренер"} и ${names[1] ?? "координатор"} расходятся в оценке игроков и распределении повторений. Стабильность системы падает.`,
      impact: -4,
    },
    "broken-promise": {
      title: `${names[0] ?? "Игрок"} больше не верит штабу`,
      detail: `${names[0] ?? "Игрок"} не получил обещанную роль и перестал принимать объяснения ${names[1] ?? "тренера"}. Вероятность ухода выросла.`,
      impact: -5,
    },
  }[kind];
  return {
    id: `social-incident:${seasonYear}:${day}:${team.id}:${kind}`,
    kind,
    seasonYear,
    week,
    teamId: team.id,
    participantIds: participants,
    ...content,
  };
}

function chooseIncident(
  team: EcosystemTeam,
  bonds: EcosystemSocialBond[],
  culture: EcosystemTeamCulture,
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  seasonYear: number,
  week: number,
  day: number,
  random: SeededRandom,
): EcosystemSocialIncident | undefined {
  const active = bonds.filter((bond) => bond.active && bond.teamId === team.id);
  const worst = [...active].sort((left, right) => right.tension - left.tension)[0];
  const mentor = [...active].filter((bond) => bond.kind === "mentor").sort((left, right) => right.trust + right.respect - (left.trust + left.respect))[0];
  const staff = active.find((bond) => bond.kind === "staff");
  const broken = active
    .filter((bond) => bond.kind === "coach-player" && bond.trust <= 32 && bond.tension >= 58)
    .sort((left, right) => right.tension - left.tension)[0];
  const leader = players
    .filter((player) => player.teamId === team.id && (player.classYear === "Senior" || player.depthRank === 1))
    .sort((left, right) => right.overall - left.overall)[0];

  if (worst && worst.tension >= 82) return createIncident("locker-room-conflict", team, [worst.entityAId, worst.entityBId], seasonYear, week, day, players, coaches);
  if (broken && random.chance(0.7)) return createIncident("broken-promise", team, [entityPlayer(broken, players)?.id ?? broken.entityAId, ...bondCoaches(broken, coaches).map((coach) => coach.id)].slice(0, 2), seasonYear, week, day, players, coaches);
  if (staff && staff.tension >= 67 && random.chance(0.65)) return createIncident("staff-friction", team, [staff.entityAId, staff.entityBId], seasonYear, week, day, players, coaches);
  if (mentor && mentor.trust >= 72 && mentor.respect >= 70 && random.chance(0.36)) return createIncident("mentorship", team, [mentor.entityAId, mentor.entityBId], seasonYear, week, day, players, coaches);
  if (culture.leadership >= 70 && culture.cohesion >= 62 && leader && random.chance(0.28)) return createIncident("leadership", team, [leader.id], seasonYear, week, day, players, coaches);
  if (worst && worst.tension >= 58 && worst.tension <= 72 && worst.trust >= 48 && random.chance(0.22)) return createIncident("reconciliation", team, [worst.entityAId, worst.entityBId], seasonYear, week, day, players, coaches);
  return undefined;
}

function applyIncidentToBonds(bonds: EcosystemSocialBond[], incident: EcosystemSocialIncident): EcosystemSocialBond[] {
  const ids = new Set(incident.participantIds);
  return bonds.map((bond) => {
    if (!ids.has(bond.entityAId) || (!ids.has(bond.entityBId) && incident.participantIds.length > 1)) return bond;
    if (incident.kind === "locker-room-conflict" || incident.kind === "staff-friction" || incident.kind === "broken-promise") {
      return { ...bond, trust: clamp(bond.trust - 5), chemistry: clamp(bond.chemistry - 4), tension: clamp(bond.tension + 6) };
    }
    if (incident.kind === "reconciliation") {
      return { ...bond, trust: clamp(bond.trust + 5), chemistry: clamp(bond.chemistry + 4), tension: clamp(bond.tension - 12) };
    }
    return { ...bond, trust: clamp(bond.trust + 3), respect: clamp(bond.respect + 3), chemistry: clamp(bond.chemistry + 3), tension: clamp(bond.tension - 2) };
  });
}

function incidentStory(incident: EcosystemSocialIncident, players: EcosystemPlayer[], coaches: EcosystemCoach[]): SocialStoryDraft {
  const participantPlayers = incident.participantIds.filter((id) => players.some((player) => player.id === id));
  const participantCoaches = incident.participantIds.filter((id) => coaches.some((coach) => coach.id === id));
  return {
    kind: incident.kind,
    title: incident.title,
    detail: incident.detail,
    importance: Math.abs(incident.impact) >= 5 ? 4 : Math.abs(incident.impact) >= 4 ? 3 : 2,
    teamIds: [incident.teamId],
    playerIds: participantPlayers,
    coachIds: participantCoaches,
  };
}

export function createSocialEcosystem(
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  seasonYear: number,
  random: SeededRandom,
  lastProcessedDay = 0,
): EcosystemSocialState {
  const bonds = requiredBonds(teams, players, coaches).map((draft) => createBond(draft, seasonYear, 1, random.fork(pairId(draft.entityAId, draft.entityBId))));
  const teamCultures = teams.map((team) => deriveTeamCulture(team, bonds, players, coaches, undefined, seasonYear, 1));
  return {
    version: 1,
    seasonYear,
    lastProcessedDay,
    bonds,
    teamCultures,
    incidents: [],
    digest: [
      `${bonds.filter((bond) => bond.active).length} активных связей формируют раздевалки и штабы.`,
      `${bonds.filter((bond) => bond.kind === "mentor").length} наставнических пар ускоряют развитие молодых игроков.`,
      `${teamCultures.filter((culture) => culture.conflict >= 60).length} команд начинают сезон с заметным внутренним напряжением.`,
    ],
  };
}

export function simulateSocialWeek(
  social: EcosystemSocialState,
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  coaches: EcosystemCoach[],
  seasonYear: number,
  week: number,
  day: number,
  random: SeededRandom,
): SocialWeekResult {
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const coachMap = new Map(coaches.map((coach) => [coach.id, coach]));
  let bonds = reconcileBonds(social.bonds, teams, players, coaches, seasonYear, week, random.fork("reconcile"))
    .map((bond) => updateBond(bond, teamMap, playerMap, coachMap, seasonYear, week, random.fork(`bond:${bond.id}`)));
  let cultures = teams.map((team) => deriveTeamCulture(
    team,
    bonds,
    players,
    coaches,
    social.teamCultures.find((culture) => culture.teamId === team.id),
    seasonYear,
    week,
  ));
  const newIncidents: EcosystemSocialIncident[] = [];
  for (const team of teams) {
    const culture = cultures.find((item) => item.teamId === team.id);
    if (!culture) continue;
    const incident = chooseIncident(team, bonds, culture, players, coaches, seasonYear, week, day, random.fork(`incident:${team.id}`));
    if (!incident) continue;
    newIncidents.push(incident);
    bonds = applyIncidentToBonds(bonds, incident);
  }
  cultures = teams.map((team) => deriveTeamCulture(
    team,
    bonds,
    players,
    coaches,
    cultures.find((culture) => culture.teamId === team.id),
    seasonYear,
    week,
  ));
  const incidentByPlayer = new Map<string, number>();
  for (const incident of newIncidents) {
    for (const participantId of incident.participantIds) {
      incidentByPlayer.set(participantId, (incidentByPlayer.get(participantId) ?? 0) + incident.impact);
    }
  }
  const nextSocial: EcosystemSocialState = {
    version: 1,
    seasonYear,
    lastProcessedDay: day,
    bonds,
    teamCultures: cultures,
    incidents: [...social.incidents, ...newIncidents].slice(-MAX_INCIDENTS),
    digest: [
      `${bonds.filter((bond) => bond.active).length} активных связей, ${bonds.filter((bond) => bond.active && bond.tension >= 70).length} острых конфликтов.`,
      `${cultures.filter((culture) => culture.cohesion >= 70).length} команд имеют сильную раздевалку; ${cultures.filter((culture) => culture.conflict >= 65).length} расколоты.`,
      `${bonds.filter((bond) => bond.active && bond.kind === "mentor" && bond.trust >= 65).length} наставнических пар реально влияют на развитие.`,
    ],
  };
  const nextPlayers = players.map((player) => {
    const weekly = playerSocialFormModifier(nextSocial, player.id);
    const incident = incidentByPlayer.get(player.id) ?? 0;
    return { ...player, form: clamp(player.form + weekly + incident * 0.35) };
  });
  return {
    social: nextSocial,
    players: nextPlayers,
    stories: newIncidents.map((incident) => incidentStory(incident, players, coaches)),
  };
}

function playerSupportScore(social: EcosystemSocialState, playerId: string): number {
  const bonds = social.bonds.filter((bond) => bond.active && (bond.entityAId === playerId || bond.entityBId === playerId));
  if (bonds.length === 0) return 50;
  return clamp(bonds.reduce((sum, bond) => sum + bond.trust * 0.34 + bond.respect * 0.22 + bond.chemistry * 0.28 - bond.tension * 0.3 + 23, 0) / bonds.length);
}

export function playerSocialDevelopmentMultiplier(social: EcosystemSocialState, playerId: string): number {
  const support = playerSupportScore(social, playerId);
  return Math.max(0.9, Math.min(1.1, 1 + (support - 50) / 500));
}

export function playerSocialFormModifier(social: EcosystemSocialState, playerId: string): number {
  const support = playerSupportScore(social, playerId);
  const playerBond = social.bonds.find((bond) => bond.active && (bond.entityAId === playerId || bond.entityBId === playerId));
  const culture = playerBond?.teamId ? social.teamCultures.find((item) => item.teamId === playerBond.teamId) : undefined;
  const cultureDelta = culture ? (culture.morale - culture.conflict - 10) / 55 : 0;
  return Math.max(-2.2, Math.min(2.2, (support - 50) / 20 + cultureDelta));
}

export function playerTransferPressure(social: EcosystemSocialState, playerId: string): number {
  const bonds = social.bonds.filter((bond) => bond.active && (bond.entityAId === playerId || bond.entityBId === playerId));
  if (bonds.length === 0) return 0.04;
  const teamId = bonds.find((bond) => bond.teamId)?.teamId;
  const culture = social.teamCultures.find((item) => item.teamId === teamId);
  const averageTrust = bonds.reduce((sum, bond) => sum + bond.trust, 0) / bonds.length;
  const averageTension = bonds.reduce((sum, bond) => sum + bond.tension, 0) / bonds.length;
  return Math.max(0, Math.min(0.26, Math.max(0, 48 - averageTrust) * 0.0025 + Math.max(0, averageTension - 45) * 0.003 + Math.max(0, (culture?.conflict ?? 45) - 55) * 0.002));
}

export function teamSocialGameModifier(social: EcosystemSocialState | undefined, teamId: string): number {
  const culture = social?.teamCultures.find((item) => item.teamId === teamId);
  if (!culture) return 0;
  return Math.max(-4.5, Math.min(4.5,
    (culture.cohesion - 50) * 0.035
    + (culture.morale - 50) * 0.025
    + (culture.leadership - 50) * 0.018
    - (culture.conflict - 35) * 0.035,
  ));
}
