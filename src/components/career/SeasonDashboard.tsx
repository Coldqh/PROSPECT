import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { formatGameDate } from "../../core/calendar/types";
import { orderedStandings } from "../../sports/football/season/updateSeason";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { SectionTabs } from "../ui/SectionTabs";

const views = [
  { id: "season", label: "Сезон" },
  { id: "schedule", label: "Матчи" },
  { id: "standings", label: "Таблица" },
  { id: "stats", label: "Стата" },
  { id: "history", label: "История" },
] as const;

type ViewId = (typeof views)[number]["id"];

interface SeasonDashboardProps {
  save: CareerSave;
  onOpenMatch(): void;
}

function recordLabel(wins: number, losses: number): string {
  return `${wins}–${losses}`;
}

function streakLabel(value: number): string {
  if (value === 0) return "—";
  return `${value > 0 ? "W" : "L"}${Math.abs(value)}`;
}

function statCards(save: CareerSave): Array<{ label: string; value: string; detail: string }> {
  const stats = save.football.season.heroTotals;
  switch (save.football.position) {
    case "QB":
      return [
        { label: "Пасовые ярды", value: String(stats.passingYards), detail: `${stats.completions}/${stats.passingAttempts}` },
        { label: "TD", value: String(stats.touchdowns), detail: "за сезон" },
        { label: "Потери", value: String(stats.turnovers), detail: "turnovers" },
        { label: "Вынос", value: String(stats.rushingYards), detail: `${stats.rushingAttempts} попыток` },
      ];
    case "RB":
      return [
        { label: "Выносные ярды", value: String(stats.rushingYards), detail: `${stats.rushingAttempts} попыток` },
        { label: "Приёмные ярды", value: String(stats.receivingYards), detail: `${stats.receptions}/${stats.targets}` },
        { label: "TD", value: String(stats.touchdowns), detail: "за сезон" },
        { label: "Потери", value: String(stats.turnovers), detail: "turnovers" },
      ];
    case "WR":
      return [
        { label: "Приёмные ярды", value: String(stats.receivingYards), detail: `${stats.receptions}/${stats.targets}` },
        { label: "TD", value: String(stats.touchdowns), detail: "за сезон" },
        { label: "Цели", value: String(stats.targets), detail: "targets" },
        { label: "Вынос", value: String(stats.rushingYards), detail: `${stats.rushingAttempts} попыток` },
      ];
    case "LB":
      return [
        { label: "Захваты", value: String(stats.tackles), detail: "total" },
        { label: "TFL", value: String(stats.tacklesForLoss), detail: "за линией" },
        { label: "Sacks", value: String(stats.sacks), detail: "за сезон" },
        { label: "INT/PBU", value: `${stats.interceptions}/${stats.passBreakups}`, detail: "coverage" },
      ];
    case "CB":
      return [
        { label: "PBU", value: String(stats.passBreakups), detail: "разбитые передачи" },
        { label: "INT", value: String(stats.interceptions), detail: "перехваты" },
        { label: "Захваты", value: String(stats.tackles), detail: "total" },
        { label: "TFL", value: String(stats.tacklesForLoss), detail: "за линией" },
      ];
  }
}

