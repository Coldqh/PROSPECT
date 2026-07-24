import { useMemo, useState, type CSSProperties } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { defenseSystemLabel, offenseSystemLabel } from "../../sports/football/ecosystem/tactics";
import { Icon } from "../ui/Icon";

type TeamView = "overview" | "roster" | "staff" | "system" | "resources";

const views: readonly { id: TeamView; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "roster", label: "Состав" },
  { id: "staff", label: "Штаб" },
  { id: "system", label: "Система" },
  { id: "resources", label: "Ресурсы" },
];

interface TeamProfileDashboardProps {
  save: CareerSave;
  teamId?: string;
}

function money(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toFixed(1)}M`;
}

function roleLabel(role: string): string {
  return {
    "head-coach": "Главный тренер",
    "offensive-coordinator": "Координатор атаки",
    "defensive-coordinator": "Координатор защиты",
    "position-coach": "Позиционный тренер",
  }[role] ?? role;
}

export function TeamProfileDashboard({ save, teamId }: TeamProfileDashboardProps) {
  const [view, setView] = useState<TeamView>("overview");
  const worldTeam = useMemo(() => {
    const currentCollegeId = save.football.college.heroCareer?.teamId ?? save.football.college.program?.id;
    return save.world.teams.find((team) => team.id === (teamId ?? currentCollegeId ?? save.football.school.id));
  }, [save, teamId]);

  const teamName = worldTeam?.name ?? `${save.football.school.name} ${save.football.school.mascot}`;
  const shortName = worldTeam?.shortName ?? save.football.school.shortName;
  const conference = worldTeam?.conferenceId
    ? save.world.conferences.find((item) => item.id === worldTeam.conferenceId)
    : undefined;
  const culture = worldTeam ? save.world.social.teamCultures.find((item) => item.teamId === worldTeam.id) : undefined;
  const ranking = worldTeam ? save.world.competition.rankings.find((item) => item.teamId === worldTeam.id) : undefined;
  const teamPlayers = worldTeam
    ? save.world.players.filter((player) => player.teamId === worldTeam.id).sort((a, b) => a.position.localeCompare(b.position) || a.depthRank - b.depthRank || b.overall - a.overall)
    : save.football.roster.slice().sort((a, b) => a.position.localeCompare(b.position) || a.depthRank - b.depthRank || b.overall - a.overall);
  const teamCoaches = worldTeam
    ? save.world.coaches.filter((coach) => coach.teamId === worldTeam.id).sort((a, b) => a.role.localeCompare(b.role))
    : [save.football.staff.headCoach, save.football.staff.offensiveCoordinator, save.football.staff.defensiveCoordinator, save.football.staff.positionCoach];
  const games = worldTeam
    ? save.world.competition.schedule.filter((game) => game.homeTeamId === worldTeam.id || game.awayTeamId === worldTeam.id).sort((a, b) => a.week - b.week)
    : save.football.season.schedule;
  const nextGame = games.find((game) => game.status === "scheduled");
  const lastGames = games.filter((game) => game.status === "complete").slice(-4).reverse();

  const teamStyle = worldTeam ? undefined : ({
    "--team-primary": save.football.school.primaryColor,
    "--team-secondary": save.football.school.secondaryColor,
  } as CSSProperties);

  return (
    <div className="team-profile" {...(teamStyle ? { style: teamStyle } : {})}>
      <header className="team-profile__hero">
        <span className="team-profile__mark">{shortName.slice(0, 3).toUpperCase()}</span>
        <div>
          <small>{conference?.shortName ?? save.football.school.city}</small>
          <h1>{teamName}</h1>
          <p>{worldTeam ? `${worldTeam.wins}–${worldTeam.losses}` : `${save.football.season.wins}–${save.football.season.losses}`} · OVR {Math.round(worldTeam?.rating ?? save.football.school.prestige)}</p>
        </div>
        <strong>{ranking ? `#${ranking.rank}` : Math.round(worldTeam?.prestige ?? save.football.school.prestige)}</strong>
      </header>

      <nav className="team-profile__tabs" aria-label="Профиль команды">
        {views.map((item) => <button key={item.id} type="button" className={view === item.id ? "is-active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}
      </nav>

      {view === "overview" && (
        <div className="team-profile__body">
          <section className="team-profile__metrics">
            <article><small>Рейтинг</small><strong>{Math.round(worldTeam?.rating ?? save.football.school.prestige)}</strong></article>
            <article><small>Престиж</small><strong>{Math.round(worldTeam?.prestige ?? save.football.school.prestige)}</strong></article>
            <article><small>Мораль</small><strong>{Math.round(culture?.morale ?? save.football.teamDynamics.morale)}</strong></article>
            <article><small>Сыгранность</small><strong>{Math.round(culture?.cohesion ?? save.football.teamDynamics.cohesion)}</strong></article>
          </section>
          {nextGame && (
            <section className="team-profile__next">
              <small>СЛЕДУЮЩИЙ МАТЧ · W{nextGame.week}</small>
              {"opponentName" in nextGame ? (
                <><strong>{nextGame.opponentName}</strong><span>{nextGame.home ? "Дома" : "В гостях"} · {nextGame.opponentRating} OVR</span></>
              ) : (
                <><strong>{save.world.teams.find((team) => team.id === (nextGame.homeTeamId === worldTeam?.id ? nextGame.awayTeamId : nextGame.homeTeamId))?.name ?? "TBD"}</strong><span>{nextGame.homeTeamId === worldTeam?.id ? "Дома" : "В гостях"}</span></>
              )}
            </section>
          )}
          <section className="team-profile__results">
            <header><span>ПОСЛЕДНИЕ МАТЧИ</span><strong>{lastGames.length}</strong></header>
            {lastGames.length === 0 ? <div className="data-empty">Нет результатов</div> : lastGames.map((game) => {
              if ("opponentName" in game) {
                return <article key={game.id}><span>{game.won ? "W" : "L"}</span><div><strong>{game.opponentName}</strong><small>W{game.week}</small></div><em>{game.heroScore}:{game.opponentScore}</em></article>;
              }
              const home = save.world.teams.find((team) => team.id === game.homeTeamId);
              const away = save.world.teams.find((team) => team.id === game.awayTeamId);
              const won = game.winnerTeamId === worldTeam?.id;
              return <article key={game.id}><span>{won ? "W" : "L"}</span><div><strong>{home?.shortName} — {away?.shortName}</strong><small>W{game.week}</small></div><em>{game.homeScore}:{game.awayScore}</em></article>;
            })}
          </section>
        </div>
      )}

      {view === "roster" && (
        <div className="team-profile__roster">
          {teamPlayers.map((player) => {
            const isHero = "isHero" in player ? player.isHero : false;
            return <article key={player.id} className={isHero ? "is-hero" : ""}><span>{player.position}</span><div><strong>{player.name}</strong><small>{"classYear" in player ? player.classYear : player.year} · #{player.depthRank}</small></div><em>{Math.round(player.overall)}</em></article>;
          })}
          {teamPlayers.length === 0 && <div className="data-empty">Состав пуст</div>}
        </div>
      )}

      {view === "staff" && (
        <div className="team-profile__staff">
          {teamCoaches.map((coach) => <article key={coach.id}><div><small>{roleLabel(coach.role)}</small><strong>{coach.name}</strong></div><span>{"reputation" in coach ? Math.round(coach.reputation) : Math.round(coach.tactics)}</span><footer>{"careerWins" in coach ? `${coach.careerWins}–${coach.careerLosses}` : `DEV ${coach.development} · TAC ${coach.tactics}`}</footer></article>)}
        </div>
      )}

      {view === "system" && (
        <div className="team-profile__body">
          {worldTeam ? (
            <>
              <section className="team-profile__system-title"><small>АТАКА</small><strong>{offenseSystemLabel(worldTeam.tactical.offenseSystem)}</strong><span>{worldTeam.offenseStyle}</span></section>
              <section className="team-profile__system-title"><small>ЗАЩИТА</small><strong>{defenseSystemLabel(worldTeam.tactical.defenseSystem)}</strong><span>{worldTeam.defenseStyle}</span></section>
              <section className="team-profile__metrics">
                <article><small>Установка</small><strong>{Math.round(worldTeam.tactical.installation)}</strong></article>
                <article><small>Связность</small><strong>{Math.round(worldTeam.tactical.continuity)}</strong></article>
                <article><small>Сложность</small><strong>{Math.round(worldTeam.tactical.complexity)}</strong></article>
                <article><small>Ротация</small><strong>{Math.round(worldTeam.tactical.rotationDepth)}</strong></article>
              </section>
            </>
          ) : (
            <>
              <section className="team-profile__system-title"><small>ФИЛОСОФИЯ</small><strong>{save.football.school.philosophy}</strong></section>
              <section className="team-profile__metrics">
                <article><small>Схема</small><strong>{Math.round(save.football.teamDynamics.schemeMastery)}</strong></article>
                <article><small>Дисциплина</small><strong>{Math.round(save.football.teamDynamics.discipline)}</strong></article>
                <article><small>Тренеры</small><strong>{Math.round(save.football.school.coaching)}</strong></article>
                <article><small>Молодёжь</small><strong>{Math.round(save.football.school.youthTrust)}</strong></article>
              </section>
            </>
          )}
        </div>
      )}

      {view === "resources" && (
        <div className="team-profile__resources">
          {worldTeam ? (
            <>
              <article><small>Бюджет</small><strong>{money(worldTeam.resources.footballBudget)}</strong></article>
              <article><small>Рекрутинг</small><strong>{money(worldTeam.resources.recruitingBudget)}</strong></article>
              <article><small>NIL</small><strong>{money(worldTeam.resources.nilCapacity)}</strong></article>
              <article><small>Баланс</small><strong>{money(worldTeam.resources.currentBalance)}</strong></article>
              <article><small>База</small><strong>{Math.round(worldTeam.resources.facilitiesLevel)}</strong></article>
              <article><small>Медицина</small><strong>{Math.round(worldTeam.resources.medicalLevel)}</strong></article>
              <article><small>Учёба</small><strong>{Math.round(worldTeam.resources.academicSupportLevel)}</strong></article>
              <article><small>Давление</small><strong>{Math.round(worldTeam.resources.financialPressure)}</strong></article>
            </>
          ) : (
            <>
              <article><small>База</small><strong>{Math.round(save.football.school.facilities)}</strong></article>
              <article><small>Тренеры</small><strong>{Math.round(save.football.school.coaching)}</strong></article>
              <article><small>Медицина</small><strong>{Math.round(save.football.school.medicine)}</strong></article>
              <article><small>Discipline</small><strong>{Math.round(save.football.school.discipline)}</strong></article>
            </>
          )}
        </div>
      )}
    </div>
  );
}
