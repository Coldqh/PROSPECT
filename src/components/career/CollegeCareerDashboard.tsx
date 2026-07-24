import { useEffect, useState } from "react";
import type { TrainingIntensity } from "../../core/life/types";
import { formatGameDate } from "../../core/calendar/types";
import type { CareerSave } from "../../storage/saves/schema";
import { isCollegeMatchAwaitingResolution } from "../../sports/football/college/heroCareer";
import type { TrainingFocusId } from "../../sports/football/training/types";
import { getTrainingFocusCatalog } from "../../sports/football/training/catalog";
import { Icon } from "../ui/Icon";
import { CareerNavigation, type CareerPrimaryView } from "./CareerNavigation";
import { CareerDrawer, type CareerSecondaryView } from "./CareerDrawer";
import { WorldDashboard } from "./WorldDashboard";
import { MatchDashboard } from "./MatchDashboard";
import { PlayerProfileDashboard } from "./PlayerProfileDashboard";
import { TeamProfileDashboard } from "./TeamProfileDashboard";
import { CareerOverviewDashboard } from "./CareerOverviewDashboard";
import { CollegeSectionsDashboard } from "./CollegeSectionsDashboard";

const dayLabels = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"] as const;

interface CollegeCareerDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  drawerOpen: boolean;
  onDrawerOpenChange(open: boolean): void;
  onExit(): void;
  onAdvanceDay(): Promise<void>;
  onUpdateTrainingPlan(focusId: TrainingFocusId, intensity: TrainingIntensity): Promise<void>;
  onResolveDecision(optionId: string): Promise<void>;
  onStartMatch(): Promise<void>;
  onResolveMatchDecision(optionId: string): Promise<void>;
  onFinalizeMatch(): Promise<void>;
  onOpenProfessionalDraft(): Promise<void>;
}

function roleLabel(role: string): string {
  return { starter: "Стартер", rotation: "Ротация", "special-teams": "Спецкоманды", developmental: "Развитие" }[role] ?? role;
}

