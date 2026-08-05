import { useState } from "react";
import type { WeeklyReport } from "../../application/career/weekly/types";
import type { CareerSave } from "../../storage/saves/schema";
import { getTrainingFocus } from "../../sports/football/training/catalog";
import { Icon } from "../ui/Icon";
import { CareerNavigation, type CareerPrimaryView } from "./CareerNavigation";
import { CareerDrawer, type CareerSecondaryView } from "./CareerDrawer";
import { WorldDashboard } from "./WorldDashboard";
import { PlayerProfileDashboard } from "./PlayerProfileDashboard";
import { TeamProfileDashboard } from "./TeamProfileDashboard";
import { CollegeSectionsDashboard } from "./CollegeSectionsDashboard";
import { SocialLifeDashboard } from "./SocialLifeDashboard";
import { MarketDashboard } from "./MarketDashboard";
import { LeagueDirectoryDashboard } from "./LeagueDirectoryDashboard";
import { WeeklyReportPanel } from "./WeeklyReportPanel";

interface CollegeCareerDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  weeklyReport?: WeeklyReport;
  drawerOpen: boolean;
  onDrawerOpenChange(open: boolean): void;
  onExit(): void;
  onAdvanceWeek(): Promise<void>;
  onResolveRelationshipEvent(optionId: string): Promise<void>;
  onResolveDecision(optionId: string): Promise<void>;
  onOpenProfessionalDraft(): Promise<void>;
}

function roleLabel(role: string): string {
  return { starter: "Стартер", rotation: "Ротация", "special-teams": "Спецкоманды", developmental: "Развитие" }[role] ?? role;
}

