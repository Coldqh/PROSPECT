import { useState } from "react";
import type { WeeklyReport } from "../../application/career/weekly/types";
import type { CareerSave } from "../../storage/saves/schema";
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
import { CareerWeekCenter } from "./CareerWeekCenter";

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
  const nextGame = save.world.competition.schedule
    .filter((game) => game.status === "scheduled" && (game.homeTeamId === career.teamId || game.awayTeamId === career.teamId))
    .sort((a, b) => a.week - b.week)[0];
  const nextOpponentId = nextGame ? (nextGame.homeTeamId === career.teamId ? nextGame.awayTeamId : nextGame.homeTeamId) : undefined;
  const nextOpponent = save.world.teams.find((item) => item.id === nextOpponentId);
  const nationalRank = save.world.competition.rankings.find((ranking) => ranking.teamId === career.teamId)?.rank;
  const canExploreDraft = career.status === "complete" || career.classYear === "Junior" || career.classYear === "Senior" || career.seasonHistory.length >= 2;
  const focusLabel = save.football.training.body.activeIssue
    ? "Восстановление"
    : save.football.training.plan.focusId === "film-install"
      ? "Плейбук и разбор"
      : save.football.training.plan.focusId === "explosive-power"
        ? "Физическая работа"
        : "Позиционная техника";

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

  const draftAction = canExploreDraft
    ? <button type="button" className="college-pro-entry college-pro-entry--data" disabled={mutating} onClick={() => void onOpenProfessionalDraft()}><span><small>DRAFT</small><strong>Открыть оценку</strong></span><Icon name="arrow-right" /></button>
    : undefined;

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
            <CareerWeekCenter
              save={save}
              {...(weeklyReport ? { report: weeklyReport } : {})}
              phaseLabel={`${career.classYear.toUpperCase()} · COLLEGE`}
              weekLabel={`Неделя ${career.week}`}
              teamName={program.name}
              teamCode={program.shortName}
              record={`${team?.wins ?? 0}–${team?.losses ?? 0}`}
              {...(nextOpponent ? { opponentName: nextOpponent.name, opponentCode: nextOpponent.shortName } : {})}
              opponentMeta={nextGame ? `W${nextGame.week} · ${nextGame.homeTeamId === career.teamId ? "ДОМА" : "В ГОСТЯХ"}` : "КАЛЕНДАРЬ"}
              metrics={[
                { label: "Роль", value: roleLabel(career.role), detail: `Depth #${career.depthRank}` },
                { label: "Форма", value: Math.round(hero?.form ?? save.football.training.body.readiness), detail: `Health ${Math.round(hero?.health ?? save.character.condition.health)}` },
                { label: "OVR", value: Math.round(hero?.overall ?? save.football.ratings.overall), detail: `Fit ${Math.round(hero?.tactical.schemeFit ?? 0)}` },
                { label: "Рейтинг", value: nationalRank ? `#${nationalRank}` : "NR", detail: `${team?.conferenceId ?? "National"}` },
              ]}
              preparationLabel={focusLabel}
              preparationDetail="Штаб сам распределяет повторы, нагрузку и роль. Матч и весь мир рассчитываются одним нажатием."
              mutating={mutating}
              disabled={career.status === "complete"}
              {...(actionError ? { actionError } : {})}
              {...(draftAction ? { extraAction: draftAction } : {})}
              onAdvanceWeek={onAdvanceWeek}
            />
          </div>
        )}
      </div>
      <CareerNavigation active={secondaryView ? undefined : primaryView} onChange={selectPrimary} />
      <CareerDrawer open={drawerOpen} save={save} active={secondaryView} onSelect={(view) => { setSecondaryView(view); onDrawerOpenChange(false); }} onClose={() => onDrawerOpenChange(false)} onExit={onExit} />
    </div>
  );
}
