import type { CareerSave } from "../../storage/saves/schema";

interface TimelineEntry {
  id: string;
  week: number;
  opponent: string;
  score?: string;
  won?: boolean;
  grade?: string;
  snaps?: number;
  upcoming?: boolean;
}

function entriesFor(save: CareerSave): TimelineEntry[] {
  if (save.meta.phase === "professional-career") {
    const career = save.football.professional.heroCareer;
    if (!career) return [];
    const completed = career.gameLog.map((game) => ({
      id: game.gameId,
      week: game.week,
      opponent: save.football.professional.teams.find((team) => team.id === game.opponentId)?.shortName ?? game.opponentId,
      score: `${game.teamScore}–${game.opponentScore}`,
      won: game.won,
      grade: game.grade,
      snaps: game.snaps,
    }));
    const active = save.football.professional.league.schedule.find((game) => game.id === save.football.professional.league.activeGameId && game.status === "scheduled");
    const teamId = career.teamId;
    const opponentId = active && teamId ? (active.homeTeamId === teamId ? active.awayTeamId : active.homeTeamId) : undefined;
    const upcoming = active && opponentId ? [{
      id: active.id,
      week: active.week,
      opponent: save.football.professional.teams.find((team) => team.id === opponentId)?.shortName ?? opponentId,
      upcoming: true,
    }] : [];
    return [...completed.slice(-6), ...upcoming];
  }

  if (save.meta.phase === "college-season") {
    const career = save.football.college.heroCareer;
    if (!career) return [];
    const completed = career.gameLog.map((game) => ({
      id: game.id,
      week: game.week,
      opponent: game.opponentName,
      score: game.score,
      won: game.won,
      grade: game.grade,
      snaps: game.snaps,
    }));
    const next = save.world.competition.schedule
      .filter((game) => game.status === "scheduled" && (game.homeTeamId === career.teamId || game.awayTeamId === career.teamId))
      .sort((left, right) => left.week - right.week)[0];
    const opponentId = next ? (next.homeTeamId === career.teamId ? next.awayTeamId : next.homeTeamId) : undefined;
    const upcoming = next && opponentId ? [{
      id: next.id,
      week: next.week,
      opponent: save.world.teams.find((team) => team.id === opponentId)?.shortName ?? opponentId,
      upcoming: true,
    }] : [];
    return [...completed.slice(-6), ...upcoming];
  }

  const completed = save.football.season.schedule
    .filter((game) => game.status === "complete")
    .map((game) => ({
      id: game.id,
      week: game.week,
      opponent: game.opponentShortName,
      ...(game.heroScore !== undefined && game.opponentScore !== undefined ? { score: `${game.heroScore}–${game.opponentScore}` } : {}),
      ...(game.won !== undefined ? { won: game.won } : {}),
      ...(game.heroGrade ? { grade: game.heroGrade } : {}),
    }));
  const next = save.football.season.schedule.find((game) => game.status === "scheduled");
  const upcoming = next ? [{ id: next.id, week: next.week, opponent: next.opponentShortName, upcoming: true }] : [];
  return [...completed.slice(-6), ...upcoming];
}

interface SeasonTimelinePanelProps {
  save: CareerSave;
}

export function SeasonTimelinePanel({ save }: SeasonTimelinePanelProps) {
  const entries = entriesFor(save);
  if (entries.length === 0) return null;
  return (
    <section className="season-timeline">
      <header><div><small>ХОД СЕЗОНА</small><strong>Последние недели</strong></div><span>{entries.filter((entry) => !entry.upcoming).length} сыграно</span></header>
      <div className="season-timeline__track">
        {entries.map((entry) => (
          <article className={entry.upcoming ? "is-upcoming" : entry.won ? "is-win" : "is-loss"} key={entry.id}>
            <span>W{entry.week}</span>
            <div><small>{entry.upcoming ? "ДАЛЬШЕ" : entry.won ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}</small><strong>{entry.opponent}</strong></div>
            <b>{entry.upcoming ? "—" : entry.score}</b>
            {!entry.upcoming && (entry.grade || entry.snaps !== undefined) && <em>{entry.grade ?? ""}{entry.snaps !== undefined ? ` · ${entry.snaps}` : ""}</em>}
          </article>
        ))}
      </div>
    </section>
  );
}
