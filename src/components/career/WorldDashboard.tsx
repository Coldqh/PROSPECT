import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { defenseSystemLabel, offenseSystemLabel, positionRoleLabel } from "../../sports/football/ecosystem/tactics";
import type {
  EcosystemConference,
  EcosystemPlayer,
  EcosystemStory,
  EcosystemTeam,
  EcosystemTransaction,
  FootballEcosystemState,
} from "../../sports/football/ecosystem/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { SectionTabs } from "../ui/SectionTabs";

const primaryViews = [
  { id: "feed", label: "Лента" },
  { id: "rankings", label: "Рейтинг" },
  { id: "explore", label: "Обзор" },
] as const;

const exploreItems = [
  { id: "leagues", label: "Конференции", detail: "Таблицы и гонки", icon: "trophy" },
  { id: "moves", label: "Переходы", detail: "Трансферы и штабы", icon: "swap" },
  { id: "market", label: "Рынок", detail: "Предложения и вакансии", icon: "target" },
  { id: "resources", label: "Ресурсы", detail: "Бюджеты и NIL", icon: "database" },
  { id: "plans", label: "Составы", detail: "Планы на три года", icon: "team" },
  { id: "tactics", label: "Системы", detail: "Схемы и fit", icon: "brain" },
  { id: "social", label: "Раздевалки", detail: "Доверие и конфликты", icon: "message" },
  { id: "talent", label: "Таланты", detail: "Регионы и проспекты", icon: "spark" },
  { id: "history", label: "История", detail: "Эпохи и результаты", icon: "history" },
] as const satisfies readonly { id: string; label: string; detail: string; icon: import("../ui/Icon").IconName }[];

type WorldPrimaryView = (typeof primaryViews)[number]["id"];
type WorldDetailView = (typeof exploreItems)[number]["id"];

function storyKindLabel(kind: EcosystemStory["kind"]): string {
  return {
    breakout: "Прорыв",
    injury: "Травма",
    "depth-change": "Состав",
    commitment: "Коммит",
    "coach-pressure": "Давление",
    "coach-move": "Штаб",
    upset: "Результат",
    "market-shift": "Рынок",
    "conference-race": "Гонка",
    championship: "Титул",
    transfer: "Трансфер",
    graduation: "Выпуск",
    enrollment: "Набор",
    investment: "Инвестиции",
    "budget-crunch": "Бюджет",
    "nil-battle": "NIL",
    "resource-shift": "Ресурсы",
    "talent-class": "Поколение",
    "camp-breakout": "Лагерь",
    "juco-route": "JUCO",
    "walk-on-route": "Walk-on",
    "roster-plan": "План состава",
    "position-change": "Смена позиции",
    redshirt: "Redshirt",
    scholarship: "Стипендия",
    offer: "Предложение",
    "offer-withdrawn": "Отзыв",
    "market-chain": "Цепочка рынка",
    "coach-vacancy": "Вакансия",
    "tactical-change": "Смена схемы",
    "scheme-fit": "Соответствие",
    ranking: "Рейтинг",
    playoff: "Плей-офф",
    award: "Награда",
    rivalry: "Rivalry",
    bowl: "Bowl",
    mentorship: "Наставник",
    "locker-room-conflict": "Конфликт",
    leadership: "Лидерство",
    reconciliation: "Примирение",
    "staff-friction": "Спор штаба",
    "broken-promise": "Обещание",
  }[kind];
}

function phaseLabel(phase: FootballEcosystemState["phase"]): string {
  return phase === "regular-season" ? "Регулярный сезон" : phase === "postseason" ? "Национальный постсезон" : "Межсезонье";
}

function transactionLabel(kind: EcosystemTransaction["kind"]): string {
  return {
    "portal-entry": "Портал",
    transfer: "Переход",
    "coach-fired": "Увольнение",
    "coach-hired": "Назначение",
    graduation: "Выпуск",
    "recruit-enrolled": "Зачисление",
    "facility-investment": "Инфраструктура",
    "budget-cut": "Сокращение",
    "nil-commitment": "NIL",
    "juco-entry": "JUCO",
    "walk-on-entry": "Walk-on",
    "talent-enrolled": "Набор",
    "position-change": "Позиция",
    "scholarship-awarded": "Стипендия",
    "redshirt-assigned": "Redshirt",
    "offer-issued": "Предложение",
    "offer-withdrawn": "Отзыв",
    commitment: "Коммит",
    "coach-vacancy": "Вакансия",
    "tactical-change": "Смена схемы",
    "scheme-fit": "Соответствие",
  }[kind];
}

function rosterStrategyLabel(strategy: EcosystemTeam["rosterPlan"]["strategy"]): string {
  return { contend: "Победа сейчас", balanced: "Баланс", develop: "Развитие", rebuild: "Перестройка" }[strategy];
}

function usageCount(team: EcosystemTeam): number {
  return team.rosterPlan.redshirtPlayerIds.length + team.rosterPlan.developmentalPlayerIds.length;
}

type WorldDashboardSave = Pick<CareerSave, "world" | "football">;

