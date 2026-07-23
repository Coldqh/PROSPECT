import { useState } from "react";
import type { TrainingIntensity } from "../../core/life/types";
import { formatGameDate } from "../../core/calendar/types";
import type { CareerSave } from "../../storage/saves/schema";
import type { CollegeHeroRole } from "../../sports/football/college/types";
import type { TrainingFocusId } from "../../sports/football/training/types";
import { Icon } from "../ui/Icon";
import { SectionTabs } from "../ui/SectionTabs";

const views = [
  { id: "week", label: "Неделя" },
  { id: "depth", label: "Depth" },
  { id: "people", label: "Люди" },
  { id: "season", label: "Сезон" },
] as const;

type ViewId = (typeof views)[number]["id"];

const focuses: readonly { id: TrainingFocusId; label: string; detail: string }[] = [
  { id: "position-craft", label: "Техника", detail: "Позиционные навыки и надёжность" },
  { id: "explosive-power", label: "Атлетизм", detail: "Сила, скорость и взрыв" },
  { id: "film-install", label: "Система", detail: "Плёнка и освоение схемы" },
  { id: "recovery-reset", label: "Восстановление", detail: "Сброс нагрузки и лечение" },
];

const dayLabels = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"] as const;

interface CollegeCareerDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onAdvanceDay(): Promise<void>;
  onUpdateTrainingPlan(focusId: TrainingFocusId, intensity: TrainingIntensity): Promise<void>;
  onResolveDecision(optionId: string): Promise<void>;
}

function roleLabel(role: CollegeHeroRole): string {
  return {
    starter: "Стартер",
    rotation: "Ротация",
    "special-teams": "Спецкоманды",
    developmental: "Развитие",
  }[role];
}

function bondKindLabel(kind: CareerSave["world"]["social"]["bonds"][number]["kind"]): string {
  return {
    teammate: "Партнёр",
    "position-rival": "Конкурент",
    mentor: "Наставник",
    "coach-player": "Тренер",
    staff: "Штаб",
  }[kind];
}

function promiseLabel(status: "active" | "kept" | "broken"): string {
  return { active: "На проверке", kept: "Выполнено", broken: "Нарушено" }[status];
}

