import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { ScreenShell } from "../components/layout/ScreenShell";
import { LoadingScreen } from "../components/feedback/LoadingScreen";
import { Icon } from "../components/ui/Icon";
import { TodayDashboard } from "../components/career/TodayDashboard";
import { MatchDashboard } from "../components/career/MatchDashboard";
import { CollegeOrientationDashboard } from "../components/career/CollegeOrientationDashboard";
import { CollegeCareerDashboard } from "../components/career/CollegeCareerDashboard";
import { ProfessionalTransitionDashboard } from "../components/career/ProfessionalTransitionDashboard";
import { WorldDashboard } from "../components/career/WorldDashboard";
import { CareerNavigation, type CareerPrimaryView } from "../components/career/CareerNavigation";
import { CareerDrawer, type CareerSecondaryView } from "../components/career/CareerDrawer";
import { PlayerProfileDashboard } from "../components/career/PlayerProfileDashboard";
import { TeamProfileDashboard } from "../components/career/TeamProfileDashboard";
import { CareerOverviewDashboard } from "../components/career/CareerOverviewDashboard";
import { RecruitingDashboard } from "../components/career/RecruitingDashboard";
import { SeasonDashboard } from "../components/career/SeasonDashboard";
import { useCareerSave } from "../hooks/useCareerSave";

