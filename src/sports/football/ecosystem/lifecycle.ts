import type { FootballPosition } from "../career/types";
import type { ProfessionalDraftSelection, ProfessionalProspect, ProfessionalRosterPlayer, ProfessionalTransaction } from "../pro/types";
import type {
  EcosystemCareerRegistry,
  EcosystemPlayer,
  EcosystemPlayerCareerEvent,
  EcosystemPlayerCareerRecord,
  EcosystemTeam,
  EcosystemTransaction,
} from "./types";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function event(
  record: EcosystemPlayerCareerRecord,
  kind: EcosystemPlayerCareerEvent["kind"],
  seasonYear: number,
  week: number,
  detail: string,
  fromTeamId?: string,
  toTeamId?: string,
): EcosystemPlayerCareerEvent {
  return {
    id: `career:${record.playerId}:${kind}:${seasonYear}:${week}:${record.events.length}`,
    seasonYear,
    week,
    kind,
    detail,
    ...(fromTeamId ? { fromTeamId } : {}),
    ...(toTeamId ? { toTeamId } : {}),
  };
}

function initialRecord(player: EcosystemPlayer, team: EcosystemTeam | undefined, seasonYear: number): EcosystemPlayerCareerRecord {
  const stage = player.level === "college" ? "college" : "high-school";
  return {
    playerId: player.id,
    name: player.name,
    position: player.position,
    age: player.age,
    overall: player.overall,
    potential: player.potential,
    currentStage: stage,
    currentTeamId: player.teamId,
    highSchoolTeamIds: player.level === "high-school" ? [player.teamId] : player.previousTeamIds.filter((id) => id.startsWith("hs-")),
    collegeTeamIds: player.level === "college" ? [player.teamId] : [],
    professionalTeamIds: [],
    isHero: player.isHero,
    events: [{
      id: `career:${player.id}:created:${seasonYear}`,
      seasonYear,
      week: 1,
      kind: "created",
      detail: `${player.name} появился в экосистеме${team ? ` в составе ${team.shortName}` : ""}.`,
      toTeamId: player.teamId,
    }],
  };
}

export function createCareerRegistry(players: EcosystemPlayer[], teams: EcosystemTeam[], seasonYear: number): EcosystemCareerRegistry {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  return {
    version: 1,
    records: players.map((player) => initialRecord(player, teamById.get(player.teamId), seasonYear)),
    draftPoolIds: [],
    retiredIds: [],
    lastSyncedSeasonYear: seasonYear,
  };
}

export function syncCareerRegistry(
  registry: EcosystemCareerRegistry,
  players: EcosystemPlayer[],
  teams: EcosystemTeam[],
  transactions: EcosystemTransaction[],
  seasonYear: number,
  week: number,
): EcosystemCareerRegistry {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const records = new Map(registry.records.map((record) => [record.playerId, { ...record, events: [...record.events] }]));
  for (const player of players) {
    const previous = records.get(player.id) ?? initialRecord(player, teamById.get(player.teamId), seasonYear);
    const stage = player.level === "college" ? "college" : "high-school";
    records.set(player.id, {
      ...previous,
      name: player.name,
      position: player.position,
      age: player.age,
      overall: player.overall,
      potential: player.potential,
      currentStage: stage,
      currentTeamId: player.teamId,
      highSchoolTeamIds: unique([...previous.highSchoolTeamIds, ...(player.level === "high-school" ? [player.teamId] : [])]),
      collegeTeamIds: unique([...previous.collegeTeamIds, ...(player.level === "college" ? [player.teamId] : [])]),
      isHero: player.isHero,
    });
  }

  const seen = new Set([...records.values()].flatMap((record) => record.events.map((item) => item.id)));
  for (const transaction of transactions.filter((item) => item.playerId)) {
    const record = records.get(transaction.playerId!);
    if (!record) continue;
    const eventId = `career-tx:${transaction.id}`;
    if (seen.has(eventId)) continue;
    let kind: EcosystemPlayerCareerEvent["kind"] | undefined;
    if (transaction.kind === "graduation") kind = "graduated";
    else if (transaction.kind === "transfer") kind = "transferred";
    else if (transaction.kind === "recruit-enrolled" || transaction.kind === "talent-enrolled") kind = "enrolled";
    else if (transaction.kind === "position-change") kind = "position-change";
    if (!kind) continue;
    const nextStage = kind === "graduated" ? "draft-pool" : record.currentStage;
    records.set(record.playerId, {
      ...record,
      currentStage: nextStage,
      currentTeamId: kind === "graduated" ? undefined : (transaction.toTeamId ?? record.currentTeamId),
      collegeTeamIds: transaction.toTeamId && (kind === "enrolled" || kind === "transferred")
        ? unique([...record.collegeTeamIds, transaction.toTeamId])
        : record.collegeTeamIds,
      events: [...record.events, {
        id: eventId,
        seasonYear: transaction.seasonYear,
        week: transaction.week,
        kind,
        detail: transaction.detail,
        ...(transaction.fromTeamId ? { fromTeamId: transaction.fromTeamId } : {}),
        ...(transaction.toTeamId ? { toTeamId: transaction.toTeamId } : {}),
      }].slice(-48),
    });
  }

  const allRecords = [...records.values()];
  return {
    version: 1,
    records: allRecords,
    draftPoolIds: allRecords.filter((record) => record.currentStage === "draft-pool").map((record) => record.playerId),
    retiredIds: allRecords.filter((record) => record.currentStage === "retired").map((record) => record.playerId),
    lastSyncedSeasonYear: seasonYear,
  };
}