export function CollegeCareerDashboard({ save, mutating, actionError, drawerOpen, onDrawerOpenChange, onExit, onAdvanceDay, onUpdateTrainingPlan, onResolveDecision, onStartMatch, onResolveMatchDecision, onFinalizeMatch, onOpenProfessionalDraft }: CollegeCareerDashboardProps) {
  const [primaryView, setPrimaryView] = useState<CareerPrimaryView>("home");
  const [secondaryView, setSecondaryView] = useState<CareerSecondaryView>();
  const [selectedTeamId, setSelectedTeamId] = useState<string>();
  const [focusId, setFocusId] = useState<TrainingFocusId>(save.football.training.plan.focusId);
  const [intensity, setIntensity] = useState<TrainingIntensity>(save.football.training.plan.intensity);
  const career = save.football.college.heroCareer;
  const program = save.football.college.program;

  useEffect(() => {
    setFocusId(save.football.training.plan.focusId);
    setIntensity(save.football.training.plan.intensity);
  }, [save.football.training.plan.focusId, save.football.training.plan.intensity]);

  if (!career || !program) return null;

  const team = save.world.teams.find((item) => item.id === career.teamId);
  const hero = save.world.players.find((player) => player.isHero);
  const focuses = getTrainingFocusCatalog(save.football.position);
  const nextGame = save.world.competition.schedule.filter((game) => game.status === "scheduled" && (game.homeTeamId === career.teamId || game.awayTeamId === career.teamId)).sort((a, b) => a.week - b.week)[0];
  const nextOpponentId = nextGame ? (nextGame.homeTeamId === career.teamId ? nextGame.awayTeamId : nextGame.homeTeamId) : undefined;
  const nextOpponent = save.world.teams.find((item) => item.id === nextOpponentId);
  const trainingChanged = focusId !== save.football.training.plan.focusId || intensity !== save.football.training.plan.intensity;
  const canExploreDraft = career.status === "complete" || career.classYear === "Junior" || career.classYear === "Senior" || career.seasonHistory.length >= 2;

  function openTeam(teamId?: string) {
    setSelectedTeamId(teamId);
    setPrimaryView("team");
    setSecondaryView(undefined);
  }

  function selectPrimary(view: CareerPrimaryView) {
    setPrimaryView(view);
    setSecondaryView(undefined);
    if (view !== "team") setSelectedTeamId(undefined);
  }

  if (isCollegeMatchAwaitingResolution(save)) return (
    <div className="college-game-page">
      <MatchDashboard save={save} mutating={mutating} {...(actionError ? { actionError } : {})} onStartMatch={onStartMatch} onResolveDecision={onResolveMatchDecision} onFinalizeMatch={onFinalizeMatch} />
      <CareerDrawer open={drawerOpen} save={save} onSelect={(view) => { setSecondaryView(view); onDrawerOpenChange(false); }} onClose={() => onDrawerOpenChange(false)} onExit={onExit} />
    </div>
  );

  function secondaryContent() {
    if (secondaryView === "overview") return <CareerOverviewDashboard save={save} />;
    if (secondaryView === "season") return <CollegeSectionsDashboard save={save} view="season" />;
    if (secondaryView === "matches") return <CollegeSectionsDashboard save={save} view="matches" />;
    if (secondaryView === "standings") return <CollegeSectionsDashboard save={save} view="standings" />;
    if (secondaryView === "feed") return <WorldDashboard save={save} view="feed" hideNavigation onOpenTeam={(id) => openTeam(id)} />;
    if (secondaryView === "rankings") return <WorldDashboard save={save} view="rankings" hideNavigation onOpenTeam={(id) => openTeam(id)} />;
    return null;
  }

  return (
    <div className="college-career-shell college-career-shell--v27">
      <main className="college-career-main">
        {secondaryView ? (
          <><header className="secondary-page-bar"><button type="button" onClick={() => setSecondaryView(undefined)}><Icon name="arrow-left" /></button><strong>{secondaryView === "overview" ? "Обзор" : secondaryView === "season" ? "Сезон" : secondaryView === "matches" ? "Матчи" : secondaryView === "standings" ? "Таблица" : secondaryView === "feed" ? "Лента" : "Рейтинг"}</strong></header>{secondaryContent()}</>
        ) : primaryView === "profile" ? (
          <PlayerProfileDashboard save={save} mutating={mutating} {...(actionError ? { actionError } : {})} onResolveCollegeDecision={onResolveDecision} />
        ) : primaryView === "team" ? (
          <TeamProfileDashboard save={save} {...(selectedTeamId ? { teamId: selectedTeamId } : {})} />
        ) : (
          <div className="college-home-page">
            <header className="college-home-head"><div><small>{career.classYear} · W{career.week}</small><h1>{program.shortName}</h1></div><strong>{team?.wins ?? 0}–{team?.losses ?? 0}</strong></header>
            <section className="college-home-metrics"><article><small>Роль</small><strong>{roleLabel(career.role)}</strong></article><article><small>Depth</small><strong>#{career.depthRank}</strong></article><article><small>Trust</small><strong>{Math.round(career.coachTrust)}</strong></article><article><small>Reps</small><strong>{Math.round(career.practiceReps)}</strong></article></section>

            <section className="college-home-game"><div><small>{nextGame ? `W${nextGame.week} · ${nextGame.homeTeamId === career.teamId ? "ДОМА" : "В ГОСТЯХ"}` : "КАЛЕНДАРЬ"}</small><strong>{nextOpponent?.name ?? "Нет матча"}</strong></div><span>{nextOpponent ? Math.round(nextOpponent.rating) : "—"}</span></section>

            <section className="college-training-card college-training-card--data">
              <header><div><small>ТРЕНИРОВКА</small><h3>{focuses.find((item) => item.id === focusId)?.name}</h3></div><span>{intensity}</span></header>
              <div className="college-training-focuses">{focuses.map((focus) => <button type="button" key={focus.id} className={focusId === focus.id ? "is-active" : ""} onClick={() => setFocusId(focus.id)}><strong>{focus.shortName}</strong><small>TEC {focus.multipliers.technique.toFixed(2)} · ATH {focus.multipliers.athleticism.toFixed(2)} · IQ {focus.multipliers.footballIq.toFixed(2)} · REC {focus.multipliers.recovery.toFixed(2)}</small></button>)}</div>
              <div className="compact-segmented">{(["controlled", "standard", "aggressive"] as const).map((item) => <button type="button" key={item} className={intensity === item ? "is-active" : ""} onClick={() => setIntensity(item)}>{item}</button>)}</div>
              <button type="button" className="training-apply-row" disabled={!trainingChanged || mutating} onClick={() => void onUpdateTrainingPlan(focusId, intensity)}><span><small>{focuses.find((item) => item.id === focusId)?.shortName} · {intensity}</small><strong>{mutating ? "Сохранение…" : trainingChanged ? "Применить" : "Выбрано"}</strong></span><Icon name={trainingChanged ? "arrow-right" : "check"} /></button>
            </section>

            <section className="college-depth-strip"><article><small>OVR</small><strong>{Math.round(hero?.overall ?? save.football.ratings.overall)}</strong></article><article><small>Форма</small><strong>{Math.round(hero?.form ?? 0)}</strong></article><article><small>Здоровье</small><strong>{Math.round(hero?.health ?? 0)}</strong></article><article><small>Fit</small><strong>{Math.round(hero?.tactical.schemeFit ?? 0)}</strong></article></section>

            {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
            <button type="button" className="primary-action-bar college-advance-day" disabled={mutating || Boolean(career.pendingDecision) || career.status === "complete"} onClick={() => void onAdvanceDay()}><span><small>{formatGameDate(save.meta.currentDate)} · {dayLabels[save.life.dayIndex]}</small><strong>{mutating ? "Расчёт…" : career.status === "complete" ? "Сезон завершён" : career.pendingDecision ? "Решение в профиле" : "Завершить день"}</strong></span><Icon name="arrow-right" /></button>
            {canExploreDraft && !career.pendingDecision && <button type="button" className="college-pro-entry college-pro-entry--data" disabled={mutating} onClick={() => void onOpenProfessionalDraft()}><span><small>DRAFT</small><strong>Открыть оценку</strong></span><Icon name="arrow-right" /></button>}
          </div>
        )}
      </main>
      <CareerNavigation active={secondaryView ? undefined : primaryView} onChange={selectPrimary} />
      <CareerDrawer open={drawerOpen} save={save} active={secondaryView} onSelect={(view) => { setSecondaryView(view); onDrawerOpenChange(false); }} onClose={() => onDrawerOpenChange(false)} onExit={onExit} />
    </div>
  );
}