export function CollegeCareerDashboard({ save, mutating, actionError, weeklyReport, drawerOpen, onDrawerOpenChange, onExit, onAdvanceWeek, onResolveRelationshipEvent, onResolveDecision, onOpenProfessionalDraft }: CollegeCareerDashboardProps) {
  const [primaryView, setPrimaryView] = useState<CareerPrimaryView>("home");
  const [secondaryView, setSecondaryView] = useState<CareerSecondaryView>();
  const [selectedTeamId, setSelectedTeamId] = useState<string>();
  const career = save.football.college.heroCareer;
  const program = save.football.college.program;
  if (!career || !program) return null;

  const team = save.world.teams.find((item) => item.id === career.teamId);
  const hero = save.world.players.find((player) => player.isHero);
  const focus = getTrainingFocus(save.football.position, save.football.training.plan.focusId);
  const nextGame = save.world.competition.schedule
    .filter((game) => game.status === "scheduled" && (game.homeTeamId === career.teamId || game.awayTeamId === career.teamId))
    .sort((a, b) => a.week - b.week)[0];
  const nextOpponentId = nextGame ? (nextGame.homeTeamId === career.teamId ? nextGame.awayTeamId : nextGame.homeTeamId) : undefined;
  const nextOpponent = save.world.teams.find((item) => item.id === nextOpponentId);
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

  function secondaryContent() {
    if (secondaryView === "season") return <CollegeSectionsDashboard save={save} />;
    if (secondaryView === "social") return <SocialLifeDashboard save={save} mutating={mutating} onResolveRelationshipEvent={onResolveRelationshipEvent} />;
    if (secondaryView === "feed") return <WorldDashboard save={save} view="feed" hideNavigation onOpenTeam={(id) => openTeam(id)} />;
    if (secondaryView === "market") return <MarketDashboard save={save} mutating={mutating} {...(actionError ? { actionError } : {})} onOpenTeam={(id) => openTeam(id)} onResolveCollegeDecision={onResolveDecision} />;
    if (secondaryView === "rankings") return <WorldDashboard save={save} view="rankings" hideNavigation onOpenTeam={(id) => openTeam(id)} />;
    return null;
  }

  return (
    <div className="college-career-shell college-career-shell--v27">
      <div className="college-career-main">
        {secondaryView ? (
          <><header className="secondary-page-bar"><button type="button" onClick={() => setSecondaryView(undefined)}><Icon name="arrow-left" /></button><strong>{secondaryView === "season" ? "Сезон" : secondaryView === "social" ? "Социальная жизнь" : secondaryView === "feed" ? "Лента" : secondaryView === "market" ? "Рынок" : "Рейтинг"}</strong></header>{secondaryContent()}</>
        ) : primaryView === "profile" ? (
          <PlayerProfileDashboard save={save} mutating={mutating} {...(actionError ? { actionError } : {})} onResolveCollegeDecision={onResolveDecision} />
        ) : primaryView === "team" ? (
          <TeamProfileDashboard save={save} {...(selectedTeamId ? { teamId: selectedTeamId } : {})} />
        ) : primaryView === "league" ? (
          <LeagueDirectoryDashboard save={save} onOpenCollegeTeam={(id) => openTeam(id)} />
        ) : (
          <div className="college-home-page">
            <header className="college-home-head"><div><small>{career.classYear} · W{career.week}</small><h1>{program.shortName}</h1></div><strong>{team?.wins ?? 0}–{team?.losses ?? 0}</strong></header>
            <section className="college-home-metrics"><article><small>Роль</small><strong>{roleLabel(career.role)}</strong></article><article><small>Depth</small><strong>#{career.depthRank}</strong></article><article><small>Trust</small><strong>{Math.round(career.coachTrust)}</strong></article><article><small>Reps</small><strong>{Math.round(career.practiceReps)}</strong></article></section>

            <WeeklyReportPanel report={weeklyReport} />

            <section className="college-home-game"><div><small>{nextGame ? `W${nextGame.week} · ${nextGame.homeTeamId === career.teamId ? "ДОМА" : "В ГОСТЯХ"}` : "КАЛЕНДАРЬ"}</small><strong>{nextOpponent?.name ?? "Нет матча"}</strong></div><span>{nextOpponent ? Math.round(nextOpponent.rating) : "—"}</span></section>

            <section className="weekly-composition-card weekly-composition-card--college">
              <header><small>АВТОМАТИЧЕСКАЯ ПОДГОТОВКА</small><strong>{focus.name}</strong><span>{save.football.training.plan.intensity}</span></header>
              <div>
                <article><small>OVR</small><strong>{Math.round(hero?.overall ?? save.football.ratings.overall)}</strong></article>
                <article><small>Форма</small><strong>{Math.round(hero?.form ?? 0)}</strong></article>
                <article><small>Здоровье</small><strong>{Math.round(hero?.health ?? 0)}</strong></article>
                <article><small>Fit</small><strong>{Math.round(hero?.tactical.schemeFit ?? 0)}</strong></article>
              </div>
              <p>Штаб сам распределяет нагрузку, повторы и роль. Матч проходит внутри недельного расчёта.</p>
            </section>

            {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
            <button type="button" className="primary-action-bar weekly-advance-button" disabled={mutating || career.status === "complete"} onClick={() => void onAdvanceWeek()}><span><small>Тренировки · мир · матч</small><strong>{mutating ? "РАСЧЁТ НЕДЕЛИ…" : career.status === "complete" ? "СЕЗОН ЗАВЕРШЁН" : "ПРОДОЛЖИТЬ НЕДЕЛЮ"}</strong></span><Icon name="arrow-right" /></button>
            {canExploreDraft && <button type="button" className="college-pro-entry college-pro-entry--data" disabled={mutating} onClick={() => void onOpenProfessionalDraft()}><span><small>DRAFT</small><strong>Открыть оценку</strong></span><Icon name="arrow-right" /></button>}
          </div>
        )}
      </div>
      <CareerNavigation active={secondaryView ? undefined : primaryView} onChange={selectPrimary} />
      <CareerDrawer open={drawerOpen} save={save} active={secondaryView} onSelect={(view) => { setSecondaryView(view); onDrawerOpenChange(false); }} onClose={() => onDrawerOpenChange(false)} onExit={onExit} />
    </div>
  );
}