export function registerProfessionalDraftClass(
  registry: EcosystemCareerRegistry,
  prospects: ProfessionalProspect[],
  selections: ProfessionalDraftSelection[],
  roster: ProfessionalRosterPlayer[],
  seasonYear: number,
  week = 1,
): EcosystemCareerRegistry {
  const prospectBySource = new Map(prospects.filter((prospect) => prospect.sourcePlayerId).map((prospect) => [prospect.sourcePlayerId!, prospect]));
  const selectionBySource = new Map(selections.filter((pick) => pick.sourcePlayerId).map((pick) => [pick.sourcePlayerId!, pick]));
  const rosterBySource = new Map(roster.filter((player) => player.sourcePlayerId).map((player) => [player.sourcePlayerId!, player]));
  const records = registry.records.map((record) => {
    const prospect = prospectBySource.get(record.playerId);
    if (!prospect) return record;
    const selection = selectionBySource.get(record.playerId);
    const proPlayer = rosterBySource.get(record.playerId);
    const teamId = selection?.teamId ?? proPlayer?.teamId;
    const declaredEvent = record.events.some((item) => item.kind === "declared" && item.seasonYear === seasonYear)
      ? undefined
      : event(record, "declared", seasonYear, week, `${record.name} вошёл в профессиональный драфт-пул.`, record.currentTeamId);
    const draftedEvent = selection && !record.events.some((item) => item.kind === "drafted" && item.seasonYear === seasonYear)
      ? event(record, "drafted", seasonYear, week, `${record.name} выбран под общим номером ${selection.overallPick}.`, undefined, selection.teamId)
      : undefined;
    return {
      ...record,
      age: proPlayer?.age ?? prospect.age ?? record.age,
      overall: proPlayer?.overall ?? prospect.overall ?? record.overall,
      potential: proPlayer?.potential ?? prospect.potential ?? record.potential,
      currentStage: teamId ? "professional" as const : "free-agent" as const,
      currentTeamId: teamId,
      professionalTeamIds: teamId ? unique([...record.professionalTeamIds, teamId]) : record.professionalTeamIds,
      draftYear: selection ? seasonYear : record.draftYear,
      draftRound: selection?.round ?? record.draftRound,
      draftPick: selection?.overallPick ?? record.draftPick,
      events: [...record.events, ...(declaredEvent ? [declaredEvent] : []), ...(draftedEvent ? [draftedEvent] : [])].slice(-48),
    };
  });
  return {
    ...registry,
    records,
    draftPoolIds: records.filter((record) => record.currentStage === "draft-pool").map((record) => record.playerId),
    retiredIds: records.filter((record) => record.currentStage === "retired").map((record) => record.playerId),
    lastSyncedSeasonYear: Math.max(registry.lastSyncedSeasonYear, seasonYear),
  };
}

export function registerProfessionalDraft(
  registry: EcosystemCareerRegistry,
  selections: ProfessionalDraftSelection[],
  roster: ProfessionalRosterPlayer[],
  seasonYear: number,
  week = 1,
): EcosystemCareerRegistry {
  const selectionBySource = new Map(selections.filter((pick) => pick.sourcePlayerId).map((pick) => [pick.sourcePlayerId!, pick]));
  const rosterBySource = new Map(roster.filter((player) => player.sourcePlayerId).map((player) => [player.sourcePlayerId!, player]));
  const records = registry.records.map((record) => {
    const selection = selectionBySource.get(record.playerId);
    const proPlayer = rosterBySource.get(record.playerId);
    if (!selection && !proPlayer) return record;
    const teamId = selection?.teamId ?? proPlayer?.teamId;
    const alreadyDrafted = record.events.some((item) => item.kind === "drafted" && item.seasonYear === seasonYear);
    const draftedEvent = selection && !alreadyDrafted
      ? event(record, "drafted", seasonYear, week, `${record.name} выбран под общим номером ${selection.overallPick}.`, undefined, selection.teamId)
      : undefined;
    return {
      ...record,
      age: proPlayer?.age ?? record.age,
      overall: proPlayer?.overall ?? record.overall,
      potential: proPlayer?.potential ?? record.potential,
      currentStage: teamId ? "professional" as const : "free-agent" as const,
      currentTeamId: teamId,
      professionalTeamIds: teamId ? unique([...record.professionalTeamIds, teamId]) : record.professionalTeamIds,
      draftYear: selection ? seasonYear : record.draftYear,
      draftRound: selection?.round ?? record.draftRound,
      draftPick: selection?.overallPick ?? record.draftPick,
      events: draftedEvent ? [...record.events, draftedEvent].slice(-48) : record.events,
    };
  });
  return {
    ...registry,
    records,
    draftPoolIds: records.filter((record) => record.currentStage === "draft-pool").map((record) => record.playerId),
    lastSyncedSeasonYear: Math.max(registry.lastSyncedSeasonYear, seasonYear),
  };
}

