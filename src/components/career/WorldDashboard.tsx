import { useMemo, useState } from "react";
import type { FootballCareerState } from "../../sports/football/career/types";
import type { FootballEcosystemState } from "../../sports/football/ecosystem/types";
import type { EcosystemStory } from "../../sports/football/ecosystem/types";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { SectionTabs } from "../ui/SectionTabs";

const views = [
  { id: "pulse", label: "Пульс" },
  { id: "players", label: "Игроки" },
  { id: "programs", label: "Команды" },
  { id: "coaches", label: "Тренеры" },
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
  }[kind];
}

function trajectoryLabel(value: "surging" | "steady" | "slipping"): string {
  return value === "surging" ? "Растёт" : value === "slipping" ? "Сдаёт" : "Стабильно";
}

function coachStatusLabel(value: "secure" | "watched" | "hot-seat"): string {
  return value === "secure" ? "Стабилен" : value === "watched" ? "Под наблюдением" : "На грани";
}

interface WorldDashboardSave { world: FootballEcosystemState; football: FootballCareerState }

export function WorldDashboard({ save }: { save: WorldDashboardSave }) {
  const [view, setView] = useState<WorldView>("pulse");
  const [selectedStory, setSelectedStory] = useState<EcosystemStory>();
  const { world, football } = save;

  const stories = useMemo(
    () => [...world.stories].sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.importance - left.importance).slice(0, 18),
    [world.stories],
  );
  const samePositionPlayers = useMemo(
    () => world.players
      .filter((player) => player.level === "high-school" && player.classYear === "Senior" && player.position === football.position)
      .sort((left, right) => left.nationalRank - right.nationalRank)
      .slice(0, 14),
    [world.players, football.position],
  );
  const collegeTeams = useMemo(
    () => world.teams
      .filter((team) => team.level === "college")
      .sort((left, right) => right.positionNeeds[football.position] - left.positionNeeds[football.position] || right.prestige - left.prestige)
      .slice(0, 12),
    [world.teams, football.position],
  );
  const coaches = useMemo(
    () => world.coaches
      .filter((coach) => coach.role === "head-coach")
      .sort((left, right) => left.jobSecurity - right.jobSecurity)
      .slice(0, 12),
    [world.coaches],
  );

  return (
    <div className="compact-section world-dashboard">
      <header className="compact-page-head world-head">
        <div><span>Autonomous football world</span><h2>Экосистема</h2></div>
        <strong className="compact-head-score">W{world.currentWeek}</strong>
      </header>

      <SectionTabs<WorldView> tabs={views} active={view} onChange={setView} ariaLabel="Разделы спортивного мира" />

      {view === "pulse" && (
        <div className="compact-view world-pulse">
          <section className="world-market-strip">
            <span><small>Коммиты</small><strong>{world.market.committedPlayers}</strong></span>
            <span><small>Активный рынок</small><strong>{world.market.activeRecruitments}</strong></span>
            <span><small>Горячие штабы</small><strong>{world.market.coachingHotSeats}</strong></span>
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
            {stories.length === 0 && <div className="compact-note"><Icon name="clock" /><p>Сезон только начался. Первые реальные изменения появятся после нескольких игровых дней.</p></div>}
          </div>
        </div>
      )}

      {view === "players" && (
        <div className="compact-view">
          <section className="world-context-card">
            <small>Твоя позиция</small><h3>{football.position}: рынок выпускников</h3>
            <p>Эти игроки конкурируют за те же предложения и места в будущих depth chart.</p>
          </section>
          <div className="world-player-list">
            {samePositionPlayers.map((player) => {
              const team = world.teams.find((item) => item.id === player.teamId);
              const committed = player.committedTeamId ? world.teams.find((item) => item.id === player.committedTeamId) : undefined;
              return (
                <article key={player.id}>
                  <span>#{player.nationalRank}</span>
                  <div><strong>{player.name}</strong><small>{team?.shortName ?? "HS"} · OVR {Math.round(player.overall)} · {trajectoryLabel(player.trajectory)}</small></div>
                  <em>{committed ? committed.shortName : player.recruitingStage === "offered" ? "OFFERS" : player.recruitingStage.toUpperCase()}</em>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {view === "programs" && (
        <div className="compact-view">
          <section className="world-context-card">
            <small>Колледж-футбол</small><h3>Кому реально нужен {football.position}</h3>
            <p>Потребности меняются из-за травм, коммитов других игроков, результатов и решений штаба.</p>
          </section>
          <div className="world-team-grid">
            {collegeTeams.map((team) => {
              const headCoach = world.coaches.find((coach) => coach.teamId === team.id && coach.role === "head-coach");
              const heroProgram = football.recruitment.programs.find((program) => program.id === team.id);
              return (
                <article key={team.id}>
                  <header><span>{team.shortName}</span><strong>{team.wins}–{team.losses}</strong></header>
                  <h3>{team.name}</h3>
                  <div><small>Нужда {football.position}</small><strong>{Math.round(team.positionNeeds[football.position])}</strong></div>
                  <footer><span>{heroProgram ? `Интерес ${Math.round(heroProgram.interest)}` : `Рейтинг ${Math.round(team.rating)}`}</span><em className={headCoach?.status === "hot-seat" ? "is-danger" : ""}>{headCoach ? coachStatusLabel(headCoach.status) : "Штаб"}</em></footer>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {view === "coaches" && (
        <div className="compact-view">
          <section className="world-context-card">
            <small>Рынок тренеров</small><h3>Штабы тоже борются за работу</h3>
            <p>Увольнение меняет схемы, рекрутинг, обещания и развитие уже набранных игроков.</p>
          </section>
          <div className="world-coach-list">
            {coaches.map((coach) => {
              const team = world.teams.find((item) => item.id === coach.teamId);
              return (
                <article key={coach.id} className={coach.status === "hot-seat" ? "is-danger" : ""}>
                  <div><small>{team?.shortName ?? "TEAM"}</small><strong>{coach.name}</strong><span>{coach.philosophy}</span></div>
                  <aside><em>{coachStatusLabel(coach.status)}</em><strong>{Math.round(coach.jobSecurity)}</strong></aside>
                </article>
              );
            })}
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
    </div>
  );
}