export function CollegeCareerDashboard({
  save,
  mutating,
  actionError,
  onAdvanceDay,
  onUpdateTrainingPlan,
  onResolveDecision,
}: CollegeCareerDashboardProps) {
  const [view, setView] = useState<ViewId>("week");
  const [focusId, setFocusId] = useState<TrainingFocusId>(save.football.training.plan.focusId);
  const [intensity, setIntensity] = useState<TrainingIntensity>(save.football.training.plan.intensity);
  const college = save.football.college;
  const career = college.heroCareer;
  const program = college.program;
  if (!career || !program) return null;

  const team = save.world.teams.find((item) => item.id === career.teamId);
  const hero = save.world.players.find((player) => player.isHero);
  const culture = save.world.social.teamCultures.find((item) => item.teamId === career.teamId);
  const nextGame = [...save.world.competition.schedule]
    .filter((game) => game.status === "scheduled" && (game.homeTeamId === career.teamId || game.awayTeamId === career.teamId))
    .sort((left, right) => left.week - right.week)[0];
  const nextOpponentId = nextGame
    ? nextGame.homeTeamId === career.teamId ? nextGame.awayTeamId : nextGame.homeTeamId
    : undefined;
  const nextOpponent = nextOpponentId ? save.world.teams.find((item) => item.id === nextOpponentId) : undefined;
  const trainingChanged = focusId !== save.football.training.plan.focusId || intensity !== save.football.training.plan.intensity;

  const heroBonds = save.world.social.bonds
    .filter((bond) => bond.active && bond.teamId === career.teamId && (bond.entityAId === "hero" || bond.entityBId === "hero"))
    .sort((left, right) => Number(right.kind === "position-rival") - Number(left.kind === "position-rival") || right.influence - left.influence)
    .slice(0, 8);

  const counterpartName = (entityId: string): string => save.world.players.find((player) => player.id === entityId)?.name
    ?? save.world.coaches.find((coach) => coach.id === entityId)?.name
    ?? entityId;

  return (
    <div className="college-career-shell">
      <header className="college-career-head">
        <div>
          <small>FRESHMAN · {program.city}, {program.stateCode} · W{career.week}</small>
          <h1>{program.shortName}</h1>
          <p>{save.character.identity.fullName} · {save.football.position} · {roleLabel(career.role)} · #{career.depthRank}</p>
        </div>
        <span><small>OVR</small><strong>{Math.round(save.football.ratings.overall)}</strong><em>{team?.wins ?? 0}–{team?.losses ?? 0}</em></span>
      </header>

      <SectionTabs<ViewId> tabs={views} active={view} onChange={setView} ariaLabel="Университетская карьера" />

      {view === "week" && (
        <div className="compact-view college-week-view">
          <section className="college-week-strip">
            <span><small>Роль</small><strong>{roleLabel(career.role)}</strong></span>
            <span><small>Depth</small><strong>#{career.depthRank}</strong></span>
            <span><small>Доверие</small><strong>{Math.round(career.coachTrust)}</strong></span>
            <span><small>Повторы</small><strong>{Math.round(career.practiceReps)}</strong></span>
          </section>

          {career.pendingDecision && (
            <section className="college-decision-card">
              <small>РЕШЕНИЕ НУЖНО СЕЙЧАС</small>
              <h3>{career.pendingDecision.title}</h3>
              <p>{career.pendingDecision.detail}</p>
              <div>
                {career.pendingDecision.options.map((option) => (
                  <button type="button" key={option.id} disabled={mutating} onClick={() => void onResolveDecision(option.id)}>
                    <strong>{option.label}</strong><small>{option.detail}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="college-next-game-card">
            <div>
              <small>{nextGame ? `НЕДЕЛЯ ${nextGame.week} · ${nextGame.homeTeamId === career.teamId ? "ДОМА" : "В ГОСТЯХ"}` : "КАЛЕНДАРЬ"}</small>
              <h3>{nextOpponent?.shortName ?? "Матч пока не назначен"}</h3>
              <p>{nextGame ? `${nextGame.kind === "rivalry" ? "Rivalry" : nextGame.conferenceGame ? "Конференция" : "Вне конференции"}. Игровое время определяется ролью, здоровьем и качеством недели.` : "Программа находится между игровыми неделями."}</p>
            </div>
            <span>{nextOpponent ? Math.round(nextOpponent.rating) : "—"}</span>
          </section>

          <section className="college-training-card">
            <header><div><small>ПЛАН ТРЕНИРОВКИ</small><h3>{focuses.find((item) => item.id === focusId)?.label}</h3></div><span>{intensity}</span></header>
            <div className="college-training-focuses">
              {focuses.map((focus) => (
                <button type="button" key={focus.id} className={focusId === focus.id ? "is-active" : ""} onClick={() => setFocusId(focus.id)}>
                  <strong>{focus.label}</strong><small>{focus.detail}</small>
                </button>
              ))}
            </div>
            <div className="compact-segmented">
              {(["controlled", "standard", "aggressive"] as const).map((item) => (
                <button type="button" key={item} className={intensity === item ? "is-active" : ""} onClick={() => setIntensity(item)}>{item}</button>
              ))}
            </div>
            <button type="button" className="primary-action-bar" disabled={!trainingChanged || mutating} onClick={() => void onUpdateTrainingPlan(focusId, intensity)}>
              <span><small>Текущий план: {save.football.training.plan.focusId}</small><strong>{trainingChanged ? "Применить изменения" : "План активен"}</strong></span>
              <Icon name={trainingChanged ? "arrow-right" : "check"} />
            </button>
          </section>

          {save.life.lastOutcome && (
            <section className="college-last-day-card">
              <span>{save.life.lastOutcome.grade}</span>
              <div><small>{formatGameDate(save.life.lastOutcome.date)}</small><strong>{save.life.lastOutcome.title}</strong><p>{career.lastSummary}</p></div>
            </section>
          )}

          {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
          <button type="button" className="primary-action-bar college-advance-day" disabled={mutating || Boolean(career.pendingDecision)} onClick={() => void onAdvanceDay()}>
            <span><small>{formatGameDate(save.meta.currentDate)} · {dayLabels[save.life.dayIndex]}</small><strong>{mutating ? "Симуляция…" : career.pendingDecision ? "Сначала прими решение" : "Завершить день"}</strong></span>
            <Icon name="arrow-right" />
          </button>
        </div>
      )}

      {view === "depth" && (
        <div className="compact-view college-active-room">
          <section className="college-room-context">
            <small>РЕАЛЬНАЯ ПОЗИЦИОННАЯ КОМНАТА</small>
            <h3>{save.football.position} · {college.positionRoom.length} игроков</h3>
            <p>Порядок берётся из автономного мира. Форма, здоровье, схема и решения штаба меняют его каждую неделю.</p>
          </section>
          {college.positionRoom.map((player) => (
            <article key={player.id} className={player.isHero ? "is-hero" : ""}>
              <span>{player.depthRank}</span>
              <div><strong>{player.name}</strong><small>{player.year}{player.redshirt ? " · RS" : ""} · {player.style}</small></div>
              <em>{Math.round(player.overall)}</em>
            </article>
          ))}
          <section className="college-depth-reality">
            <span><small>Форма</small><strong>{Math.round(hero?.form ?? 0)}</strong></span>
            <span><small>Здоровье</small><strong>{Math.round(hero?.health ?? 0)}</strong></span>
            <span><small>Scheme fit</small><strong>{Math.round(hero?.tactical.schemeFit ?? 0)}</strong></span>
            <span><small>Статус</small><strong>{hero?.eligibility.athleticallyEligible ? "Eligible" : "Ineligible"}</strong></span>
          </section>
        </div>
      )}

      {view === "people" && (
        <div className="compact-view college-people-view">
          <section className="college-culture-card">
            <div><small>РАЗДЕВАЛКА</small><h3>{culture && culture.conflict >= 65 ? "Расколота" : culture && culture.cohesion >= 68 ? "Сплочена" : "Нестабильна"}</h3><p>{career.lastSummary}</p></div>
            <strong>{Math.round(culture?.cohesion ?? 50)}</strong>
          </section>
          <div className="college-culture-grid">
            <article><small>Положение</small><strong>{Math.round(career.lockerRoomStanding)}</strong></article>
            <article><small>Coach trust</small><strong>{Math.round(culture?.coachTrust ?? 50)}</strong></article>
            <article><small>Конфликт</small><strong>{Math.round(culture?.conflict ?? 0)}</strong></article>
            <article><small>Мораль</small><strong>{Math.round(culture?.morale ?? 50)}</strong></article>
          </div>
          <section className="college-bond-list">
            <header><small>СВЯЗИ ГЕРОЯ</small><h3>Кто влияет на карьеру</h3></header>
            {heroBonds.map((bond) => {
              const otherId = bond.entityAId === "hero" ? bond.entityBId : bond.entityAId;
              return (
                <article key={bond.id}>
                  <span>{bondKindLabel(bond.kind)}</span>
                  <div><strong>{counterpartName(otherId)}</strong><small>Доверие {Math.round(bond.trust)} · уважение {Math.round(bond.respect)}</small></div>
                  <em className={bond.tension >= 65 ? "is-danger" : ""}>{Math.round(bond.tension)}</em>
                </article>
              );
            })}
          </section>
        </div>
      )}

      {view === "season" && (
        <div className="compact-view college-season-view">
          <section className="college-season-strip">
            <span><small>Игры</small><strong>{career.gamesPlayed}</strong></span>
            <span><small>Старты</small><strong>{career.starts}</strong></span>
            <span><small>Снэпы</small><strong>{career.seasonSnaps}</strong></span>
            <span><small>Redshirt</small><strong>{career.redshirtStatus}</strong></span>
          </section>
          <section className="college-promise-list">
            <header><small>ОБЕЩАНИЯ ШТАБА</small><h3>Слова против реальности</h3></header>
            {career.promises.map((promise) => (
              <article key={promise.id} className={`is-${promise.status}`}>
                <span>{promiseLabel(promise.status)}</span>
                <div><strong>Игровая роль к W{promise.deadlineWeek}</strong><small>{promise.summary}</small></div>
              </article>
            ))}
          </section>
          <section className="college-transfer-card">
            <div><small>ТРАНСФЕРНЫЙ СТАТУС</small><h3>{career.transferIntent === "stay" ? "Остаётся" : career.transferIntent === "open" ? "Слушает варианты" : "В портале"}</h3><p>Решение появляется из реального положения в составе, обещаний и отношений со штабом.</p></div>
          </section>
          <section className="college-game-log">
            <header><small>ИГРОВОЕ ВРЕМЯ</small><h3>Матчи героя</h3></header>
            {[...career.gameLog].reverse().map((game) => (
              <article key={game.id}>
                <span className={game.won ? "is-win" : "is-loss"}>{game.won ? "W" : "L"}</span>
                <div><strong>{game.opponentName} · {game.score}</strong><small>W{game.week} · {game.snaps} снэпов · {roleLabel(game.role)}</small></div>
                <em>{game.grade}</em>
              </article>
            ))}
            {career.gameLog.length === 0 && <div className="compact-note"><Icon name="clock" /><p>Первый матч ещё не сыгран. Роль определяется тренировочной неделей.</p></div>}
          </section>
          <section className="college-world-stories">
            <header><small>ВОКРУГ ПРОГРАММЫ</small><h3>Последствия мира</h3></header>
            {save.world.stories.filter((story) => story.relatedToHero).slice(-5).reverse().map((story) => (
              <article key={story.id}><strong>{story.title}</strong><small>{story.detail}</small></article>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