export function markProfessionalMovement(
  registry: EcosystemCareerRegistry,
  playerId: string,
  stage: "professional" | "free-agent" | "retired",
  seasonYear: number,
  week: number,
  teamId?: string,
  detail?: string,
): EcosystemCareerRegistry {
  const records = registry.records.map((record) => {
    if (record.playerId !== playerId) return record;
    const kind = stage === "retired" ? "retired" : stage === "free-agent" ? "released" : "signed";
    return {
      ...record,
      currentStage: stage,
      currentTeamId: teamId,
      professionalTeamIds: teamId ? unique([...record.professionalTeamIds, teamId]) : record.professionalTeamIds,
      retiredYear: stage === "retired" ? seasonYear : record.retiredYear,
      events: [...record.events, event(record, kind, seasonYear, week, detail ?? `${record.name}: ${stage}.`, record.currentTeamId, teamId)].slice(-48),
    };
  });
  return {
    ...registry,
    records,
    draftPoolIds: records.filter((record) => record.currentStage === "draft-pool").map((record) => record.playerId),
    retiredIds: records.filter((record) => record.currentStage === "retired").map((record) => record.playerId),
  };
}

export function syncProfessionalCareerRegistry(
  registry: EcosystemCareerRegistry,
  roster: ProfessionalRosterPlayer[],
  freeAgents: ProfessionalRosterPlayer[],
  transactions: ProfessionalTransaction[],
  seasonYear: number,
  week: number,
): EcosystemCareerRegistry {
  const activeBySource = new Map(roster.filter((player) => player.sourcePlayerId).map((player) => [player.sourcePlayerId!, player]));
  const freeAgentBySource = new Map(freeAgents.filter((player) => player.sourcePlayerId).map((player) => [player.sourcePlayerId!, player]));
  const records = registry.records.map((record) => {
    const active = activeBySource.get(record.playerId);
    const freeAgent = freeAgentBySource.get(record.playerId);
    const proPlayer = active ?? freeAgent;
    if (proPlayer) {
      const nextStage = active ? "professional" as const : "free-agent" as const;
      const nextTeamId = active?.teamId;
      const moved = record.currentStage !== nextStage || record.currentTeamId !== nextTeamId;
      const movementKind: EcosystemPlayerCareerEvent["kind"] = nextStage === "professional" ? "signed" : "released";
      const movementEvent = moved
        ? event(
            record,
            movementKind,
            seasonYear,
            week,
            nextStage === "professional"
              ? `${record.name} продолжил профессиональную карьеру${nextTeamId ? ` в ${nextTeamId}` : ""}.`
              : `${record.name} вышел на рынок свободных агентов.`,
            record.currentTeamId,
            nextTeamId,
          )
        : undefined;
      return {
        ...record,
        age: proPlayer.age,
        overall: proPlayer.overall,
        potential: proPlayer.potential,
        currentStage: nextStage,
        currentTeamId: nextTeamId,
        professionalTeamIds: nextTeamId ? unique([...record.professionalTeamIds, nextTeamId]) : record.professionalTeamIds,
        events: movementEvent ? [...record.events, movementEvent].slice(-48) : record.events,
      };
    }

    if (record.currentStage !== "professional" && record.currentStage !== "free-agent") return record;
    const relatedTransaction = transactions
      .filter((transaction) => transaction.playerName === record.name)
      .sort((left, right) => right.seasonYear - left.seasonYear || right.week - left.week)[0];
    const explicitRetirement = relatedTransaction?.summary.toLowerCase().includes("завершил карьеру") ?? false;
    if (!explicitRetirement) return record;
    return {
      ...record,
      currentStage: "retired" as const,
      currentTeamId: undefined,
      retiredYear: seasonYear,
      events: record.events.some((item) => item.kind === "retired" && item.seasonYear === seasonYear)
        ? record.events
        : [...record.events, event(record, "retired", seasonYear, week, relatedTransaction?.summary ?? `${record.name} завершил карьеру.`, record.currentTeamId)].slice(-48),
    };
  });

  return {
    ...registry,
    records,
    draftPoolIds: records.filter((record) => record.currentStage === "draft-pool").map((record) => record.playerId),
    retiredIds: records.filter((record) => record.currentStage === "retired").map((record) => record.playerId),
    lastSyncedSeasonYear: Math.max(registry.lastSyncedSeasonYear, seasonYear),
  };
}

export function toProfessionalPosition(position: EcosystemPlayer["position"]): FootballPosition {
  return position;
}
