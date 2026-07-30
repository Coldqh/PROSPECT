import { useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { SectionTabs } from "../ui/SectionTabs";

const views = [
  { id: "season", label: "Сезон" },
  { id: "matches", label: "Матчи" },
  { id: "standings", label: "Таблица" },
] as const;

type ViewId = (typeof views)[number]["id"];

function roleLabel(value: string): string {
  return { starter: "Стартер", rotation: "Ротация", "special-teams": "Спецкоманды", developmental: "Развитие" }[value] ?? value;
}

export function CollegeSectionsDashboard({ save }: { save: CareerSave }) {
  const [view, setView] = useState<ViewId>("season");
  const career = save.football.college.heroCareer;
  if (!career) return <div className="data-empty">Нет данных</div>;
  const team = save.world.teams.find((item) => item.id === career.teamId);
  const conference = team?.conferenceId ? save.world.conferences.find((item) => item.id === team.conferenceId) : undefined;
  const standings = save.world.teams.filter((item) => item.level === "college" && (!conference || item.conferenceId === conference.id)).sort((a, b) => b.conferenceWins - a.conferenceWins || a.conferenceLosses - b.conferenceLosses || b.rating - a.rating);
  const schedule = save.world.competition.schedule.filter((game) => game.homeTeamId === career.teamId || game.awayTeamId === career.teamId).sort((a, b) => a.week - b.week);

  return (
    <div className="data-page">
      <header className="data-page-head"><div><small>{career.seasonYear}</small><h1>{team?.shortName ?? "COLLEGE"}</h1></div><strong>{team?.wins ?? 0}–{team?.losses ?? 0}</strong></header>
      <SectionTabs<ViewId> tabs={views} active={view} onChange={setView} ariaLabel="Разделы сезона колледжа" />

      {view === "matches" && <div className="match-data-list">{schedule.map((game) => {
        const opponentId = game.homeTeamId === career.teamId ? game.awayTeamId : game.homeTeamId;
        const opponent = save.world.teams.find((item) => item.id === opponentId);
        const won = game.status === "complete" && game.winnerTeamId === career.teamId;
        return <article key={game.id} className={game.status === "complete" ? (won ? "is-win" : "is-loss") : ""}><span>W{game.week}</span><div><strong>{opponent?.name ?? opponentId}</strong><small>{game.homeTeamId === career.teamId ? "Дома" : "В гостях"}</small></div><em>{game.status === "complete" ? `${game.homeScore}:${game.awayScore}` : "—"}</em></article>;
      })}</div>}

      {view === "standings" && <div className="standings-data-list"><header><span>#</span><span>Команда</span><span>CONF</span><span>ALL</span></header>{standings.map((item, index) => <article key={item.id} className={item.id === career.teamId ? "is-hero" : ""}><span>{index + 1}</span><strong>{item.shortName}</strong><span>{item.conferenceWins}–{item.conferenceLosses}</span><span>{item.wins}–{item.losses}</span></article>)}</div>}

      {view === "season" && <div className="compact-view">
        <section className="career-overview-grid">
          <article><small>Игры</small><strong>{career.gamesPlayed}</strong></article>
          <article><small>Старты</small><strong>{career.starts}</strong></article>
          <article><small>Снэпы</small><strong>{career.seasonSnaps}</strong></article>
          <article><small>Роль</small><strong>{roleLabel(career.role)}</strong></article>
        </section>
        <section className="season-history-data">
          {[...career.seasonHistory].reverse().map((season) => <article key={`${season.seasonYear}:${season.teamId}`}><div><small>{season.seasonYear} · {season.classYear}</small><strong>{season.teamName}</strong></div><span>{season.wins}–{season.losses}</span><em>{season.averageGrade}</em></article>)}
          {career.seasonHistory.length === 0 && <div className="data-empty">Первый сезон</div>}
        </section>
      </div>}
    </div>
  );
}
