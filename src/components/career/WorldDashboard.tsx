import { useMemo, useState } from "react";
import type { FootballCareerState } from "../../sports/football/career/types";
import type {
  EcosystemConference,
  EcosystemStory,
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
  }[kind];
}

interface WorldDashboardSave {
  world: FootballEcosystemState;
  football: FootballCareerState;
}

export function WorldDashboard({ save }: { save: WorldDashboardSave }) {
  const [view, setView] = useState<WorldView>("pulse");
  const [selectedStory, setSelectedStory] = useState<EcosystemStory>();
  const [selectedConference, setSelectedConference] = useState<EcosystemConference>();
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
