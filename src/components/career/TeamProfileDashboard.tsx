import { useMemo, useState, type CSSProperties } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { defenseSystemLabel, offenseSystemLabel } from "../../sports/football/ecosystem/tactics";
import type { EcosystemPlayer, EcosystemTeam } from "../../sports/football/ecosystem/types";
import { candidateKindLabel, getTeamEcosystemSnapshot, negotiationStatusLabel, openingStatusLabel, promiseRoleLabel, rosterStrategyLabel, scholarshipLabel } from "../../sports/football/ecosystem/visibility";
import { DEFENSE_ROSTER_POSITIONS, FOOTBALL_ROSTER_POSITIONS, OFFENSE_ROSTER_POSITIONS, POSITION_STARTER_TARGETS, SPECIAL_TEAMS_POSITIONS, normalizeLegacyRosterPosition, positionLabel } from "../../sports/football/team/positions";
import type { FootballRosterPlayer, FootballRosterPosition } from "../../sports/football/team/types";
import { Icon } from "../ui/Icon";
import { EcosystemPlayerProfile } from "./EcosystemPlayerProfile";
import { teamBrandStyle, teamMark } from "./teamBrand";

type TeamView = "overview" | "roster" | "planning" | "staff" | "system" | "resources" | "history";
type RosterUnit = "offense" | "defense" | "special";

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

function resolvedPosition(player: EcosystemPlayer | FootballRosterPlayer): FootballRosterPosition {
  return normalizeLegacyRosterPosition(player.position, player.id);
}

function playerYear(player: EcosystemPlayer | FootballRosterPlayer): string {
  return "classYear" in player ? player.classYear : player.year;
}

function playerStatus(player: EcosystemPlayer | FootballRosterPlayer): string {
  if (player.status === "starter") return "Старт";
  if (player.status === "rotation") return "Ротация";
  if (player.status === "injured") return "Травма";
  return "Резерв";
}

const rosterUnitSections: ReadonlyArray<{ id: RosterUnit; label: string; positions: readonly FootballRosterPosition[] }> = [
  { id: "offense", label: "Атака", positions: OFFENSE_ROSTER_POSITIONS },
  { id: "defense", label: "Защита", positions: DEFENSE_ROSTER_POSITIONS },
  { id: "special", label: "Спецкоманды", positions: SPECIAL_TEAMS_POSITIONS },
];

