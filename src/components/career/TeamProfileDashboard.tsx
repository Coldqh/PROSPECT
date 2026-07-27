import { useMemo, useState, type CSSProperties } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { defenseSystemLabel, offenseSystemLabel } from "../../sports/football/ecosystem/tactics";
import type { EcosystemPlayer, EcosystemTeam } from "../../sports/football/ecosystem/types";
import { candidateKindLabel, getTeamEcosystemSnapshot, negotiationStatusLabel, openingStatusLabel, promiseRoleLabel, rosterStrategyLabel, scholarshipLabel } from "../../sports/football/ecosystem/visibility";
import type { FootballRosterPlayer } from "../../sports/football/team/types";
import { Icon } from "../ui/Icon";
import { EcosystemPlayerProfile } from "./EcosystemPlayerProfile";

type TeamView = "overview" | "roster" | "planning" | "staff" | "system" | "resources" | "history";

const views: readonly { id: TeamView; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "roster", label: "Состав" },
  { id: "planning", label: "План" },
  { id: "staff", label: "Штаб" },
  { id: "system", label: "Система" },
  { id: "resources", label: "Ресурсы" },
  { id: "history", label: "История" },
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
  const [selectedPlayer, setSelectedPlayer] = useState<EcosystemPlayer | FootballRosterPlayer>();
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
  const headCoach = teamCoaches.find((coach) => coach.role === "head-coach");
  const leaders = [...teamPlayers].sort((left, right) => right.overall - left.overall).slice(0, 4);
  const upcomingGames = games.filter((game) => game.status === "scheduled").slice(0, 5);
  const conferenceTeams = conference
    ? conference.teamIds.map((id) => save.world.teams.find((team) => team.id === id)).filter((team): team is EcosystemTeam => Boolean(team)).sort((left, right) => right.conferenceWins - left.conferenceWins || left.conferenceLosses - right.conferenceLosses || right.wins - left.wins)
    : [];
  const ecosystemSnapshot = worldTeam ? getTeamEcosystemSnapshot(save.world, worldTeam.id) : undefined;
  const positionPlan = worldTeam ? Object.values(worldTeam.rosterPlan.positionProjections).sort((left, right) => right.targetAdds - left.targetAdds || right.needNextYear - left.needNextYear) : [];

  const teamStyle = worldTeam ? undefined : ({
    "--team-primary": save.football.school.primaryColor,
    "--team-secondary": save.football.school.secondaryColor,
  } as CSSProperties);

  return (
    <div className="team-profile" {...(teamStyle ? { style: teamStyle } : {})}>
      <header className="elite-team-hero">
        <div className="elite-team-crest" aria-hidden="true"><span>{shortName.slice(0, 3).toUpperCase()}</span></div>
        <div className="elite-team-hero__identity">
          <small>{conference?.shortName ?? save.football.school.city}</small>
          <h1>{teamName}</h1>
          <p>{shortName.toUpperCase()}</p>
        </div>
        <div className="elite-team-hero__record">
          <span><small>Рекорд</small><strong>{worldTeam ? `${worldTeam.wins}–${worldTeam.losses}` : `${save.football.season.wins}–${save.football.season.losses}`}</strong></span>
          <span><small>Рейтинг</small><strong>{ranking ? `#${ranking.rank}` : "—"}</strong></span>
        </div>
        <div className="elite-team-hero__facts">
          <span><small>Престиж</small><strong>{Math.round(worldTeam?.prestige ?? save.football.school.prestige)}</strong></span>
          <span><small>OVR</small><strong>{Math.round(worldTeam?.rating ?? save.football.school.prestige)}</strong></span>
          <span><small>Химия</small><strong>{Math.round(culture?.cohesion ?? save.football.teamDynamics.cohesion)}</strong></span>
        </div>
      </header>

      <nav className="team-profile__tabs" aria-label="Профиль команды">
        {views.map((item) => <button key={item.id} type="button" className={view === item.id ? "is-active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}
      </nav>

      {view === "overview" && (
        <div className="elite-team-overview">
          <section className="elite-team-rating-strip">
            <article><small>Атака</small><strong>{Math.round(worldTeam?.rating ?? save.football.school.prestige)}</strong><i><b style={{ width: `${worldTeam?.rating ?? save.football.school.prestige}%` }} /></i></article>
            <article><small>Защита</small><strong>{Math.round((worldTeam?.rating ?? save.football.school.prestige) * .97)}</strong><i><b style={{ width: `${Math.min(100, (worldTeam?.rating ?? save.football.school.prestige) * .97)}%` }} /></i></article>
            <article><small>Мораль</small><strong>{Math.round(culture?.morale ?? save.football.teamDynamics.morale)}</strong><i><b style={{ width: `${culture?.morale ?? save.football.teamDynamics.morale}%` }} /></i></article>
          </section>

          <div className="elite-team-duo">
            <section className="elite-team-coach">
              <header><small>Главный тренер</small></header>
              <div className="elite-coach-avatar" aria-hidden="true">HC</div>
              <div><strong>{headCoach?.name ?? save.football.staff.headCoach.name}</strong><small>{"careerWins" in (headCoach ?? {}) ? `${(headCoach as { careerWins: number }).careerWins} побед` : `DEV ${save.football.staff.headCoach.development}`}</small></div>
            </section>
            <section className="elite-team-next">
              <header><small>Следующий соперник</small></header>
              {nextGame ? ("opponentName" in nextGame ? (
                <><div className="elite-opponent-mark">{nextGame.opponentName.slice(0, 2).toUpperCase()}</div><strong>{nextGame.opponentName}</strong><small>W{nextGame.week} · {nextGame.home ? "Дома" : "В гостях"}</small></>
              ) : (
                <><div className="elite-opponent-mark">{(save.world.teams.find((team) => team.id === (nextGame.homeTeamId === worldTeam?.id ? nextGame.awayTeamId : nextGame.homeTeamId))?.shortName ?? "TBD").slice(0, 2)}</div><strong>{save.world.teams.find((team) => team.id === (nextGame.homeTeamId === worldTeam?.id ? nextGame.awayTeamId : nextGame.homeTeamId))?.name ?? "TBD"}</strong><small>W{nextGame.week} · {nextGame.homeTeamId === worldTeam?.id ? "Дома" : "В гостях"}</small></>
              )) : <div className="elite-empty">Нет ближайшего матча</div>}
            </section>
          </div>

          <section className="elite-section elite-team-leaders">
            <header className="elite-section__head"><h2>Лидеры состава</h2><span>{teamPlayers.length}</span></header>
            <div>
              {leaders.map((player) => <button type="button" key={player.id} onClick={() => setSelectedPlayer(player)}><span className="elite-depth-badge">#{player.depthRank}</span><div className="elite-roster-silhouette" aria-hidden="true">{player.position}</div><small>{player.position}</small><strong>{player.name}</strong><em>OVR {Math.round(player.overall)}</em></button>)}
            </div>
          </section>

          <section className="elite-section">
            <header className="elite-section__head"><h2>Ближайшие матчи</h2><span>{upcomingGames.length}</span></header>
            <div className="elite-schedule-rail">
              {upcomingGames.map((game) => {
                if ("opponentName" in game) return <article key={game.id}><small>W{game.week}</small><strong>{game.opponentName.slice(0, 3).toUpperCase()}</strong><span>{game.home ? "Дома" : "В гостях"}</span></article>;
                const opponent = save.world.teams.find((team) => team.id === (game.homeTeamId === worldTeam?.id ? game.awayTeamId : game.homeTeamId));
                return <article key={game.id}><small>W{game.week}</small><strong>{opponent?.shortName ?? "TBD"}</strong><span>{game.homeTeamId === worldTeam?.id ? "Дома" : "В гостях"}</span></article>;
              })}
            </div>
          </section>

          <div className="elite-team-tables">
            <section className="elite-section">
              <header className="elite-section__head"><h2>Конференция</h2><span>{conference?.shortName ?? "—"}</span></header>
              <div className="elite-standings-list">{conferenceTeams.slice(0, 5).map((team, index) => <article key={team.id} className={team.id === worldTeam?.id ? "is-current" : ""}><span>{index + 1}</span><strong>{team.shortName}</strong><em>{team.conferenceWins}–{team.conferenceLosses}</em><b>{team.wins}–{team.losses}</b></article>)}</div>
            </section>
            <section className="elite-section">
              <header className="elite-section__head"><h2>Национальный рейтинг</h2><span>TOP 25</span></header>
              <div className="elite-standings-list">{save.world.competition.rankings.slice(0, 5).map((item) => { const team = save.world.teams.find((candidate) => candidate.id === item.teamId); return <article key={item.teamId} className={item.teamId === worldTeam?.id ? "is-current" : ""}><span>{item.rank}</span><strong>{team?.shortName ?? item.teamId}</strong><em>{team?.wins ?? 0}–{team?.losses ?? 0}</em><b>{Math.round(item.score)}</b></article>; })}</div>
            </section>
          </div>

          {lastGames.length > 0 && <section className="team-profile__results">
            <header><span>Последние матчи</span><strong>{lastGames.length}</strong></header>
            {lastGames.map((game) => {
              if ("opponentName" in game) return <article key={game.id}><span>{game.won ? "W" : "L"}</span><div><strong>{game.opponentName}</strong><small>W{game.week}</small></div><em>{game.heroScore}:{game.opponentScore}</em></article>;
              const home = save.world.teams.find((team) => team.id === game.homeTeamId); const away = save.world.teams.find((team) => team.id === game.awayTeamId); const won = game.winnerTeamId === worldTeam?.id; return <article key={game.id}><span>{won ? "W" : "L"}</span><div><strong>{home?.shortName} — {away?.shortName}</strong><small>W{game.week}</small></div><em>{game.homeScore}:{game.awayScore}</em></article>;
            })}
          </section>}
        </div>
      )}

      {view === "roster" && (
        <div className="team-profile__roster">
          {teamPlayers.map((player) => {
            const isHero = "isHero" in player ? player.isHero : false;
            return <button type="button" key={player.id} className={isHero ? "is-hero" : ""} onClick={() => setSelectedPlayer(player)}><span>{player.position}</span><div><strong>{player.name}</strong><small>{"classYear" in player ? player.classYear : player.year} · #{player.depthRank}</small></div><em>{Math.round(player.overall)}</em></button>;
          })}
          {teamPlayers.length === 0 && <div className="data-empty">Состав пуст</div>}
        </div>
      )}

      {view === "planning" && (
        <div className="team-profile__planning">
          {worldTeam && ecosystemSnapshot ? (
            <>
              <section className="team-plan-summary">
                <article><small>Стратегия</small><strong>{rosterStrategyLabel(worldTeam.rosterPlan.strategy)}</strong></article>
                <article><small>Размер класса</small><strong>{worldTeam.rosterPlan.targetClassSize}</strong></article>
                <article><small>Свободные места</small><strong>{worldTeam.rosterPlan.availableRosterSpots}</strong></article>
                <article><small>Уходят</small><strong>{worldTeam.rosterPlan.projectedDepartures}</strong></article>
              </section>
              <section className="elite-section">
                <header className="elite-section__head"><h2>Позиционный план</h2><span>{worldTeam.rosterPlan.lastReviewReason}</span></header>
                <div className="team-plan-list">
                  {positionPlan.map((projection) => <article key={projection.position}><span>{projection.position}</span><div><strong>{projection.currentPlayers} в комнате</strong><small>{projection.returningNextYear} вернутся · OVR {Math.round(projection.averageOverall)}</small></div><em>Need {projection.needNextYear}</em><b>+{projection.targetAdds}</b></article>)}
                </div>
              </section>
              <section className="elite-section">
                <header className="elite-section__head"><h2>Набор и портал</h2><span>{ecosystemSnapshot.negotiations.filter((item) => item.status === "offered").length} активных</span></header>
                <div className="team-market-feed">
                  {ecosystemSnapshot.negotiations.slice(0, 12).map((item) => <article key={item.id}><span>{item.position}</span><div><strong>{item.candidateName}</strong><small>{candidateKindLabel(item.candidateKind)} · {promiseRoleLabel(item.promisedRole)} · {scholarshipLabel(item.scholarship)}</small></div><em>{negotiationStatusLabel(item.status)}</em></article>)}
                  {ecosystemSnapshot.negotiations.length === 0 && <div className="data-empty">Переговоров нет</div>}
                </div>
              </section>
              <section className="elite-section">
                <header className="elite-section__head"><h2>Открытые места</h2><span>{ecosystemSnapshot.openings.filter((item) => item.status === "open").length}</span></header>
                <div className="team-market-feed">
                  {ecosystemSnapshot.openings.map((opening) => <article key={opening.id}><span>{opening.position}</span><div><strong>{opening.reason}</strong><small>{opening.filledByCandidateIds.length}/{opening.slots} заполнено · {opening.scholarshipSlots} стипендий</small></div><em>{openingStatusLabel(opening.status)}</em></article>)}
                  {ecosystemSnapshot.openings.length === 0 && <div className="data-empty">План набора не сформирован</div>}
                </div>
              </section>
            </>
          ) : <div className="data-empty">План состава доступен для команд экосистемы</div>}
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
              <section className="team-profile__system-title"><small>Атака</small><strong>{offenseSystemLabel(worldTeam.tactical.offenseSystem)}</strong><span>{worldTeam.offenseStyle}</span></section>
              <section className="team-profile__system-title"><small>Защита</small><strong>{defenseSystemLabel(worldTeam.tactical.defenseSystem)}</strong><span>{worldTeam.defenseStyle}</span></section>
              <section className="team-profile__metrics">
                <article><small>Установка</small><strong>{Math.round(worldTeam.tactical.installation)}</strong></article>
                <article><small>Связность</small><strong>{Math.round(worldTeam.tactical.continuity)}</strong></article>
                <article><small>Сложность</small><strong>{Math.round(worldTeam.tactical.complexity)}</strong></article>
                <article><small>Ротация</small><strong>{Math.round(worldTeam.tactical.rotationDepth)}</strong></article>
              </section>
            </>
          ) : (
            <>
              <section className="team-profile__system-title"><small>Философия</small><strong>{save.football.school.philosophy}</strong></section>
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
              <article><small>Дисциплина</small><strong>{Math.round(save.football.school.discipline)}</strong></article>
            </>
          )}
        </div>
      )}

      {view === "history" && (
        <div className="team-profile__history">
          {worldTeam && ecosystemSnapshot ? (
            <>
              <section className="team-plan-summary">
                <article><small>Входящие</small><strong>{ecosystemSnapshot.inboundMoves}</strong></article>
                <article><small>Исходящие</small><strong>{ecosystemSnapshot.outboundMoves}</strong></article>
                <article><small>Сезонов в архиве</small><strong>{ecosystemSnapshot.history.length}</strong></article>
                <article><small>Вакансии штабов</small><strong>{ecosystemSnapshot.vacancies.length}</strong></article>
              </section>
              <section className="elite-section">
                <header className="elite-section__head"><h2>История сезонов</h2><span>{ecosystemSnapshot.history.length}</span></header>
                <div className="team-market-feed">
                  {ecosystemSnapshot.history.map((season) => <article key={season.id}><span>{season.seasonYear}</span><div><strong>{season.wins}–{season.losses}</strong><small>{season.conferenceWins}–{season.conferenceLosses} в конференции · место {season.finish}</small></div><em>{season.conferenceChampion ? "CHAMP" : Math.round(season.finalRating)}</em></article>)}
                  {ecosystemSnapshot.history.length === 0 && <div className="data-empty">Первый сезон ещё не архивирован</div>}
                </div>
              </section>
              <section className="elite-section">
                <header className="elite-section__head"><h2>Транзакции</h2><span>{ecosystemSnapshot.transactions.length}</span></header>
                <div className="team-market-feed">
                  {ecosystemSnapshot.transactions.slice(0, 30).map((item) => { const player = item.playerId ? save.world.players.find((candidate) => candidate.id === item.playerId) : undefined; return player ? <button type="button" key={item.id} onClick={() => setSelectedPlayer(player)}><span>W{item.week}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><Icon name="arrow-right" size={15} /></button> : <article key={item.id}><span>W{item.week}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><em>{item.seasonYear}</em></article>; })}
                  {ecosystemSnapshot.transactions.length === 0 && <div className="data-empty">Движений пока нет</div>}
                </div>
              </section>
            </>
          ) : <div className="data-empty">История доступна для команд экосистемы</div>}
        </div>
      )}
      <EcosystemPlayerProfile save={save} player={selectedPlayer} onClose={() => setSelectedPlayer(undefined)} />
    </div>
  );
}