export function WorldDashboard({ save }: { save: WorldDashboardSave }) {
  const [primaryView, setPrimaryView] = useState<WorldPrimaryView>("feed");
  const [detailView, setDetailView] = useState<WorldDetailView>();
  const [query, setQuery] = useState("");
  const [selectedStory, setSelectedStory] = useState<EcosystemStory>();
  const [selectedPlayer, setSelectedPlayer] = useState<EcosystemPlayer>();
  const [selectedConference, setSelectedConference] = useState<EcosystemConference>();
  const [selectedTeam, setSelectedTeam] = useState<EcosystemTeam>();
  const { world, football } = save;

  const stories = useMemo(
    () => [...world.stories]
      .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.importance - left.importance)
      .slice(0, 18),
    [world.stories],
  );
  const transactions = useMemo(
    () => [...world.transactions]
      .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.seasonYear - left.seasonYear || right.week - left.week)
      .slice(0, 18),
    [world.transactions],
  );
  const marketNegotiations = useMemo(
    () => [...world.movementMarket.negotiations]
      .sort((left, right) => {
        const statusWeight = { offered: 3, accepted: 2, withdrawn: 1, expired: 0 } as const;
        return statusWeight[right.status] - statusWeight[left.status] || right.score - left.score;
      })
      .slice(0, 16),
    [world.movementMarket.negotiations],
  );
  const openVacancies = useMemo(
    () => world.movementMarket.coachVacancies.filter((vacancy) => vacancy.status === "open"),
    [world.movementMarket.coachVacancies],
  );
  const historyYears = useMemo(
    () => [...new Set(world.teamHistory.map((record) => record.seasonYear))].sort((left, right) => right - left),
    [world.teamHistory],
  );
  const heroProgramId = football.college.signedProgramId;
  const resourceTeams = useMemo(
    () => world.teams
      .filter((team) => team.level === "college")
      .sort((left, right) =>
        Number(right.id === heroProgramId) - Number(left.id === heroProgramId)
        || right.resources.financialPressure - left.resources.financialPressure
        || right.resources.annualBudget - left.resources.annualBudget,
      ),
    [world.teams, heroProgramId],
  );
  const rosterTeams = useMemo(
    () => world.teams
      .filter((team) => team.level === "college")
      .sort((left, right) =>
        Number(right.id === heroProgramId) - Number(left.id === heroProgramId)
        || right.rosterPlan.retentionRisk - left.rosterPlan.retentionRisk
        || right.rosterPlan.targetClassSize - left.rosterPlan.targetClassSize,
      ),
    [world.teams, heroProgramId],
  );
  const tacticalTeams = useMemo(
    () => world.teams
      .filter((team) => team.level === "college")
      .sort((left, right) =>
        Number(right.id === heroProgramId) - Number(left.id === heroProgramId)
        || left.tactical.installation - right.tactical.installation
        || right.rating - left.rating,
      ),
    [world.teams, heroProgramId],
  );
  const averageInstallation = tacticalTeams.length > 0
    ? Math.round(tacticalTeams.reduce((sum, team) => sum + team.tactical.installation, 0) / tacticalTeams.length)
    : 0;
  const nationalRankings = useMemo(
    () => world.competition.rankings.slice(0, 12),
    [world.competition.rankings],
  );
  const recentCompetitionGames = useMemo(
    () => [...world.competition.schedule]
      .filter((game) => game.status === "complete")
      .sort((left, right) => right.week - left.week || right.id.localeCompare(left.id))
      .slice(0, 8),
    [world.competition.schedule],
  );
  const currentAwards = useMemo(
    () => [...world.competition.awards]
      .filter((award) => award.seasonYear === world.competition.seasonYear)
      .slice(-10)
      .reverse(),
    [world.competition.awards, world.competition.seasonYear],
  );
  const legacyPrograms = useMemo(
    () => [...world.competition.programLegacies]
      .sort((left, right) => right.reputation - left.reputation || right.nationalTitles - left.nationalTitles)
      .slice(0, 10),
    [world.competition.programLegacies],
  );

  const socialTeams = useMemo(
    () => world.social.teamCultures
      .map((culture) => ({ culture, team: world.teams.find((team) => team.id === culture.teamId) }))
      .filter((item): item is { culture: (typeof world.social.teamCultures)[number]; team: EcosystemTeam } => Boolean(item.team))
      .sort((left, right) =>
        Number(right.team.id === heroProgramId) - Number(left.team.id === heroProgramId)
        || right.culture.conflict - left.culture.conflict
        || left.culture.cohesion - right.culture.cohesion,
      ),
    [world.social.teamCultures, world.teams, heroProgramId],
  );
  const recentSocialIncidents = useMemo(
    () => [...world.social.incidents]
      .sort((left, right) => right.seasonYear - left.seasonYear || right.week - left.week)
      .slice(0, 10),
    [world.social.incidents],
  );
  const activeSocialBonds = world.social.bonds.filter((bond) => bond.active);
  const strainedSocialBonds = activeSocialBonds.filter((bond) => bond.tension >= 70);

  const normalizedQuery = query.trim().toLowerCase();
  const searchTeams = normalizedQuery
    ? world.teams.filter((team) => `${team.name} ${team.shortName} ${team.stateCode}`.toLowerCase().includes(normalizedQuery)).slice(0, 6)
    : [];
  const searchPlayers = normalizedQuery
    ? world.players.filter((player) => `${player.name} ${player.position} ${player.classYear}`.toLowerCase().includes(normalizedQuery)).slice(0, 6)
    : [];
  const searchStories = normalizedQuery
    ? stories.filter((story) => `${story.title} ${story.detail}`.toLowerCase().includes(normalizedQuery)).slice(0, 4)
    : [];

  const topProspects = useMemo(
    () => world.players
      .filter((player) => player.level === "high-school")
      .sort((left, right) => right.talent.scoutingGrade - left.talent.scoutingGrade || right.potential - left.potential)
      .slice(0, 10),
    [world.players],
  );
  const talentRegions = useMemo(
    () => world.talentPipeline.regions
      .map((region) => ({
        region,
        prospects: world.players.filter((player) => player.level === "high-school" && player.talent.regionId === region.id),
      }))
      .sort((left, right) => right.prospects.length - left.prospects.length || right.region.footballCulture - left.region.footballCulture),
    [world.players, world.talentPipeline.regions],
  );

  function conferenceStandings(conference: EcosystemConference) {
    return conference.teamIds
      .map((id) => world.teams.find((team) => team.id === id))
      .filter((team): team is NonNullable<typeof team> => Boolean(team))
      .sort((left, right) => right.conferenceWins - left.conferenceWins || left.conferenceLosses - right.conferenceLosses || right.rating - left.rating);
  }

  return (
    <div className="compact-section world-dashboard">
      <header className="compact-page-head world-head">
        <div><span>Autonomous football world</span><h2>Экосистема</h2></div>
        <strong className="compact-head-score">{world.seasonYear}</strong>
      </header>

      <div className="world-command-bar">
        <label className="world-search">
          <Icon name="search" size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Команда, игрок, событие" aria-label="Поиск по миру" />
          {query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery("")}><Icon name="close" size={14} /></button>}
        </label>
        <SectionTabs<WorldPrimaryView>
          tabs={primaryViews}
          active={primaryView}
          onChange={(next) => { setPrimaryView(next); if (next !== "explore") setDetailView(undefined); }}
          ariaLabel="Основные разделы мира"
        />
      </div>

      {normalizedQuery && (
        <section className="world-search-results" aria-live="polite">
          <header><small>Быстрый поиск</small><strong>{searchTeams.length + searchPlayers.length + searchStories.length} совпадений</strong></header>
          <div>
            {searchTeams.map((team) => (
              <button key={team.id} type="button" onClick={() => setSelectedTeam(team)}>
                <span>{team.shortName.slice(0, 2)}</span><div><strong>{team.shortName}</strong><small>{team.name} · {team.stateCode}</small></div><em>{Math.round(team.rating)}</em>
              </button>
            ))}
            {searchPlayers.map((player) => (
              <button key={player.id} type="button" onClick={() => setSelectedPlayer(player)}>
                <span>{player.position}</span><div><strong>{player.name}</strong><small>{player.classYear} · {player.level === "college" ? "College" : "High school"}</small></div><em>{Math.round(player.overall)}</em>
              </button>
            ))}
            {searchStories.map((story) => (
              <button key={story.id} type="button" onClick={() => setSelectedStory(story)}>
                <span><Icon name="pulse" size={15} /></span><div><strong>{story.title}</strong><small>{storyKindLabel(story.kind)}</small></div><em>{story.importance}</em>
              </button>
            ))}
            {searchTeams.length + searchPlayers.length + searchStories.length === 0 && <p>Ничего не найдено. Попробуй название программы, штат или событие.</p>}
          </div>
        </section>
      )}

      {!normalizedQuery && primaryView === "explore" && !detailView && (
        <div className="world-explore-grid">
          {exploreItems.map((item) => (
            <button key={item.id} type="button" onClick={() => setDetailView(item.id)}>
              <span><Icon name={item.icon} /></span>
              <div><strong>{item.label}</strong><small>{item.detail}</small></div>
              <Icon name="arrow-right" size={16} />
            </button>
          ))}
        </div>
      )}

      {!normalizedQuery && primaryView === "explore" && detailView && (
        <div className="world-detail-head">
          <button type="button" className="icon-button icon-button--quiet" onClick={() => setDetailView(undefined)} aria-label="К обзору мира"><Icon name="arrow-left" /></button>
          <div><small>Обзор мира</small><strong>{exploreItems.find((item) => item.id === detailView)?.label}</strong></div>
        </div>
      )}

      {!normalizedQuery && primaryView === "feed" && (
        <div className="compact-view world-pulse">
          <section className="world-cycle-card">
            <div><small>{phaseLabel(world.phase)}</small><h3>Неделя {world.seasonWeek}</h3></div>
            <span>{world.conferences.length} конференции</span>
          </section>

          <section className="world-market-strip world-market-strip--four">
            <span><small>Коммиты</small><strong>{world.market.committedPlayers}</strong></span>
            <span><small>Портал</small><strong>{world.market.portalPlayers}</strong></span>
            <span><small>Горячие штабы</small><strong>{world.market.coachingHotSeats}</strong></span>
            <span><small>Сезонов в истории</small><strong>{historyYears.length}</strong></span>
          </section>

          <section className="world-digest-card">
            <header><Icon name="pulse" /><div><small>Что изменилось без тебя</small><h3>Мир продолжил движение</h3></div></header>
            <div>{world.digest.map((item) => <p key={item}>{item}</p>)}</div>
          </section>

          <div className="world-story-list">
            {stories.slice(0, 5).map((item) => (
              <button key={item.id} type="button" className={item.relatedToHero ? "is-relevant" : ""} onClick={() => setSelectedStory(item)}>
                <span className={`world-story-kind world-story-kind--${item.kind}`}>{storyKindLabel(item.kind)}</span>
                <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                <em>{item.importance}</em>
              </button>
            ))}
            {stories.length === 0 && <div className="compact-note"><Icon name="clock" /><p>Мир только запущен. Первые изменения появятся после игровых недель.</p></div>}
          </div>
        </div>
      )}

      {!normalizedQuery && primaryView === "explore" && detailView === "leagues" && (
        <div className="compact-view">
          <section className="world-context-card">
            <small>Реальные соревнования</small><h3>Команды играют друг против друга</h3>
            <p>Победа одной программы означает поражение другой. Таблицы, давление и титулы строятся из этих матчей.</p>
          </section>
          <div className="conference-grid">
            {world.conferences.map((conference) => {
              const standings = conferenceStandings(conference);
              const leader = standings[0];
              const champion = conference.champions.at(-1);
              const championTeam = champion ? world.teams.find((team) => team.id === champion.teamId) : undefined;
              return (
                <button key={conference.id} type="button" onClick={() => setSelectedConference(conference)}>
                  <header><span>{conference.shortName}</span><em>{conference.region}</em></header>
                  <h3>{conference.name}</h3>
                  <div className="conference-leader">
                    <small>{world.phase === "offseason" ? "Последний чемпион" : "Лидер"}</small>
                    <strong>{world.phase === "offseason" ? championTeam?.shortName ?? "—" : leader?.shortName ?? "—"}</strong>
                    <span>{leader ? `${leader.conferenceWins}–${leader.conferenceLosses}` : ""}</span>
                  </div>
                  <footer><span>{conference.teamIds.length} программ</span><strong>AVG {Math.round(conference.prestige)}</strong></footer>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!normalizedQuery && primaryView === "rankings" && (
        <div className="compact-view competition-view">
          <section className="world-market-strip world-market-strip--four">
            <span><small>#1</small><strong>{nationalRankings[0] ? world.teams.find((team) => team.id === nationalRankings[0]?.teamId)?.shortName ?? "—" : "—"}</strong></span>
            <span><small>Этап</small><strong>{world.competition.playoff.stage === "regular-season" ? `W${world.seasonWeek}` : world.competition.playoff.stage}</strong></span>
            <span><small>Плей-офф</small><strong>{world.competition.playoff.seedTeamIds.length || 8}</strong></span>
            <span><small>Награды</small><strong>{currentAwards.length}</strong></span>
          </section>

          <section className="world-context-card">
            <small>Национальная система</small><h3>Результаты меняют весь мир</h3>
            <p>Рейтинг учитывает победы, силу расписания, качественные победы, выездные матчи и разницу очков. Титулы меняют престиж, бюджеты и рынок.</p>
          </section>

          <section className="competition-ranking-card">
            <header><small>National Top 12</small><h3>Рейтинг</h3></header>
            <div>
              {nationalRankings.map((ranking) => {
                const team = world.teams.find((item) => item.id === ranking.teamId);
                const movement = ranking.previousRank ? ranking.previousRank - ranking.rank : 0;
                return (
                  <button key={ranking.teamId} type="button" className={team?.id === heroProgramId ? "is-hero" : ""} onClick={() => team && setSelectedTeam(team)}>
                    <span>{ranking.rank}</span>
                    <div><strong>{team?.shortName ?? ranking.teamId}</strong><small>{team?.wins ?? 0}–{team?.losses ?? 0} · SOS {Math.round(ranking.strengthOfSchedule)} · QW {ranking.qualityWins}</small></div>
                    <em>{movement > 0 ? `+${movement}` : movement < 0 ? movement : "—"}</em>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="competition-split-grid">
            <section className="competition-results-card">
              <header><small>Последние матчи</small><h3>Результаты</h3></header>
              {recentCompetitionGames.map((game) => {
                const home = world.teams.find((team) => team.id === game.homeTeamId);
                const away = world.teams.find((team) => team.id === game.awayTeamId);
                return <article key={game.id}><span>{game.kind === "rivalry" ? "RIV" : game.kind === "playoff" ? "PO" : `W${game.week}`}</span><div><strong>{away?.shortName ?? game.awayTeamId} {game.awayScore} — {game.homeScore} {home?.shortName ?? game.homeTeamId}</strong><small>{game.upset ? "Сенсация · " : ""}{game.neutralSite ? "нейтральное поле" : "дом/выезд"}</small></div></article>;
              })}
              {recentCompetitionGames.length === 0 && <div className="compact-note"><Icon name="clock" /><p>Первый тур ещё не сыгран.</p></div>}
            </section>

            <section className="competition-awards-card">
              <header><small>Признание</small><h3>Награды</h3></header>
              {currentAwards.slice(0, 6).map((award) => {
                const player = world.players.find((item) => item.id === award.playerId);
                return <article key={award.id}><span>{player?.position ?? "★"}</span><div><strong>{award.title}</strong><small>{award.detail}</small></div></article>;
              })}
              {currentAwards.length === 0 && <div className="compact-note"><Icon name="spark" /><p>Награды появятся после первых игровых недель.</p></div>}
            </section>
          </div>

          <section className="competition-legacy-card">
            <header><small>Историческая репутация</small><h3>Эпохи программ</h3></header>
            <div>{legacyPrograms.map((legacy) => {
              const team = world.teams.find((item) => item.id === legacy.teamId);
              return <button key={legacy.teamId} type="button" onClick={() => team && setSelectedTeam(team)}><strong>{team?.shortName ?? legacy.teamId}</strong><span>{legacy.eraLabel}</span><small>{legacy.allTimeWins}–{legacy.allTimeLosses} · титулы {legacy.nationalTitles} · best #{legacy.bestRank}</small><em>{Math.round(legacy.reputation)}</em></button>;
            })}</div>
          </section>
        </div>
      )}

      {!normalizedQuery && primaryView === "explore" && detailView === "moves" && (
        <div className="compact-view">
          <section className="world-context-card">
            <small>Трансферы и штабы</small><h3>Места никогда не закреплены навсегда</h3>
            <p>Игроки уходят из глубоких позиционных комнат, координаторы получают повышения, а увольнения ломают старые обещания.</p>
          </section>
          <div className="world-transaction-list">
            {transactions.map((transaction) => (
              <article key={transaction.id} className={transaction.relatedToHero ? "is-relevant" : ""}>
                <span>{transactionLabel(transaction.kind)}</span>
                <div><strong>{transaction.title}</strong><small>{transaction.detail}</small></div>
                <em>{transaction.seasonYear}</em>
              </article>
            ))}
            {transactions.length === 0 && <div className="compact-note"><Icon name="swap" /><p>Первые переходы и назначения происходят в межсезонье.</p></div>}
          </div>
        </div>
      )}

      {!normalizedQuery && primaryView === "explore" && detailView === "market" && (
        <div className="compact-view">
          <section className="world-market-strip world-market-strip--four">
            <span><small>Переговоры</small><strong>{world.market.activeNegotiations}</strong></span>
            <span><small>Отозвано</small><strong>{world.market.withdrawnOffers}</strong></span>
            <span><small>Трансферы</small><strong>{world.market.transferCandidates}</strong></span>
            <span><small>Вакансии штабов</small><strong>{openVacancies.length}</strong></span>
          </section>

          <section className="world-context-card">
            <small>Единый рынок движения</small><h3>Все кандидаты борются за одни места</h3>
            <p>Школьники, JUCO, walk-on и трансферы используют общие вакансии, стипендии, NIL и бюджет набора. Один переход может закрыть оффер другому игроку.</p>
          </section>

          <div className="world-transaction-list">
            {marketNegotiations.map((negotiation) => {
              const team = world.teams.find((item) => item.id === negotiation.teamId);
              return (
                <button
                  key={negotiation.id}
                  type="button"
                  className={team?.id === heroProgramId ? "is-relevant" : ""}
                  onClick={() => team && setSelectedTeam(team)}
                >
                  <span>{negotiation.status}</span>
                  <div><strong>{negotiation.candidateName} · {team?.shortName ?? negotiation.teamId}</strong><small>{negotiation.position} · {negotiation.candidateKind} · {negotiation.promisedRole} · {negotiation.reason}</small></div>
                  <em>{Math.round(negotiation.score)}</em>
                </button>
              );
            })}
            {marketNegotiations.length === 0 && <div className="compact-note"><Icon name="swap" /><p>Рынок только открылся. Переговоры появятся после следующей недельной симуляции.</p></div>}
          </div>

          {openVacancies.length > 0 && (
            <section className="independent-route-list">
              <header><small>Тренерский рынок</small><h3>Открытые вакансии</h3></header>
              {openVacancies.slice(0, 5).map((vacancy) => {
                const team = world.teams.find((item) => item.id === vacancy.teamId);
                return <article key={vacancy.id}><span>HC</span><div><strong>{team?.name ?? vacancy.teamId}</strong><small>${vacancy.salaryBudget.toFixed(1)}M · {vacancy.reason}</small></div></article>;
              })}
            </section>
          )}
        </div>
      )}

      {!normalizedQuery && primaryView === "explore" && detailView === "resources" && (
        <div className="compact-view">
          <section className="world-market-strip world-market-strip--four">
            <span><small>Рекрутинг</small><strong>${Math.round(world.market.totalRecruitingBudget)}M</strong></span>
            <span><small>NIL-ёмкость</small><strong>${Math.round(world.market.totalNilCapacity)}M</strong></span>
            <span><small>Под давлением</small><strong>{world.market.programsUnderFinancialPressure}</strong></span>
            <span><small>Свободные места</small><strong>{world.market.openScholarships}</strong></span>
          </section>

          <section className="world-context-card">
            <small>Ограниченные ресурсы</small><h3>Деньги меняют решения программ</h3>
            <p>Бюджет набора, NIL, медицина, база и зарплаты штаба теперь конечны. Сильная программа может проиграть рынок из-за перегретых расходов или финансового давления.</p>
          </section>

          <div className="resource-team-list">
            {resourceTeams.slice(0, 12).map((team) => (
              <button
                key={team.id}
                type="button"
                className={team.id === heroProgramId ? "is-hero" : team.resources.financialPressure >= 68 ? "is-pressure" : ""}
                onClick={() => setSelectedTeam(team)}
              >
                <div>
                  <strong>{team.shortName}</strong>
                  <small>{team.resources.tier} · {team.resources.spendingPriority}</small>
                </div>
                <span><small>Бюджет</small><strong>${team.resources.annualBudget.toFixed(1)}M</strong></span>
                <span><small>NIL</small><strong>${team.resources.nilCapacity.toFixed(1)}M</strong></span>
                <em>{Math.round(team.resources.financialPressure)}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      {!normalizedQuery && primaryView === "explore" && detailView === "plans" && (
        <div className="compact-view">
          <section className="world-market-strip world-market-strip--four">
            <span><small>Мест в классах</small><strong>{world.market.plannedClassSpots}</strong></span>
            <span><small>Развитие</small><strong>{world.market.developmentalPlayers}</strong></span>
            <span><small>Смены позиций</small><strong>{world.market.plannedPositionChanges}</strong></span>
            <span><small>Горизонт</small><strong>3Y</strong></span>
          </section>

          <section className="world-context-card">
            <small>Многолетний AI состава</small><h3>Штабы планируют будущие дыры</h3>
            <p>Выпуски, eligibility, удержание, стипендии и глубина позиций формируют набор до того, как место реально освободится.</p>
          </section>

          <div className="roster-plan-list">
            {rosterTeams.slice(0, 12).map((team) => {
              const urgent = Object.values(team.rosterPlan.positionProjections)
                .sort((left, right) => right.needNextYear - left.needNextYear)[0];
              return (
                <button
                  key={team.id}
                  type="button"
                  className={team.id === heroProgramId ? "is-hero" : team.rosterPlan.retentionRisk >= 65 ? "is-risk" : ""}
                  onClick={() => setSelectedTeam(team)}
                >
                  <div><strong>{team.shortName}</strong><small>{rosterStrategyLabel(team.rosterPlan.strategy)}</small></div>
                  <span><small>Класс</small><strong>{team.rosterPlan.targetClassSize}</strong></span>
                  <span><small>Уходят</small><strong>{team.rosterPlan.projectedDepartures}</strong></span>
                  <span><small>Дыра</small><strong>{urgent?.position ?? "—"}</strong></span>
                  <em>{Math.round(team.rosterPlan.retentionRisk)}</em>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!normalizedQuery && primaryView === "explore" && detailView === "tactics" && (
        <div className="compact-view">
          <section className="world-market-strip world-market-strip--four">
            <span><small>Освоение</small><strong>{averageInstallation}</strong></span>
            <span><small>Новые системы</small><strong>{world.market.programsInstallingNewSystems}</strong></span>
            <span><small>Плохой fit</small><strong>{world.market.lowSchemeFitPlayers}</strong></span>
            <span><small>Playbooks</small><strong>{tacticalTeams.length}</strong></span>
          </section>

          <section className="world-context-card">
            <small>Тактическая идентичность</small><h3>Игрок ценен внутри конкретной системы</h3>
            <p>Схема определяет роли, развитие, depth chart и набор. После смены штаба освоение playbook падает, а часть состава перестаёт подходить новым требованиям.</p>
          </section>

          <div className="resource-team-list tactical-team-list">
            {tacticalTeams.slice(0, 12).map((team) => {
              const teamPlayers = world.players.filter((player) => player.teamId === team.id);
              const averageFit = teamPlayers.length > 0 ? Math.round(teamPlayers.reduce((sum, player) => sum + player.tactical.schemeFit, 0) / teamPlayers.length) : 0;
              return (
                <button key={team.id} type="button" className={team.id === heroProgramId ? "is-hero" : team.tactical.installation < 55 ? "is-pressure" : ""} onClick={() => setSelectedTeam(team)}>
                  <div><strong>{team.shortName}</strong><small>{offenseSystemLabel(team.tactical.offenseSystem)} · {defenseSystemLabel(team.tactical.defenseSystem)}</small></div>
                  <span><small>Освоение</small><strong>{Math.round(team.tactical.installation)}</strong></span>
                  <span><small>Fit</small><strong>{averageFit}</strong></span>
                  <em>{Math.round(team.tactical.continuity)}</em>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!normalizedQuery && primaryView === "explore" && detailView === "social" && (
        <div className="compact-view social-view">
          <section className="world-market-strip world-market-strip--four">
            <span><small>Связи</small><strong>{activeSocialBonds.length}</strong></span>
            <span><small>Наставники</small><strong>{activeSocialBonds.filter((bond) => bond.kind === "mentor" && bond.trust >= 65).length}</strong></span>
            <span><small>Острые конфликты</small><strong>{strainedSocialBonds.length}</strong></span>
            <span><small>Расколотые команды</small><strong>{world.social.teamCultures.filter((culture) => culture.conflict >= 65).length}</strong></span>
          </section>

          <section className="world-context-card">
            <small>Социальная экосистема</small><h3>Раздевалка влияет на карьеру</h3>
            <p>Доверие, конкуренция, наставничество и конфликты меняют форму, развитие, удержание игроков, работу штаба и результат матчей.</p>
          </section>

          <div className="resource-team-list social-team-list">
            {socialTeams.slice(0, 12).map(({ team, culture }) => (
              <button key={team.id} type="button" className={team.id === heroProgramId ? "is-hero" : culture.conflict >= 65 ? "is-pressure" : ""} onClick={() => setSelectedTeam(team)}>
                <div><strong>{team.shortName}</strong><small>{culture.conflict >= 65 ? "Раздевалка расколота" : culture.cohesion >= 70 ? "Сильная группа" : "Нестабильный баланс"}</small></div>
                <span><small>Сплочённость</small><strong>{Math.round(culture.cohesion)}</strong></span>
                <span><small>Доверие штабу</small><strong>{Math.round(culture.coachTrust)}</strong></span>
                <em>{Math.round(culture.conflict)}</em>
              </button>
            ))}
          </div>

          <div className="world-transaction-list social-incident-list">
            {recentSocialIncidents.map((incident) => {
              const team = world.teams.find((item) => item.id === incident.teamId);
              return (
                <article key={incident.id}>
                  <span>{storyKindLabel(incident.kind)}</span>
                  <div><strong>{incident.title}</strong><small>{incident.detail}</small></div>
                  <em>{team?.shortName ?? incident.teamId}</em>
                </article>
              );
            })}
            {recentSocialIncidents.length === 0 && <div className="compact-note"><Icon name="pulse" /><p>Первые конфликты, наставничество и лидерские эпизоды появятся по ходу сезона.</p></div>}
          </div>
        </div>
      )}

      {!normalizedQuery && primaryView === "explore" && detailView === "talent" && (
        <div className="compact-view">
          <section className="world-market-strip world-market-strip--four">
            <span><small>Школьники</small><strong>{world.market.annualProspects}</strong></span>
            <span><small>JUCO</small><strong>{world.market.jucoProspects}</strong></span>
            <span><small>Walk-on</small><strong>{world.market.walkOnProspects}</strong></span>
            <span><small>Национальный уровень</small><strong>{world.market.nationallyExposedProspects}</strong></span>
          </section>

          <section className="world-context-card">
            <small>Ежегодный поток</small><h3>Новые поколения не создаются из воздуха</h3>
            <p>Регион, инфраструктура, лагеря, физическая зрелость и доступ к скаутам определяют, кого заметят рано, кто раскроется поздно и кто продолжит путь через JUCO или walk-on.</p>
          </section>

          <div className="talent-prospect-list">
            {topProspects.slice(0, 6).map((player, index) => (
              <article key={player.id}>
                <span>{index + 1}</span>
                <div><strong>{player.name}</strong><small>{player.position} · {player.talent.homeState} · {player.talent.route}</small></div>
                <em>{Math.round(player.talent.scoutingGrade)}</em>
              </article>
            ))}
          </div>

          <div className="talent-region-grid">
            {talentRegions.slice(0, 8).map(({ region, prospects }) => (
              <article key={region.id}>
                <header><strong>{region.name}</strong><span>{prospects.length}</span></header>
                <div><small>Культура</small><b>{Math.round(region.footballCulture)}</b></div>
                <div><small>Инфраструктура</small><b>{Math.round(region.infrastructure)}</b></div>
                <div><small>Экспозиция</small><b>{Math.round(region.exposureBias)}</b></div>
              </article>
            ))}
          </div>

          {world.talentPipeline.independentProspects.length > 0 && (
            <section className="independent-route-list">
              <header><small>Альтернативные маршруты</small><h3>Карьера не заканчивается после школы</h3></header>
              {world.talentPipeline.independentProspects.slice(0, 6).map((prospect) => (
                <article key={prospect.id}>
                  <span>{prospect.route === "juco" ? "JUCO" : "WALK-ON"}</span>
                  <div><strong>{prospect.name}</strong><small>{prospect.position} · OVR {Math.round(prospect.overall)} · {prospect.status}</small></div>
                </article>
              ))}
            </section>
          )}
        </div>
      )}

      {!normalizedQuery && primaryView === "explore" && detailView === "history" && (
        <div className="compact-view">
          <section className="world-context-card">
            <small>Непрерывная история</small><h3>Сезоны не исчезают после финала</h3>
            <p>Составы, тренеры и престиж меняются, но каждый итог остаётся в истории мира.</p>
          </section>
          <div className="world-history-list">
            {historyYears.map((year) => {
              const records = world.teamHistory.filter((record) => record.seasonYear === year);
              const champions = records.filter((record) => record.conferenceChampion);
              const heroRecord = heroProgramId ? records.find((record) => record.teamId === heroProgramId) : undefined;
              return (
                <article key={year}>
                  <header><strong>{year}</strong><span>{records.length} программ</span></header>
                  <div>
                    {champions.slice(0, 4).map((record) => {
                      const team = world.teams.find((item) => item.id === record.teamId);
                      const conference = world.conferences.find((item) => item.id === record.conferenceId);
                      return <span key={record.id}><small>{conference?.shortName}</small><strong>{team?.shortName ?? record.teamId}</strong></span>;
                    })}
                  </div>
                  {heroRecord && <footer>Твоя программа: {heroRecord.wins}–{heroRecord.losses}, место #{heroRecord.finish}</footer>}
                </article>
              );
            })}
            {historyYears.length === 0 && <div className="compact-note"><Icon name="history" /><p>Первый сезон ещё не архивирован. История появится после межсезонья.</p></div>}
          </div>
        </div>
      )}

      <BottomSheet
        open={Boolean(selectedStory)}
        title={selectedStory?.title ?? "Событие мира"}
        {...(selectedStory ? { eyebrow: `${storyKindLabel(selectedStory.kind)} · важность ${selectedStory.importance}` } : {})}
        onClose={() => setSelectedStory(undefined)}
      >
        {selectedStory && (
          <div className="world-story-sheet">
            <p>{selectedStory.detail}</p>
            <div className="info-list info-list--compact">
              <span><small>Неделя</small><strong>{selectedStory.week}</strong></span>
              <span><small>Связь с карьерой</small><strong>{selectedStory.relatedToHero ? "Прямая" : "Косвенная"}</strong></span>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={Boolean(selectedPlayer)}
        title={selectedPlayer?.name ?? "Игрок"}
        {...(selectedPlayer ? { eyebrow: `${selectedPlayer.position} · ${selectedPlayer.classYear}` } : {})}
        onClose={() => setSelectedPlayer(undefined)}
      >
        {selectedPlayer && (
          <div className="player-world-sheet">
            <section className="world-market-strip world-market-strip--four">
              <span><small>OVR</small><strong>{Math.round(selectedPlayer.overall)}</strong></span>
              <span><small>Потенциал</small><strong>{Math.round(selectedPlayer.potential)}</strong></span>
              <span><small>Форма</small><strong>{Math.round(selectedPlayer.form)}</strong></span>
              <span><small>Здоровье</small><strong>{Math.round(selectedPlayer.health)}</strong></span>
            </section>
            <div className="info-list info-list--compact">
              <span><small>Статус</small><strong>{selectedPlayer.status}</strong></span>
              <span><small>Depth</small><strong>#{selectedPlayer.depthRank}</strong></span>
              <span><small>Scheme fit</small><strong>{Math.round(selectedPlayer.tactical.schemeFit)}</strong></span>
              <span><small>Траектория</small><strong>{selectedPlayer.trajectory}</strong></span>
              <span><small>Рекрутинг</small><strong>{selectedPlayer.recruitingStage}</strong></span>
              <span><small>Трансфер</small><strong>{selectedPlayer.transferStatus}</strong></span>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={Boolean(selectedTeam)}
        title={selectedTeam?.name ?? "Ресурсы программы"}
        {...(selectedTeam ? { eyebrow: `${selectedTeam.resources.tier} · приоритет: ${selectedTeam.resources.spendingPriority}` } : {})}
        onClose={() => setSelectedTeam(undefined)}
      >
        {selectedTeam && (
          <div className="resource-team-sheet">
            <section className="world-market-strip world-market-strip--four">
              <span><small>Годовой бюджет</small><strong>${selectedTeam.resources.annualBudget.toFixed(1)}M</strong></span>
              <span><small>Рекрутинг</small><strong>${selectedTeam.resources.recruitingBudget.toFixed(1)}M</strong></span>
              <span><small>Медицина</small><strong>{Math.round(selectedTeam.resources.medicalLevel)}</strong></span>
              <span><small>База</small><strong>{Math.round(selectedTeam.resources.facilitiesLevel)}</strong></span>
            </section>
            <div className="info-list info-list--compact">
              <span><small>NIL доступно</small><strong>${Math.max(0, selectedTeam.resources.nilCapacity - selectedTeam.resources.nilCommitted).toFixed(1)}M</strong></span>
              <span><small>Бюджет набора доступен</small><strong>${Math.max(0, selectedTeam.resources.recruitingBudget - selectedTeam.resources.recruitingCommitted).toFixed(1)}M</strong></span>
              <span><small>Доверие доноров</small><strong>{Math.round(selectedTeam.resources.donorConfidence)}</strong></span>
              <span><small>Терпение руководства</small><strong>{Math.round(selectedTeam.resources.boardPatience)}</strong></span>
              <span><small>Финансовое давление</small><strong>{Math.round(selectedTeam.resources.financialPressure)}</strong></span>
              <span><small>Текущий баланс</small><strong>${selectedTeam.resources.currentBalance.toFixed(1)}M</strong></span>
            </div>
            {world.social.teamCultures.find((culture) => culture.teamId === selectedTeam.id) && (
              <section className="roster-plan-sheet social-team-sheet">
                {(() => {
                  const culture = world.social.teamCultures.find((item) => item.teamId === selectedTeam.id);
                  if (!culture) return null;
                  const teamBonds = world.social.bonds.filter((bond) => bond.active && bond.teamId === selectedTeam.id);
                  return (
                    <>
                      <header><small>Раздевалка</small><h3>{culture.conflict >= 65 ? "Внутренний кризис" : culture.cohesion >= 70 ? "Сильная группа" : "Рабочая, но нестабильная среда"}</h3><p>{teamBonds.filter((bond) => bond.tension >= 70).length} острых связей · {teamBonds.filter((bond) => bond.kind === "mentor").length} наставнических пар</p></header>
                      <div className="info-list info-list--compact">
                        <span><small>Сплочённость</small><strong>{Math.round(culture.cohesion)}</strong></span>
                        <span><small>Мораль</small><strong>{Math.round(culture.morale)}</strong></span>
                        <span><small>Лидерство</small><strong>{Math.round(culture.leadership)}</strong></span>
                        <span><small>Доверие штабу</small><strong>{Math.round(culture.coachTrust)}</strong></span>
                        <span><small>Конфликт</small><strong>{Math.round(culture.conflict)}</strong></span>
                        <span><small>Стабильность</small><strong>{Math.round(culture.stability)}</strong></span>
                      </div>
                    </>
                  );
                })()}
              </section>
            )}
            <section className="roster-plan-sheet tactical-sheet">
              <header><small>Тактическая система</small><h3>{offenseSystemLabel(selectedTeam.tactical.offenseSystem)} / {defenseSystemLabel(selectedTeam.tactical.defenseSystem)}</h3><p>{selectedTeam.offenseStyle} · {selectedTeam.defenseStyle}</p></header>
              <div className="info-list info-list--compact">
                <span><small>Освоение playbook</small><strong>{Math.round(selectedTeam.tactical.installation)}</strong></span>
                <span><small>Преемственность</small><strong>{Math.round(selectedTeam.tactical.continuity)}</strong></span>
                <span><small>Сложность</small><strong>{Math.round(selectedTeam.tactical.complexity)}</strong></span>
                <span><small>Глубина ротации</small><strong>{Math.round(selectedTeam.tactical.rotationDepth)}</strong></span>
                <span><small>Темп</small><strong>{selectedTeam.tactical.tempo === "fast" ? "Высокий" : selectedTeam.tactical.tempo === "controlled" ? "Контроль" : "Баланс"}</strong></span>
                <span><small>Агрессия</small><strong>{selectedTeam.tactical.offensiveAggression === "aggressive" ? "Высокая" : selectedTeam.tactical.offensiveAggression === "conservative" ? "Осторожная" : "Средняя"}</strong></span>
              </div>
              <div className="roster-position-grid">
                {Object.entries(selectedTeam.tactical.positionRoles).map(([position, roles]) => (
                  <article key={position}><strong>{position}</strong><span><small>Главная роль</small><b>{positionRoleLabel(roles.primary)}</b></span><span><small>Вторая</small><b>{positionRoleLabel(roles.secondary)}</b></span></article>
                ))}
              </div>
            </section>

            <section className="roster-plan-sheet">
              <header><small>План состава · {selectedTeam.rosterPlan.seasonYear}</small><h3>{rosterStrategyLabel(selectedTeam.rosterPlan.strategy)}</h3><p>{selectedTeam.rosterPlan.lastReviewReason}</p></header>
              <div className="info-list info-list--compact">
                <span><small>Целевой класс</small><strong>{selectedTeam.rosterPlan.targetClassSize}</strong></span>
                <span><small>Свободные места</small><strong>{selectedTeam.rosterPlan.availableRosterSpots}</strong></span>
                <span><small>Свободные стипендии</small><strong>{selectedTeam.rosterPlan.availableScholarships}</strong></span>
                <span><small>Ожидаемые уходы</small><strong>{selectedTeam.rosterPlan.projectedDepartures}</strong></span>
                <span><small>Developmental</small><strong>{usageCount(selectedTeam)}</strong></span>
                <span><small>Риск удержания</small><strong>{Math.round(selectedTeam.rosterPlan.retentionRisk)}</strong></span>
              </div>
              <div className="roster-position-grid">
                {Object.values(selectedTeam.rosterPlan.positionProjections).map((projection) => (
                  <article key={projection.position}>
                    <strong>{projection.position}</strong>
                    <span><small>Сейчас</small><b>{projection.currentPlayers}</b></span>
                    <span><small>Вернутся</small><b>{projection.returningNextYear}</b></span>
                    <span><small>Нужно</small><b>{projection.targetAdds}</b></span>
                    <em>{Math.round(projection.needNextYear)}</em>
                  </article>
                ))}
              </div>
              {(selectedTeam.rosterPlan.positionChanges.length > 0 || selectedTeam.rosterPlan.scholarshipDecisions.length > 0) && (
                <div className="roster-decision-list">
                  {selectedTeam.rosterPlan.positionChanges.map((change) => <p key={`${change.playerId}:${change.toPosition}`}><strong>{change.fromPosition} → {change.toPosition}</strong>{change.reason}</p>)}
                  {selectedTeam.rosterPlan.scholarshipDecisions.map((decision) => <p key={decision.playerId}><strong>{decision.previousStatus} → {decision.nextStatus}</strong>{decision.reason}</p>)}
                </div>
              )}
            </section>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={Boolean(selectedConference)}
        title={selectedConference?.name ?? "Конференция"}
        {...(selectedConference ? { eyebrow: `${selectedConference.shortName} · ${selectedConference.region}` } : {})}
        onClose={() => setSelectedConference(undefined)}
      >
        {selectedConference && (
          <div className="conference-sheet">
            {conferenceStandings(selectedConference).map((team, index) => (
              <article key={team.id} className={team.id === heroProgramId ? "is-hero" : ""}>
                <span>{index + 1}</span>
                <div><strong>{team.name}</strong><small>OVR {Math.round(team.rating)} · {team.trend}</small></div>
                <em>{team.conferenceWins}–{team.conferenceLosses}</em>
              </article>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
