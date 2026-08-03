import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { EcosystemCompetitionGame, EcosystemTeam } from "../../sports/football/ecosystem/types";
import { defenseSystemLabel, offenseSystemLabel } from "../../sports/football/ecosystem/tactics";
import { professionalStandings } from "../../sports/football/pro/league";
import type { ProfessionalCoach, ProfessionalGame, ProfessionalRosterPlayer, ProfessionalTeam, ProfessionalTransaction } from "../../sports/football/pro/types";
import { FOOTBALL_ROSTER_POSITIONS } from "../../sports/football/team/positions";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { teamBrandStyle, teamMark } from "./teamBrand";
import { ManagerPageHeader } from "./ManagerPageHeader";

type LeagueDirectoryView = "college" | "professional";
type LeagueSection = "overview" | "teams";

interface LeagueDirectoryDashboardProps {
  save: CareerSave;
  onOpenCollegeTeam?(teamId: string): void;
  initialView?: LeagueDirectoryView;
}

function coachRole(role: ProfessionalCoach["role"]): string {
  return { "head-coach": "Главный", "offensive-coordinator": "Координатор атаки", "defensive-coordinator": "Координатор защиты", "position-coach": "Тренер позиции" }[role];
}

function money(value: number): string {
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

function conferenceName(save: CareerSave, conferenceId?: string): string {
  return save.world.conferences.find((item) => item.id === conferenceId)?.shortName ?? "Независимые";
}

function proDepth(players: ProfessionalRosterPlayer[]): ProfessionalRosterPlayer[] {
  return [...players]
    .filter((player) => player.status === "active" || player.status === "injured-reserve")
    .sort((left, right) => FOOTBALL_ROSTER_POSITIONS.indexOf(left.position) - FOOTBALL_ROSTER_POSITIONS.indexOf(right.position)
      || left.depthRank - right.depthRank
      || right.overall - left.overall);
}

function collegeGameWeight(game: EcosystemCompetitionGame, teams: EcosystemTeam[]): number {
  const home = teams.find((team) => team.id === game.homeTeamId);
  const away = teams.find((team) => team.id === game.awayTeamId);
  const kind = game.kind === "playoff" ? 80 : game.kind === "conference-championship" ? 70 : game.kind === "rivalry" ? 30 : 0;
  return kind + (home?.rating ?? 0) + (away?.rating ?? 0);
}

function proGameWeight(game: ProfessionalGame, teams: ProfessionalTeam[]): number {
  const home = teams.find((team) => team.id === game.homeTeamId);
  const away = teams.find((team) => team.id === game.awayTeamId);
  return (game.playoffRound ? 80 : 0) + ((home?.wins ?? 0) + (away?.wins ?? 0)) * 8 + (home?.rosterStrength ?? 0) + (away?.rosterStrength ?? 0);
}

function proTransactionLabel(kind: ProfessionalTransaction["kind"]): string {
  return { signing: "Подписание", release: "Освобождение", "waiver-claim": "Заявка с вейвера", injury: "Травма", promotion: "Подъём в основной состав", trade: "Обмен", "cap-move": "Решение по потолку" }[kind];
}

function gameState(game: EcosystemCompetitionGame): string {
  if (game.status === "complete") return `${game.homeScore ?? 0}:${game.awayScore ?? 0}`;
  if (game.kind === "rivalry") return "Принципиальный матч";
  if (game.kind === "conference") return "Матч конференции";
  if (game.kind === "playoff") return "Плей-офф";
  return "Предстоящий матч";
}

export function LeagueDirectoryDashboard({ save, onOpenCollegeTeam, initialView = "college" }: LeagueDirectoryDashboardProps) {
  const [view, setView] = useState<LeagueDirectoryView>(initialView);
  const [section, setSection] = useState<LeagueSection>("overview");
  const [query, setQuery] = useState("");
  const [selectedProTeamId, setSelectedProTeamId] = useState<string>();
  const normalizedQuery = query.trim().toLowerCase();

  const collegeTeams = useMemo(() => save.world.teams.filter((team) => team.level === "college"), [save.world.teams]);
  const colleges = useMemo(() => collegeTeams
    .filter((team) => !normalizedQuery || `${team.name} ${team.shortName} ${team.stateCode}`.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => right.wins - left.wins || left.losses - right.losses || right.rating - left.rating), [collegeTeams, normalizedQuery]);
  const allProfessionalTeams = save.football.professional.teams;
  const professionalTeams = useMemo(() => allProfessionalTeams
    .filter((team) => !normalizedQuery || `${team.city} ${team.name} ${team.shortName} ${team.conference}`.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => right.wins - left.wins || left.losses - right.losses || right.rosterStrength - left.rosterStrength), [allProfessionalTeams, normalizedQuery]);
  const proStandings = useMemo(() => professionalStandings(save.football.professional.teams), [save.football.professional.teams]);

  const collegeWeek = save.world.seasonWeek;
  const collegeWeekGames = save.world.competition.schedule.filter((game) => game.week === collegeWeek);
  const collegeFeatured = [...collegeWeekGames].sort((left, right) => collegeGameWeight(right, collegeTeams) - collegeGameWeight(left, collegeTeams))[0]
    ?? [...save.world.competition.schedule].filter((game) => game.status === "complete").sort((left, right) => right.week - left.week)[0];
  const collegeRankings = [...save.world.competition.rankings].sort((left, right) => left.rank - right.rank);
  const rankingMovers = collegeRankings
    .filter((item) => item.previousRank && item.previousRank !== item.rank)
    .sort((left, right) => Math.abs((right.previousRank ?? right.rank) - right.rank) - Math.abs((left.previousRank ?? left.rank) - left.rank))
    .slice(0, 5);
  const conferenceRaces = [...save.world.conferences]
    .sort((left, right) => right.prestige - left.prestige)
    .slice(0, 5)
    .map((conference) => ({ conference, teams: collegeTeams.filter((team) => team.conferenceId === conference.id).sort((left, right) => right.conferenceWins - left.conferenceWins || left.conferenceLosses - right.conferenceLosses || right.rating - left.rating).slice(0, 2) }));
  const collegeStories = [...save.world.stories]
    .filter((story) => story.teamIds.some((teamId) => collegeTeams.some((team) => team.id === teamId)))
    .sort((left, right) => right.week - left.week || right.importance - left.importance)
    .slice(0, 5);

  const proLeague = save.football.professional.league;
  const proWeekGames = proLeague.schedule.filter((game) => game.week === proLeague.week);
  const proFeatured = [...proWeekGames].sort((left, right) => proGameWeight(right, allProfessionalTeams) - proGameWeight(left, allProfessionalTeams))[0]
    ?? [...proLeague.schedule].filter((game) => game.status === "complete").sort((left, right) => right.week - left.week)[0];
  const proTransactions = [...proLeague.transactions].sort((left, right) => right.seasonYear - left.seasonYear || right.week - left.week).slice(0, 7);
  const afc = proStandings.filter((team) => team.conference === "AFC").slice(0, 4);
  const nfc = proStandings.filter((team) => team.conference === "NFC").slice(0, 4);

  const selectedProTeam = save.football.professional.teams.find((team) => team.id === selectedProTeamId);
  const selectedRoster = selectedProTeam ? proDepth(proLeague.roster.filter((player) => player.teamId === selectedProTeam.id)) : [];
  const needs = selectedProTeam ? FOOTBALL_ROSTER_POSITIONS.map((position) => ({ position, value: selectedProTeam.needs[position] })).sort((left, right) => right.value - left.value).slice(0, 5) : [];

  function collegeTeam(teamId?: string): EcosystemTeam | undefined {
    return teamId ? collegeTeams.find((team) => team.id === teamId) : undefined;
  }

  function proTeam(teamId?: string): ProfessionalTeam | undefined {
    return teamId ? allProfessionalTeams.find((team) => team.id === teamId) : undefined;
  }

  return (
    <div className="league-hub">
      <ManagerPageHeader
        eyebrow="ЦЕНТР СЕЗОНА"
        title={view === "college" ? "Колледжный футбол" : "Профессиональная лига"}
        subtitle={view === "college" ? "Рейтинг, конференции, ключевые матчи и движение программ." : "Плей-офф, сила команд, кадровые движения и главные матчи."}
        badge={view === "college" ? "CFB" : "PRO"}
        metrics={[
          { label: "Сезон", value: view === "college" ? save.world.seasonYear : proLeague.seasonYear },
          { label: "Неделя", value: view === "college" ? collegeWeek : proLeague.week },
          { label: "Команды", value: view === "college" ? collegeTeams.length : allProfessionalTeams.length },
          { label: "Фаза", value: view === "college" ? save.world.phase : proLeague.phase },
        ]}
      />

      <nav className="league-hub__levels" aria-label="Уровень лиги">
        <button type="button" className={view === "college" ? "is-active" : ""} onClick={() => { setView("college"); setSection("overview"); }}>Колледжи</button>
        <button type="button" className={view === "professional" ? "is-active" : ""} onClick={() => { setView("professional"); setSection("overview"); }}>PRO</button>
      </nav>

      <nav className="league-hub__sections" aria-label="Раздел центра сезона">
        <button type="button" className={section === "overview" ? "is-active" : ""} onClick={() => setSection("overview")}>Что происходит</button>
        <button type="button" className={section === "teams" ? "is-active" : ""} onClick={() => setSection("teams")}>Все команды</button>
      </nav>

      {section === "overview" && view === "college" && (
        <div className="league-overview">
          <section className="league-featured-game">
            <header><small>ГЛАВНЫЙ МАТЧ НЕДЕЛИ</small><span>{collegeFeatured ? `W${collegeFeatured.week}` : "—"}</span></header>
            {collegeFeatured ? <div>
              <button type="button" style={teamBrandStyle(collegeFeatured.homeTeamId)} onClick={() => onOpenCollegeTeam?.(collegeFeatured.homeTeamId)}><span>{teamMark(collegeTeam(collegeFeatured.homeTeamId)?.shortName ?? collegeFeatured.homeTeamId)}</span><strong>{collegeTeam(collegeFeatured.homeTeamId)?.name ?? collegeFeatured.homeTeamId}</strong><em>{collegeFeatured.status === "complete" ? collegeFeatured.homeScore : Math.round(collegeTeam(collegeFeatured.homeTeamId)?.rating ?? 0)}</em></button>
              <p>{gameState(collegeFeatured)}</p>
              <button type="button" style={teamBrandStyle(collegeFeatured.awayTeamId)} onClick={() => onOpenCollegeTeam?.(collegeFeatured.awayTeamId)}><span>{teamMark(collegeTeam(collegeFeatured.awayTeamId)?.shortName ?? collegeFeatured.awayTeamId)}</span><strong>{collegeTeam(collegeFeatured.awayTeamId)?.name ?? collegeFeatured.awayTeamId}</strong><em>{collegeFeatured.status === "complete" ? collegeFeatured.awayScore : Math.round(collegeTeam(collegeFeatured.awayTeamId)?.rating ?? 0)}</em></button>
            </div> : <div className="data-empty">Матчи не назначены</div>}
          </section>

          <section className="league-ranking-panel">
            <header><div><small>НАЦИОНАЛЬНЫЙ РЕЙТИНГ</small><h2>Кто наверху</h2></div><span>{collegeRankings.length} команд</span></header>
            {collegeRankings.slice(0, 8).map((ranking) => {
              const team = collegeTeam(ranking.teamId);
              const movement = ranking.previousRank ? ranking.previousRank - ranking.rank : 0;
              return <button type="button" key={ranking.teamId} style={teamBrandStyle(ranking.teamId)} onClick={() => onOpenCollegeTeam?.(ranking.teamId)}><span>{ranking.rank}</span><b>{teamMark(team?.shortName ?? ranking.teamId)}</b><div><strong>{team?.name ?? ranking.teamId}</strong><small>{team?.wins ?? 0}–{team?.losses ?? 0} · разница {ranking.pointDifferential >= 0 ? "+" : ""}{ranking.pointDifferential}</small></div><em className={movement > 0 ? "is-up" : movement < 0 ? "is-down" : ""}>{movement > 0 ? `▲ ${movement}` : movement < 0 ? `▼ ${Math.abs(movement)}` : "—"}</em></button>;
            })}
          </section>

          <section className="league-movers">
            <header><div><small>ИЗМЕНЕНИЯ</small><h2>Кто поднялся и упал</h2></div><span>за неделю</span></header>
            {rankingMovers.map((ranking) => {
              const team = collegeTeam(ranking.teamId);
              const movement = (ranking.previousRank ?? ranking.rank) - ranking.rank;
              return <button type="button" key={ranking.teamId} style={teamBrandStyle(ranking.teamId)} onClick={() => onOpenCollegeTeam?.(ranking.teamId)}><b>{teamMark(team?.shortName ?? ranking.teamId)}</b><div><strong>{team?.shortName ?? ranking.teamId}</strong><small>Теперь #{ranking.rank}</small></div><span className={movement > 0 ? "is-up" : "is-down"}>{movement > 0 ? `Подъём на ${movement}` : `Падение на ${Math.abs(movement)}`}</span></button>;
            })}
            {rankingMovers.length === 0 && <div className="data-empty">Рейтинг не изменился</div>}
          </section>

          <section className="league-races">
            <header><div><small>КОНФЕРЕНЦИИ</small><h2>Борьба за первое место</h2></div><span>{conferenceRaces.length} гонок</span></header>
            {conferenceRaces.map(({ conference, teams }) => <article key={conference.id}><header><strong>{conference.shortName}</strong><span>{teams[0]?.conferenceWins ?? 0}–{teams[0]?.conferenceLosses ?? 0}</span></header>{teams.map((team, index) => <button type="button" key={team.id} style={teamBrandStyle(team.id)} onClick={() => onOpenCollegeTeam?.(team.id)}><span>{index + 1}</span><b>{teamMark(team.shortName)}</b><strong>{team.shortName}</strong><em>{team.conferenceWins}–{team.conferenceLosses}</em></button>)}</article>)}
          </section>

          <section className="league-news">
            <header><div><small>ЛИГА</small><h2>Главные события</h2></div><span>реальные события мира</span></header>
            {collegeStories.map((story) => <article key={story.id}><span>W{story.week}</span><div><strong>{story.title}</strong><small>{story.detail}</small></div></article>)}
            {collegeStories.length === 0 && <div className="data-empty">Значимых событий пока нет</div>}
          </section>
        </div>
      )}

      {section === "overview" && view === "professional" && (
        <div className="league-overview">
          <section className="league-featured-game">
            <header><small>ГЛАВНЫЙ МАТЧ НЕДЕЛИ</small><span>{proFeatured ? `W${proFeatured.week}` : "—"}</span></header>
            {proFeatured ? <div>
              <button type="button" style={teamBrandStyle(proFeatured.homeTeamId)} onClick={() => setSelectedProTeamId(proFeatured.homeTeamId)}><span>{teamMark(proTeam(proFeatured.homeTeamId)?.shortName ?? proFeatured.homeTeamId)}</span><strong>{proTeam(proFeatured.homeTeamId)?.city} {proTeam(proFeatured.homeTeamId)?.name}</strong><em>{proFeatured.status === "complete" ? proFeatured.homeScore : `${proTeam(proFeatured.homeTeamId)?.wins ?? 0}–${proTeam(proFeatured.homeTeamId)?.losses ?? 0}`}</em></button>
              <p>{proFeatured.playoffRound ? "Плей-офф" : proFeatured.status === "complete" ? "Финальный счёт" : "Предстоящий матч"}</p>
              <button type="button" style={teamBrandStyle(proFeatured.awayTeamId)} onClick={() => setSelectedProTeamId(proFeatured.awayTeamId)}><span>{teamMark(proTeam(proFeatured.awayTeamId)?.shortName ?? proFeatured.awayTeamId)}</span><strong>{proTeam(proFeatured.awayTeamId)?.city} {proTeam(proFeatured.awayTeamId)?.name}</strong><em>{proFeatured.status === "complete" ? proFeatured.awayScore : `${proTeam(proFeatured.awayTeamId)?.wins ?? 0}–${proTeam(proFeatured.awayTeamId)?.losses ?? 0}`}</em></button>
            </div> : <div className="data-empty">Матчи не назначены</div>}
          </section>

          <section className="league-playoff-picture">
            <header><div><small>ПЛЕЙ-ОФФ</small><h2>Кто проходит сейчас</h2></div><span>{proLeague.phase}</span></header>
            <div><ConferenceTable title="AFC" teams={afc} onOpen={setSelectedProTeamId} /><ConferenceTable title="NFC" teams={nfc} onOpen={setSelectedProTeamId} /></div>
          </section>

          <section className="league-news league-news--pro">
            <header><div><small>ПОСЛЕДНИЕ ДВИЖЕНИЯ</small><h2>Что изменилось в лиге</h2></div><span>{proTransactions.length}</span></header>
            {proTransactions.map((transaction) => <article key={transaction.id}><span>{transaction.position}</span><div><strong>{proTransactionLabel(transaction.kind)} · {transaction.playerName}</strong><small>{transaction.summary}</small></div><em>W{transaction.week}</em></article>)}
            {proTransactions.length === 0 && <div className="data-empty">Лига пока без кадровых изменений</div>}
          </section>

          <section className="league-power-table">
            <header><div><small>ВСЯ ЛИГА</small><h2>Лучшие команды сейчас</h2></div><button type="button" onClick={() => setSection("teams")}>Открыть все</button></header>
            {proStandings.slice(0, 8).map((team, index) => <button type="button" key={team.id} style={teamBrandStyle(team.id)} onClick={() => setSelectedProTeamId(team.id)}><span>{index + 1}</span><b>{teamMark(team.shortName)}</b><div><strong>{team.city} {team.name}</strong><small>{team.conference} · сила состава {Math.round(team.rosterStrength)}</small></div><em>{team.wins}–{team.losses}</em></button>)}
          </section>
        </div>
      )}

      {section === "teams" && (
        <>
          <label className="league-hub__search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти команду" /></label>
          <section className="league-team-directory">
            <header><span>Команда</span><span>Контекст</span><span>Рекорд</span><span>Сила</span></header>
            {view === "college" ? colleges.map((team) => <button type="button" key={team.id} style={teamBrandStyle(team.id)} onClick={() => onOpenCollegeTeam?.(team.id)} disabled={!onOpenCollegeTeam}><div><span>{teamMark(team.shortName)}</span><strong>{team.name}</strong></div><small>{conferenceName(save, team.conferenceId)} · {team.stateCode}</small><em>{team.wins}–{team.losses}</em><b>{Math.round(team.rating)}</b></button>) : professionalTeams.map((team) => <button type="button" key={team.id} style={teamBrandStyle(team.id)} onClick={() => setSelectedProTeamId(team.id)}><div><span>{teamMark(team.shortName)}</span><strong>{team.city} {team.name}</strong></div><small>{team.conference} · свободно {money(team.capSpace)}</small><em>{team.wins}–{team.losses}</em><b>{Math.round(team.rosterStrength)}</b></button>)}
          </section>
        </>
      )}

      <BottomSheet open={Boolean(selectedProTeam)} title={selectedProTeam ? `${selectedProTeam.city} ${selectedProTeam.name}` : "PRO"} eyebrow={selectedProTeam ? `${selectedProTeam.conference} · ${selectedProTeam.wins}–${selectedProTeam.losses}` : "PRO"} onClose={() => setSelectedProTeamId(undefined)}>
        {selectedProTeam && <ProTeamSheet team={selectedProTeam} roster={selectedRoster} needs={needs} />}
      </BottomSheet>
    </div>
  );
}

function ConferenceTable({ title, teams, onOpen }: { title: string; teams: ProfessionalTeam[]; onOpen(teamId: string): void }) {
  return <section><header><strong>{title}</strong><span>Топ-4</span></header>{teams.map((team, index) => <button type="button" key={team.id} style={teamBrandStyle(team.id)} onClick={() => onOpen(team.id)}><span>{index + 1}</span><b>{teamMark(team.shortName)}</b><strong>{team.shortName}</strong><em>{team.wins}–{team.losses}</em></button>)}</section>;
}

function ProTeamSheet({ team, roster, needs }: { team: ProfessionalTeam; roster: ProfessionalRosterPlayer[]; needs: Array<{ position: ProfessionalRosterPlayer["position"]; value: number }> }) {
  return (
    <div className="pro-team-sheet">
      <section className="pro-team-sheet__metrics"><span><small>Сила состава</small><strong>{Math.round(team.rosterStrength)}</strong></span><span><small>Игроков</small><strong>{team.rosterSize}</strong></span><span><small>Свободно под потолком</small><strong>{money(team.capSpace)}</strong></span><span><small>Зарплаты</small><strong>{money(team.payroll)}</strong></span></section>
      {team.tactical && <section className="pro-team-sheet__system"><header><small>Игровая система</small></header><div><span><small>Атака</small><strong>{offenseSystemLabel(team.tactical.offenseSystem)}</strong></span><span><small>Защита</small><strong>{defenseSystemLabel(team.tactical.defenseSystem)}</strong></span><span><small>Вынос</small><strong>{Math.round(team.tactical.runRate)}%</strong></span><span><small>Блиц</small><strong>{Math.round(team.tactical.blitzRate)}%</strong></span><span><small>Персональная опека</small><strong>{Math.round(team.tactical.manCoverageRate)}%</strong></span><span><small>Адаптация</small><strong>{Math.round(team.tactical.adaptation)}</strong></span></div></section>}
      <section className="pro-team-sheet__staff"><header><small>Штаб</small></header><div>{(team.staff ?? []).map((coach) => <article key={coach.id}><span>{coachRole(coach.role)}</span><div><strong>{coach.name}</strong><small>Тактика {Math.round(coach.tactics)} · развитие {Math.round(coach.development)}</small></div><em>{coach.contractYears} г.</em></article>)}</div></section>
      <section className="pro-team-sheet__needs"><header><small>Главные потребности</small></header><div>{needs.map((item) => <span key={item.position}><strong>{item.position}</strong><em>{item.value}</em></span>)}</div></section>
      <section className="pro-team-sheet__roster"><header><small>Depth chart</small><strong>{roster.length}</strong></header>{roster.map((player) => <article key={player.id} className={player.isHero ? "is-hero" : ""}><span>{player.position}</span><div><strong>{player.name}</strong><small>#{player.depthRank} · соответствие системе {Math.round(player.schemeFit)} · {player.availability}</small></div><em>{Math.round(player.overall)}</em></article>)}</section>
    </div>
  );
}