export default function CareerOverviewScreen() {
  const navigate = useNavigate();
  const { careerId } = useParams();
  const state = useCareerSave(careerId);
  const { save, loading, error, mutating, actionError } = state;
  const [primaryView, setPrimaryView] = useState<CareerPrimaryView>("home");
  const [secondaryView, setSecondaryView] = useState<CareerSecondaryView>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>();

  if (loading) return <LoadingScreen label="Загрузка" />;
  if (!save || error) return <ScreenShell narrow><section className="fatal-panel"><h1>{error ?? "Карьера не найдена"}</h1><button className="button button--primary" onClick={() => navigate("/")}>Сохранения</button></section></ScreenShell>;

  const careerSave = save;
  const menuButton = <button className="icon-button icon-button--quiet" aria-label="Открыть разделы" onClick={() => setDrawerOpen(true)}><Icon name="menu" /></button>;
  const commonDrawer = (minimal = false) => <CareerDrawer open={drawerOpen} save={careerSave} active={secondaryView} showRecruiting={careerSave.meta.phase === "high-school-preseason"} minimal={minimal} onSelect={(view) => { setSecondaryView(view); setDrawerOpen(false); setMatchOpen(false); }} onClose={() => setDrawerOpen(false)} onExit={() => navigate("/")} />;

  if (careerSave.meta.phase === "college-orientation") return (
    <ScreenShell narrow header={<AppHeader compact action={menuButton} />} className="career-game-shell">
      <CollegeOrientationDashboard save={careerSave} mutating={mutating} {...(actionError ? { actionError } : {})} onSetPriority={state.setCollegeOnboardingPriority} />
      {commonDrawer(true)}
    </ScreenShell>
  );

  if (careerSave.meta.phase === "professional-draft" || careerSave.meta.phase === "professional-career") return (
    <ScreenShell narrow header={<AppHeader compact action={menuButton} />} className="career-game-shell">
      <ProfessionalTransitionDashboard save={careerSave} mutating={mutating} {...(actionError ? { actionError } : {})} onResolveDeclaration={state.resolveProfessionalDeclaration} onSelectAgent={state.selectProfessionalAgent} onCompleteEvaluation={state.completeProfessionalEvaluation} onRunDraft={state.runProfessionalDraft} onAcceptCampInvite={state.acceptProfessionalCampInvite} onAdvanceCamp={state.advanceProfessionalTrainingCamp} />
      {commonDrawer(true)}
    </ScreenShell>
  );

  if (careerSave.meta.phase === "college-season") return (
    <ScreenShell narrow header={<AppHeader compact action={menuButton} />} className="career-game-shell">
      <CollegeCareerDashboard save={careerSave} mutating={mutating} {...(actionError ? { actionError } : {})} drawerOpen={drawerOpen} onDrawerOpenChange={setDrawerOpen} onExit={() => navigate("/")} onAdvanceDay={state.advanceDay} onUpdateTrainingPlan={state.updateTrainingPlan} onResolveDecision={state.resolveCollegeHeroDecision} onStartMatch={state.startMatch} onResolveMatchDecision={state.resolveMatchDecision} onFinalizeMatch={state.finalizeCollegeMatch} onOpenProfessionalDraft={state.openProfessionalDraft} />
    </ScreenShell>
  );

  function openTeam(teamId?: string) {
    setSelectedTeamId(teamId);
    setPrimaryView("team");
    setSecondaryView(undefined);
    setMatchOpen(false);
  }

  function selectPrimary(view: CareerPrimaryView) {
    setPrimaryView(view);
    setSecondaryView(undefined);
    setMatchOpen(false);
    if (view !== "team") setSelectedTeamId(undefined);
  }

  function renderSecondary() {
    if (!secondaryView) return null;
    if (secondaryView === "overview") return <CareerOverviewDashboard save={careerSave} />;
    if (secondaryView === "season") return <SeasonDashboard save={careerSave} onOpenMatch={() => setMatchOpen(true)} lockedView="season" />;
    if (secondaryView === "matches") return <SeasonDashboard save={careerSave} onOpenMatch={() => setMatchOpen(true)} lockedView="schedule" />;
    if (secondaryView === "standings") return <SeasonDashboard save={careerSave} onOpenMatch={() => setMatchOpen(true)} lockedView="standings" />;
    if (secondaryView === "recruiting") return <RecruitingDashboard save={careerSave} mutating={mutating} {...(actionError ? { actionError } : {})} onAction={state.performRecruitingAction} onCommit={state.commitToCollege} onWithdrawCommitment={state.withdrawCollegeCommitment} />;
    if (secondaryView === "feed") return <WorldDashboard save={careerSave} view="feed" hideNavigation onOpenTeam={(id) => openTeam(id)} />;
    return <WorldDashboard save={careerSave} view="rankings" hideNavigation onOpenTeam={(id) => openTeam(id)} />;
  }

  return (
    <ScreenShell header={<AppHeader compact action={menuButton} />} className="career-game-shell" footer={<CareerNavigation active={primaryView} onChange={selectPrimary} />}>
      <div className="career-game-page">
        {matchOpen ? (
          <><header className="secondary-page-bar"><button type="button" onClick={() => setMatchOpen(false)}><Icon name="arrow-left" /></button><strong>Матч</strong></header><MatchDashboard save={careerSave} mutating={mutating} {...(actionError ? { actionError } : {})} onStartMatch={state.startMatch} onResolveDecision={state.resolveMatchDecision} /></>
        ) : secondaryView ? (
          <><header className="secondary-page-bar"><button type="button" onClick={() => setSecondaryView(undefined)}><Icon name="arrow-left" /></button><strong>{secondaryView === "overview" ? "Обзор" : secondaryView === "season" ? "Сезон" : secondaryView === "matches" ? "Матчи" : secondaryView === "standings" ? "Таблица" : secondaryView === "recruiting" ? "Рекрутинг" : secondaryView === "feed" ? "Лента" : "Рейтинг"}</strong></header>{renderSecondary()}</>
        ) : primaryView === "profile" ? (
          <PlayerProfileDashboard save={careerSave} mutating={mutating} {...(actionError ? { actionError } : {})} onSignCollege={state.signCollegeAgreement} onReportToCollege={state.reportToCollege} />
        ) : primaryView === "team" ? (
          <TeamProfileDashboard save={careerSave} {...(selectedTeamId ? { teamId: selectedTeamId } : {})} />
        ) : (
          <TodayDashboard save={careerSave} mutating={mutating} {...(actionError ? { actionError } : {})} onUpdatePlan={state.updateWeeklyPlan} onUpdateTrainingPlan={state.updateTrainingPlan} onAdvanceDay={state.advanceDay} onResolveRelationshipEvent={state.resolveRelationshipEvent} onOpenMatch={() => setMatchOpen(true)} />
        )}
      </div>
      {commonDrawer()}
    </ScreenShell>
  );
}