export function TeamProfileDashboard({ save, teamId }: TeamProfileDashboardProps) {
  const [view, setView] = useState<TeamView>("overview");
  const [rosterUnit, setRosterUnit] = useState<RosterUnit>("offense");
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
  const positionOrder = new Map(FOOTBALL_ROSTER_POSITIONS.map((position, index) => [position, index]));
  const teamPlayers: Array<EcosystemPlayer | FootballRosterPlayer> = worldTeam
    ? save.world.players.filter((player) => player.teamId === worldTeam.id)
    : save.football.roster.slice();
  teamPlayers.sort((left, right) => (positionOrder.get(resolvedPosition(left)) ?? 99) - (positionOrder.get(resolvedPosition(right)) ?? 99) || left.depthRank - right.depthRank || right.overall - left.overall);
  const rosterRooms = FOOTBALL_ROSTER_POSITIONS.map((position) => ({
    position,
    players: teamPlayers.filter((player) => resolvedPosition(player) === position),
  }));
  const teamCoaches = worldTeam
    ? save.world.coaches.filter((coach) => coach.teamId === worldTeam.id).sort((a, b) => a.role.localeCompare(b.role))
    : [save.football.staff.headCoach, save.football.staff.offensiveCoordinator, save.football.staff.defensiveCoordinator, save.football.staff.positionCoach];
  const games = worldTeam
    ? save.world.competition.schedule.filter((game) => game.homeTeamId === worldTeam.id || game.awayTeamId === worldTeam.id).sort((a, b) => a.week - b.week)
    : save.football.season.schedule;
  const nextGame = games.find((game) => game.status === "scheduled");
  const lastGames = games.filter((game) => game.status === "complete").slice(-5).reverse();
  const headCoach = teamCoaches.find((coach) => coach.role === "head-coach");
  const leaders = [...teamPlayers].sort((left, right) => right.overall - left.overall).slice(0, 4);
  const upcomingGames = games.filter((game) => game.status === "scheduled").slice(0, 5);
  const conferenceTeams = conference
    ? conference.teamIds.map((id) => save.world.teams.find((team) => team.id === id)).filter((team): team is EcosystemTeam => Boolean(team)).sort((left, right) => right.conferenceWins - left.conferenceWins || left.conferenceLosses - right.conferenceLosses || right.wins - left.wins)
    : [];
  const ecosystemSnapshot = worldTeam ? getTeamEcosystemSnapshot(save.world, worldTeam.id) : undefined;
  const positionPlan = worldTeam ? FOOTBALL_ROSTER_POSITIONS.map((position) => worldTeam.rosterPlan.positionProjections[position]).sort((left, right) => right.targetAdds - left.targetAdds || right.needNextYear - left.needNextYear) : [];
  const currentRosterSection = rosterUnitSections.find((section) => section.id === rosterUnit) ?? rosterUnitSections[0]!;
  const teamRating = Math.round(worldTeam?.rating ?? save.football.school.prestige);
  const defenseRating = Math.round(Math.min(99, teamRating * 0.97));
  const morale = Math.round(culture?.morale ?? save.football.teamDynamics.morale);
  const cohesion = Math.round(culture?.cohesion ?? save.football.teamDynamics.cohesion);
  const teamRecord = worldTeam ? `${worldTeam.wins}–${worldTeam.losses}` : `${save.football.season.wins}–${save.football.season.losses}`;

  const teamStyle = worldTeam
    ? teamBrandStyle(worldTeam.id)
    : ({
      "--team-primary": save.football.school.primaryColor,
      "--team-secondary": save.football.school.secondaryColor,
      "--team-ink": "#ffffff",
      "--team-hue": "354",
    } as CSSProperties);

  function opponentForGame(game: (typeof games)[number]): { name: string; shortName: string; home: boolean } {
    if ("opponentName" in game) return { name: game.opponentName, shortName: game.opponentName.slice(0, 3).toUpperCase(), home: game.home };
    const opponent = save.world.teams.find((team) => team.id === (game.homeTeamId === worldTeam?.id ? game.awayTeamId : game.homeTeamId));
    return { name: opponent?.name ?? "Соперник уточняется", shortName: opponent?.shortName ?? "TBD", home: game.homeTeamId === worldTeam?.id };
  }

  return (
    <div className="dynasty-page dynasty-team-page" style={teamStyle}>
      <header className="dynasty-page-head">
        <div className="dynasty-page-head__badge">TM</div>
        <div><strong>Команда</strong><small>СОСТАВ · СЕЗОН · ОПЕРАЦИИ</small></div>
      </header>

      <section className="dynasty-team-masthead">
        <div className="dynasty-team-masthead__mark">{teamMark(shortName)}</div>
        <div className="dynasty-team-masthead__identity">
          <small>{conference?.name ?? save.football.school.city}</small>
          <h1>{teamName}</h1>
          <span>{shortName.toUpperCase()}</span>
        </div>
        <div className="dynasty-team-masthead__record"><small>Рекорд</small><strong>{teamRecord}</strong></div>
        <div className="dynasty-team-masthead__facts">
          <span><small>Рейтинг</small><strong>{ranking ? `#${ranking.rank}` : "—"}</strong></span>
          <span><small>Престиж</small><strong>{Math.round(worldTeam?.prestige ?? save.football.school.prestige)}</strong></span>
          <span><small>OVR</small><strong>{teamRating}</strong></span>
          <span><small>Химия</small><strong>{cohesion}</strong></span>
        </div>
      </section>

      <nav className="dynasty-tabs" aria-label="Профиль команды">
        {views.map((item) => <button key={item.id} type="button" className={view === item.id ? "is-active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}
      </nav>

      {view === "overview" && (
        <div className="dynasty-stack">
          <section className="dynasty-panel dynasty-team-ratings">
            {[{ label: "Атака", value: teamRating }, { label: "Защита", value: defenseRating }, { label: "Мораль", value: morale }].map((item) => (
              <article key={item.label}><div><small>{item.label}</small><strong>{item.value}</strong></div><i><b style={{ width: `${item.value}%` }} /></i></article>
            ))}
          </section>

          <div className="dynasty-grid dynasty-grid--two">
            <section className="dynasty-panel dynasty-person-card">
              <header className="dynasty-section-title"><span /> <strong>Главный тренер</strong></header>
              <div className="dynasty-person-card__body">
                <div className="dynasty-avatar">HC</div>
                <div><h2>{headCoach?.name ?? save.football.staff.headCoach.name}</h2><p>{"careerWins" in (headCoach ?? {}) ? `${(headCoach as { careerWins: number }).careerWins} побед за карьеру` : `Развитие ${save.football.staff.headCoach.development}`}</p></div>
                <strong>{Math.round(headCoach?.tactics ?? save.football.staff.headCoach.tactics)}</strong>
              </div>
            </section>
            <section className="dynasty-panel dynasty-next-game">
              <header className="dynasty-section-title"><span /> <strong>Следующий соперник</strong></header>
              {nextGame ? (() => { const opponent = opponentForGame(nextGame); return <div className="dynasty-next-game__body"><div className="dynasty-team-token">{teamMark(opponent.shortName)}</div><div><small>W{nextGame.week} · {opponent.home ? "Дома" : "В гостях"}</small><h2>{opponent.name}</h2><p>Подготовка открыта</p></div><Icon name="arrow-right" /></div>; })() : <div className="dynasty-empty">Ближайшего матча нет</div>}
            </section>
          </div>

          <section>
            <header className="dynasty-section-title"><span /> <strong>Лидеры состава</strong><em>{teamPlayers.length} игроков</em></header>
            <div className="dynasty-player-card-grid">
              {leaders.map((player) => (
                <button type="button" className="dynasty-player-card" key={player.id} onClick={() => setSelectedPlayer(player)}>
                  <span className="dynasty-player-card__stripe" />
                  <div className="dynasty-overall-shield"><strong>{Math.round(player.overall)}</strong><small>OVR</small></div>
                  <div className="dynasty-player-card__identity"><small>{resolvedPosition(player)} · {playerStatus(player)}</small><h2>{player.name}</h2><p>{playerYear(player)} · #{player.depthRank} в комнате</p></div>
                  <div className="dynasty-player-card__rating"><span><small>Роль</small><strong>{playerStatus(player)}</strong></span><span><small>Позиция</small><strong>{resolvedPosition(player)}</strong></span></div>
                </button>
              ))}
            </div>
          </section>

          <div className="dynasty-grid dynasty-grid--two">
            <section className="dynasty-panel">
              <header className="dynasty-section-title"><span /> <strong>Ближайшие матчи</strong><em>{upcomingGames.length}</em></header>
              <div className="dynasty-row-list">
                {upcomingGames.map((game) => { const opponent = opponentForGame(game); return <article key={game.id}><b>W{game.week}</b><div className="dynasty-team-token dynasty-team-token--small">{teamMark(opponent.shortName)}</div><div><strong>{opponent.name}</strong><small>{opponent.home ? "Домашний матч" : "Выезд"}</small></div><em>—</em></article>; })}
                {upcomingGames.length === 0 && <div className="dynasty-empty">Расписание завершено</div>}
              </div>
            </section>
            <section className="dynasty-panel">
              <header className="dynasty-section-title"><span /> <strong>{conference ? conference.shortName : "Последние матчи"}</strong><em>{conference ? "Таблица" : lastGames.length}</em></header>
              {conferenceTeams.length > 0 ? <div className="dynasty-table-list">{conferenceTeams.slice(0, 6).map((team, index) => <article key={team.id} className={team.id === worldTeam?.id ? "is-current" : ""}><span>{index + 1}</span><strong>{team.shortName}</strong><em>{team.conferenceWins}–{team.conferenceLosses}</em><b>{team.wins}–{team.losses}</b></article>)}</div> : <div className="dynasty-row-list">{lastGames.map((game) => { const opponent = opponentForGame(game); if ("opponentName" in game) { const won = Boolean(game.won); return <article key={game.id}><b className={won ? "is-positive" : "is-negative"}>{won ? "W" : "L"}</b><div><strong>{opponent.name}</strong><small>W{game.week}</small></div><em>{game.heroScore}:{game.opponentScore}</em></article>; } const won = game.winnerTeamId === worldTeam?.id; return <article key={game.id}><b className={won ? "is-positive" : "is-negative"}>{won ? "W" : "L"}</b><div><strong>{opponent.name}</strong><small>W{game.week}</small></div><em>{game.homeScore}:{game.awayScore}</em></article>; })}</div>}
            </section>
          </div>
        </div>
      )}

      {view === "roster" && (
        <div className="dynasty-stack">
          <div className="dynasty-roster-toolbar">
            <div><small>Состав</small><strong>{teamPlayers.length} игроков</strong></div>
            <nav>{rosterUnitSections.map((section) => <button type="button" key={section.id} className={rosterUnit === section.id ? "is-active" : ""} onClick={() => setRosterUnit(section.id)}>{section.label}</button>)}</nav>
          </div>
          <section className="dynasty-panel dynasty-roster-board">
            {currentRosterSection.positions.map((position) => {
              const room = rosterRooms.find((item) => item.position === position)?.players ?? [];
              return (
                <div className="dynasty-roster-room" key={position}>
                  <header><span>{position}</span><div><strong>{positionLabel(position)}</strong><small>{room.length} игроков · требуется {POSITION_STARTER_TARGETS[position]}</small></div></header>
                  <div>
                    {room.map((player) => {
                      const isHero = "isHero" in player ? player.isHero : false;
                      return <button type="button" key={player.id} className={isHero ? "is-hero" : ""} onClick={() => setSelectedPlayer(player)}><span className="dynasty-depth">#{player.depthRank}</span><div className="dynasty-overall-shield dynasty-overall-shield--small"><strong>{Math.round(player.overall)}</strong><small>OVR</small></div><div><strong>{player.name}</strong><small>{playerYear(player)} · {playerStatus(player)}</small></div><em>{resolvedPosition(player)}</em><Icon name="arrow-right" size={15} /></button>;
                    })}
                    {room.length === 0 && <div className="dynasty-empty dynasty-empty--row">Позиционная комната пуста</div>}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {view === "planning" && (
        <div className="dynasty-stack dynasty-data-view">
          {worldTeam && ecosystemSnapshot ? (
            <>
              <section className="dynasty-metric-grid">
                <article><small>Стратегия</small><strong>{rosterStrategyLabel(worldTeam.rosterPlan.strategy)}</strong></article>
                <article><small>Размер класса</small><strong>{worldTeam.rosterPlan.targetClassSize}</strong></article>
                <article><small>Свободные места</small><strong>{worldTeam.rosterPlan.availableRosterSpots}</strong></article>
                <article><small>Уходят</small><strong>{worldTeam.rosterPlan.projectedDepartures}</strong></article>
              </section>
              <section className="dynasty-panel"><header className="dynasty-section-title"><span /><strong>Позиционный план</strong><em>{worldTeam.rosterPlan.lastReviewReason}</em></header><div className="dynasty-row-list">{positionPlan.map((projection) => <article key={projection.position}><b>{projection.position}</b><div><strong>{projection.currentPlayers} в комнате</strong><small>{projection.returningNextYear} вернутся · OVR {Math.round(projection.averageOverall)}</small></div><em>+{projection.targetAdds}</em></article>)}</div></section>
              <section className="dynasty-panel"><header className="dynasty-section-title"><span /><strong>Набор и портал</strong><em>{ecosystemSnapshot.negotiations.filter((item) => item.status === "offered").length} активных</em></header><div className="dynasty-row-list">{ecosystemSnapshot.negotiations.slice(0, 12).map((item) => <article key={item.id}><b>{item.position}</b><div><strong>{item.candidateName}</strong><small>{candidateKindLabel(item.candidateKind)} · {promiseRoleLabel(item.promisedRole)} · {scholarshipLabel(item.scholarship)}</small></div><em>{negotiationStatusLabel(item.status)}</em></article>)}{ecosystemSnapshot.negotiations.length === 0 && <div className="dynasty-empty">Переговоров нет</div>}</div></section>
              <section className="dynasty-panel"><header className="dynasty-section-title"><span /><strong>Открытые места</strong><em>{ecosystemSnapshot.openings.filter((item) => item.status === "open").length}</em></header><div className="dynasty-row-list">{ecosystemSnapshot.openings.map((opening) => <article key={opening.id}><b>{opening.position}</b><div><strong>{opening.reason}</strong><small>{opening.filledByCandidateIds.length}/{opening.slots} заполнено · {opening.scholarshipSlots} стипендий</small></div><em>{openingStatusLabel(opening.status)}</em></article>)}{ecosystemSnapshot.openings.length === 0 && <div className="dynasty-empty">План набора не сформирован</div>}</div></section>
            </>
          ) : <div className="dynasty-empty">План состава доступен для команд экосистемы</div>}
        </div>
      )}

      {view === "staff" && <div className="dynasty-card-list dynasty-data-view">{teamCoaches.map((coach) => <article key={coach.id}><div className="dynasty-avatar">{coach.role === "head-coach" ? "HC" : coach.role === "offensive-coordinator" ? "OC" : coach.role === "defensive-coordinator" ? "DC" : "PC"}</div><div><small>{roleLabel(coach.role)}</small><strong>{coach.name}</strong><span>{"contractYears" in coach ? `DEV ${Math.round(coach.development)} · ADP ${Math.round(coach.adaptability)} · ${coach.contractYears}Y` : `DEV ${coach.development}`}</span></div><b>{Math.round(coach.tactics)}</b></article>)}</div>}

      {view === "system" && <div className="dynasty-stack dynasty-data-view">{worldTeam ? <><section className="dynasty-grid dynasty-grid--two"><article className="dynasty-panel dynasty-system-card"><small>Атака</small><h2>{offenseSystemLabel(worldTeam.tactical.offenseSystem)}</h2><p>{worldTeam.offenseStyle}</p></article><article className="dynasty-panel dynasty-system-card"><small>Защита</small><h2>{defenseSystemLabel(worldTeam.tactical.defenseSystem)}</h2><p>{worldTeam.defenseStyle}</p></article></section><section className="dynasty-metric-grid">{[["Установка", worldTeam.tactical.installation], ["Связность", worldTeam.tactical.continuity], ["Вынос", worldTeam.tactical.runRate], ["Глубина", worldTeam.tactical.deepShotRate], ["Блиц", worldTeam.tactical.blitzRate], ["Man", worldTeam.tactical.manCoverageRate], ["Маскировка", worldTeam.tactical.disguiseRate], ["Адаптация", worldTeam.tactical.adaptation]].map(([label, value]) => <article key={String(label)}><small>{label}</small><strong>{Math.round(Number(value))}</strong></article>)}</section></> : <section className="dynasty-metric-grid">{[["Схема", save.football.teamDynamics.schemeMastery], ["Дисциплина", save.football.teamDynamics.discipline], ["Тренеры", save.football.school.coaching], ["Молодёжь", save.football.school.youthTrust]].map(([label, value]) => <article key={String(label)}><small>{label}</small><strong>{Math.round(Number(value))}</strong></article>)}</section>}</div>}

      {view === "resources" && <section className="dynasty-metric-grid dynasty-data-view">{worldTeam ? <>{[["Бюджет", money(worldTeam.resources.footballBudget)], ["Рекрутинг", money(worldTeam.resources.recruitingBudget)], ["NIL", money(worldTeam.resources.nilCapacity)], ["Баланс", money(worldTeam.resources.currentBalance)], ["База", Math.round(worldTeam.resources.facilitiesLevel)], ["Медицина", Math.round(worldTeam.resources.medicalLevel)], ["Учёба", Math.round(worldTeam.resources.academicSupportLevel)], ["Давление", Math.round(worldTeam.resources.financialPressure)]].map(([label, value]) => <article key={String(label)}><small>{label}</small><strong>{value}</strong></article>)}</> : <>{[["База", save.football.school.facilities], ["Тренеры", save.football.school.coaching], ["Медицина", save.football.school.medicine], ["Дисциплина", save.football.school.discipline]].map(([label, value]) => <article key={String(label)}><small>{label}</small><strong>{Math.round(Number(value))}</strong></article>)}</>}</section>}

      {view === "history" && <div className="dynasty-stack dynasty-data-view">{worldTeam && ecosystemSnapshot ? <><section className="dynasty-metric-grid"><article><small>Входящие</small><strong>{ecosystemSnapshot.inboundMoves}</strong></article><article><small>Исходящие</small><strong>{ecosystemSnapshot.outboundMoves}</strong></article><article><small>Сезонов</small><strong>{ecosystemSnapshot.history.length}</strong></article><article><small>Вакансии</small><strong>{ecosystemSnapshot.vacancies.length}</strong></article></section><section className="dynasty-panel"><header className="dynasty-section-title"><span /><strong>История сезонов</strong></header><div className="dynasty-row-list">{ecosystemSnapshot.history.map((season) => <article key={season.id}><b>{season.seasonYear}</b><div><strong>{season.wins}–{season.losses}</strong><small>{season.conferenceWins}–{season.conferenceLosses} в конференции · место {season.finish}</small></div><em>{season.conferenceChampion ? "CHAMP" : Math.round(season.finalRating)}</em></article>)}{ecosystemSnapshot.history.length === 0 && <div className="dynasty-empty">Первый сезон ещё не архивирован</div>}</div></section><section className="dynasty-panel"><header className="dynasty-section-title"><span /><strong>Транзакции</strong><em>{ecosystemSnapshot.transactions.length}</em></header><div className="dynasty-row-list">{ecosystemSnapshot.transactions.slice(0, 30).map((item) => { const player = item.playerId ? save.world.players.find((candidate) => candidate.id === item.playerId) : undefined; return player ? <button type="button" key={item.id} onClick={() => setSelectedPlayer(player)}><b>W{item.week}</b><div><strong>{item.title}</strong><small>{item.detail}</small></div><Icon name="arrow-right" size={15} /></button> : <article key={item.id}><b>W{item.week}</b><div><strong>{item.title}</strong><small>{item.detail}</small></div><em>{item.seasonYear}</em></article>; })}{ecosystemSnapshot.transactions.length === 0 && <div className="dynasty-empty">Движений пока нет</div>}</div></section></> : <div className="dynasty-empty">История доступна для команд экосистемы</div>}</div>}

      <EcosystemPlayerProfile save={save} player={selectedPlayer} onClose={() => setSelectedPlayer(undefined)} />
    </div>
  );
}
