import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type {
  EcosystemConference,
  EcosystemStory,
  EcosystemTeam,
  EcosystemTransaction,
  FootballEcosystemState,
} from "../../sports/football/ecosystem/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { SectionTabs } from "../ui/SectionTabs";

const views = [
  { id: "pulse", label: "Пульс" },
  { id: "leagues", label: "Лиги" },
  { id: "moves", label: "Движение" },
  { id: "resources", label: "Ресурсы" },
  { id: "plans", label: "Составы" },
  { id: "talent", label: "Таланты" },
  { id: "history", label: "История" },
] as const;

type WorldView = (typeof views)[number]["id"];

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
  }[kind];
}

function phaseLabel(phase: FootballEcosystemState["phase"]): string {
  return phase === "regular-season" ? "Регулярный сезон" : phase === "postseason" ? "Финалы конференций" : "Межсезонье";
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
  const [view, setView] = useState<WorldView>("pulse");
  const [selectedStory, setSelectedStory] = useState<EcosystemStory>();
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

      <SectionTabs<WorldView> tabs={views} active={view} onChange={setView} ariaLabel="Разделы спортивного мира" />

      {view === "pulse" && (
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

      {view === "leagues" && (
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

      {view === "moves" && (
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

      {view === "resources" && (
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

      {view === "plans" && (
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

      {view === "talent" && (
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

      {view === "history" && (
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
