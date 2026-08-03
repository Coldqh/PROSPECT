import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { formatGameDate } from "../../core/calendar/types";
import { professionalStandings } from "../../sports/football/pro/league";
import { SectionTabs } from "../ui/SectionTabs";
import { ManagerPageHeader } from "./ManagerPageHeader";

const views = [
  { id: "season", label: "Сезон" },
  { id: "schedule", label: "Матчи" },
  { id: "standings", label: "Таблица" },
  { id: "stats", label: "Стата" },
] as const;

type ViewId = (typeof views)[number]["id"];

export function ProfessionalSeasonDashboard({ save }: { save: CareerSave }) {
  const [view, setView] = useState<ViewId>("season");
  const professional = save.football.professional;
  const league = professional.league;
  const career = professional.heroCareer;
  const team = career?.teamId ? professional.teams.find((item) => item.id === career.teamId) : undefined;
  const standings = useMemo(() => professionalStandings(professional.teams), [professional.teams]);
  const games = league.schedule
    .filter((game) => !team || game.homeTeamId === team.id || game.awayTeamId === team.id)
    .sort((left, right) => left.week - right.week);
  const nextGame = games.find((game) => game.status === "scheduled");
  const opponentId = nextGame && team ? (nextGame.homeTeamId === team.id ? nextGame.awayTeamId : nextGame.homeTeamId) : undefined;
  const opponent = opponentId ? professional.teams.find((item) => item.id === opponentId) : undefined;
  const latest = career?.gameLog.at(-1);

  return (
    <div className="data-page professional-season-page">
      <ManagerPageHeader
        eyebrow={`PRO FOOTBALL · ${league.seasonYear}`}
        title={view === "schedule" ? "Календарь команды" : view === "standings" ? "Таблица лиги" : view === "stats" ? "Статистика карьеры" : team ? `${team.city} ${team.name}` : "Профессиональный сезон"}
        subtitle={team ? `${team.conference} · неделя ${league.week} · ${league.phase}` : "Статус свободного агента и картина лиги."}
        badge={team?.shortName ?? "PRO"}
        metrics={[
          { label: "Рекорд", value: team ? `${team.wins}–${team.losses}` : "—", tone: team && team.wins >= team.losses ? "positive" : undefined },
          { label: "Роль", value: career?.role ?? "—" },
          { label: "Depth", value: career ? `#${career.depthRank}` : "—" },
          { label: "Trust", value: Math.round(career?.coachTrust ?? 0) },
        ]}
      />
      <SectionTabs<ViewId> tabs={views} active={view} onChange={setView} ariaLabel="PRO сезон" />

      {view === "season" && (
        <div className="compact-view professional-season-command">
          <section className="career-overview-grid">
            <article><small>Фаза</small><strong>{league.phase}</strong></article>
            <article><small>Роль</small><strong>{career?.role ?? "—"}</strong></article>
            <article><small>Depth</small><strong>{career ? `#${career.depthRank}` : "—"}</strong></article>
            <article><small>Trust</small><strong>{Math.round(career?.coachTrust ?? 0)}</strong></article>
          </section>
          <section className="season-command-card">
            <header>
              <div><small>{nextGame ? formatGameDate(nextGame.date) : "FINAL"}</small><strong>{opponent?.shortName ?? league.championTeamId ?? "—"}</strong></div>
              <span>{nextGame ? `W${nextGame.week}` : league.phase}</span>
            </header>
          </section>
        </div>
      )}

      {view === "schedule" && (
        <div className="match-data-list professional-schedule-table">
          <header><span>Неделя</span><span>Соперник</span><span>Дата</span><span>Счёт</span></header>
          {games.map((game) => {
            const gameOpponentId = team ? (game.homeTeamId === team.id ? game.awayTeamId : game.homeTeamId) : game.awayTeamId;
            const gameOpponent = professional.teams.find((item) => item.id === gameOpponentId);
            const teamScore = team && game.status === "complete" ? (game.homeTeamId === team.id ? game.homeScore : game.awayScore) : undefined;
            const opponentScore = team && game.status === "complete" ? (game.homeTeamId === team.id ? game.awayScore : game.homeScore) : undefined;
            const won = teamScore !== undefined && opponentScore !== undefined && teamScore > opponentScore;
            return <article key={game.id} className={game.status === "complete" ? (won ? "is-win" : "is-loss") : ""}><span>W{game.week}</span><div><strong>{gameOpponent?.shortName ?? gameOpponentId}</strong><small>{formatGameDate(game.date)}</small></div><em>{game.status === "complete" ? `${teamScore}:${opponentScore}` : "—"}</em></article>;
          })}
        </div>
      )}

      {view === "standings" && (
        <div className="standings-data-list">
          <header><span>#</span><span>Команда</span><span>W–L</span><span>OVR</span></header>
          {standings.map((item, index) => <article key={item.id} className={item.id === team?.id ? "is-hero" : ""}><span>{index + 1}</span><strong>{item.shortName}</strong><span>{item.wins}–{item.losses}</span><span>{Math.round(item.rosterStrength)}</span></article>)}
        </div>
      )}

      {view === "stats" && (
        <div className="compact-view">
          <section className="career-overview-grid">
            <article><small>Игры</small><strong>{career?.gamesPlayed ?? 0}</strong></article>
            <article><small>Старты</small><strong>{career?.starts ?? 0}</strong></article>
            <article><small>Снэпы</small><strong>{career?.snaps ?? 0}</strong></article>
            <article><small>Оценка</small><strong>{latest?.performanceScore ? Math.round(latest.performanceScore) : "—"}</strong></article>
          </section>
        </div>
      )}
    </div>
  );
}