export function SeasonDashboard({ save, onOpenMatch }: SeasonDashboardProps) {
  const [view, setView] = useState<ViewId>("season");
  const [scoutingOpen, setScoutingOpen] = useState(false);
  const [leadersOpen, setLeadersOpen] = useState(false);
  const { football } = save;
  const season = football.season;
  const standings = useMemo(() => orderedStandings(season), [season]);
  const heroRank = standings.findIndex((team) => team.isHeroTeam) + 1;
  const nextGame = season.schedule.find((game) => game.status === "scheduled");
  const nextProfile = nextGame ? season.opponents.find((opponent) => opponent.id === nextGame.opponentId) : undefined;
  const completed = season.schedule.filter((game) => game.status === "complete");
  const progress = Math.round((completed.length / season.totalWeeks) * 100);

  return (
    <div className="compact-section season-dashboard">
      <header className="compact-page-head">
        <div><span>Senior season {season.year}</span><h2>Карьера</h2></div>
        <strong className="compact-head-score">{recordLabel(season.wins, season.losses)}</strong>
      </header>
      <SectionTabs<ViewId> tabs={views} active={view} onChange={setView} ariaLabel="Разделы школьного сезона" />

      {view === "season" && (
        <div className="compact-view">
          <section className="season-command-card">
            <header>
              <div><small>REGULAR SEASON</small><strong>Неделя {Math.min(season.week + 1, season.totalWeeks)} / {season.totalWeeks}</strong></div>
              <span>#{heroRank}</span>
            </header>
            <div className="season-progress"><i style={{ width: `${progress}%` }} /></div>
            <footer><span>{completed.length} сыграно</span><span>{season.totalWeeks - completed.length} осталось</span></footer>
          </section>

          {nextGame && nextProfile ? (
            <section className="next-opponent-card">
              <div className="next-opponent-card__mark">{nextGame.opponentShortName}</div>
              <div className="next-opponent-card__copy">
                <small>{nextGame.home ? "ДОМА" : "В ГОСТЯХ"} · {formatGameDate(nextGame.date)}</small>
                <h3>{nextGame.opponentName}</h3>
                <p>{nextProfile.defenseStyle} · {nextGame.opponentRating} OVR</p>
              </div>
              <button type="button" onClick={() => setScoutingOpen(true)} aria-label="Открыть скаутский отчёт"><Icon name="target" /></button>
            </section>
          ) : (
            <section className="season-finished-card"><Icon name="trophy" /><div><small>СЕЗОН ЗАВЕРШЁН</small><h3>{recordLabel(season.wins, season.losses)}</h3><p>Все матчи сыграны. Итоги готовы.</p></div></section>
          )}

          <div className="season-quick-grid">
            <article><small>Место</small><strong>#{heroRank}</strong><span>в регионе</span></article>
            <article><small>Разница</small><strong>{(standings.find((team) => team.isHeroTeam)?.pointsFor ?? 0) - (standings.find((team) => team.isHeroTeam)?.pointsAgainst ?? 0)}</strong><span>по очкам</span></article>
            <article><small>Форма</small><strong>{streakLabel(standings.find((team) => team.isHeroTeam)?.streak ?? 0)}</strong><span>текущая серия</span></article>
          </div>

          {football.match.status !== "complete" && (
            <button type="button" className="primary-action-bar" onClick={onOpenMatch}>
              <span><small>{football.match.status === "in-progress" ? "МАТЧ ИДЁТ" : "СЛЕДУЮЩИЙ МАТЧ"}</small><strong>{football.match.opponentName}</strong></span>
              <Icon name="arrow-right" />
            </button>
          )}
        </div>
      )}

      {view === "schedule" && (
        <div className="compact-view season-schedule-list">
          {season.schedule.map((game) => (
            <article key={game.id} className={game.status === "complete" ? (game.won ? "is-win" : "is-loss") : "is-upcoming"}>
              <div className="season-week-badge"><small>W{game.week}</small><strong>{game.home ? "H" : "A"}</strong></div>
              <div><strong>{game.opponentName}</strong><small>{formatGameDate(game.date)} · {game.opponentRating} OVR</small></div>
              {game.status === "complete" ? <span>{game.heroScore}:{game.opponentScore}<em>{game.won ? "W" : "L"}</em></span> : <span><em>—</em></span>}
            </article>
          ))}
        </div>
      )}

      {view === "standings" && (
        <div className="compact-view standings-card">
          <header><span>#</span><span>Команда</span><span>W–L</span><span>DIFF</span></header>
          {standings.map((team, index) => (
            <article key={team.teamId} className={team.isHeroTeam ? "is-hero" : ""}>
              <span>{index + 1}</span>
              <div><strong>{team.shortName}</strong><small>{team.name}</small></div>
              <strong>{recordLabel(team.wins, team.losses)}</strong>
              <em>{team.pointsFor - team.pointsAgainst >= 0 ? "+" : ""}{team.pointsFor - team.pointsAgainst}</em>
            </article>
          ))}
        </div>
      )}

      {view === "stats" && (
        <div className="compact-view">
          <div className="season-stat-grid">
            {statCards(save).map((stat) => <article key={stat.label}><small>{stat.label}</small><strong>{stat.value}</strong><span>{stat.detail}</span></article>)}
          </div>
          {season.awards.length > 0 && (
            <section className="season-awards-card"><Icon name="trophy" /><div><small>НАГРАДЫ</small><strong>{season.awards.at(-1)?.title}</strong><span>{season.awards.at(-1)?.detail}</span></div><em>{season.awards.length}</em></section>
          )}
          <button type="button" className="compact-link-card" onClick={() => setLeadersOpen(true)}><Icon name="chart" /><div><strong>Лидеры команды</strong><small>Четыре главные статистические категории</small></div><Icon name="arrow-right" /></button>
        </div>
      )}

      {view === "history" && (
        <div className="compact-view season-history-list">
          {completed.length === 0 ? (
            <div className="compact-note"><Icon name="clock" /><p>История сезона появится после первого сыгранного матча.</p></div>
          ) : [...completed].reverse().map((game) => (
            <article key={game.id}>
              <span className={game.won ? "is-win" : "is-loss"}>{game.won ? "W" : "L"}</span>
              <div><small>WEEK {game.week} · {game.heroGrade}</small><strong>{game.opponentName}</strong><p>{game.spotlight}</p></div>
              <em>{game.heroScore}:{game.opponentScore}</em>
            </article>
          ))}
        </div>
      )}

      <BottomSheet open={scoutingOpen} onClose={() => setScoutingOpen(false)} eyebrow="SCOUTING REPORT" title={nextGame?.opponentName ?? "Соперник"}>
        {nextProfile && <div className="scouting-sheet">
          <div className="sheet-metric-pair"><article><small>OVR</small><strong>{nextProfile.rating}</strong></article><article><small>ТОЧНОСТЬ</small><strong>{nextProfile.scoutConfidence}%</strong></article></div>
          <section><small>АТАКА</small><strong>{nextProfile.offenseStyle}</strong></section>
          <section><small>ЗАЩИТА</small><strong>{nextProfile.defenseStyle}</strong></section>
          <section className="is-positive"><small>СИЛЬНАЯ СТОРОНА</small><strong>{nextProfile.strength}</strong></section>
          <section className="is-negative"><small>СЛАБОЕ МЕСТО</small><strong>{nextProfile.weakness}</strong></section>
          <section><small>ОПАСНЫЙ ИГРОК</small><strong>{nextProfile.keyPlayer}</strong></section>
        </div>}
      </BottomSheet>

      <BottomSheet open={leadersOpen} onClose={() => setLeadersOpen(false)} eyebrow="TEAM LEADERS" title="Лидеры программы">
        <div className="leaders-sheet">{season.teamLeaders.map((leader) => <article key={leader.id}><span>{leader.position}</span><div><small>{leader.category}</small><strong>{leader.name}</strong></div><em>{leader.value}</em></article>)}</div>
      </BottomSheet>
    </div>
  );
}
