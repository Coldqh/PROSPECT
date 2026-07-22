import { useState } from "react";
import type { CollegeEntryRoute } from "../../sports/football/college/types";
import type { RecruitingActionId } from "../../sports/football/recruiting/types";
import type { CareerSave } from "../../storage/saves/schema";
import { SectionTabs } from "../ui/SectionTabs";
import { DecisionDayDashboard } from "./DecisionDayDashboard";
import { RecruitingDashboard } from "./RecruitingDashboard";
import { SeasonDashboard } from "./SeasonDashboard";

const views = [
  { id: "season", label: "Сезон" },
  { id: "recruiting", label: "Рекрутинг" },
  { id: "decision", label: "Решение" },
] as const;
type ViewId = (typeof views)[number]["id"];

interface CareerDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onOpenMatch(): void;
  onRecruitingAction(programId: string, actionId: RecruitingActionId): Promise<void>;
  onCommitToCollege(programId: string): Promise<void>;
  onWithdrawCommitment(): Promise<void>;
  onSignCollegeAgreement(programId: string, route: CollegeEntryRoute): Promise<void>;
  onReportToCollege(): Promise<void>;
}

export function CareerDashboard({
  save,
  mutating,
  actionError,
  onOpenMatch,
  onRecruitingAction,
  onCommitToCollege,
  onWithdrawCommitment,
  onSignCollegeAgreement,
  onReportToCollege,
}: CareerDashboardProps) {
  const [view, setView] = useState<ViewId>(save.football.season.phase === "complete" ? "decision" : "season");
  return (
    <div className="career-dashboard-shell">
      <SectionTabs<ViewId> tabs={views} active={view} onChange={setView} ariaLabel="Карьера и рекрутинг" />
      {view === "season" && <SeasonDashboard save={save} onOpenMatch={onOpenMatch} />}
      {view === "recruiting" && (
        <RecruitingDashboard
          save={save}
          mutating={mutating}
          {...(actionError ? { actionError } : {})}
          onAction={onRecruitingAction}
          onCommit={onCommitToCollege}
          onWithdrawCommitment={onWithdrawCommitment}
        />
      )}
      {view === "decision" && (
        <DecisionDayDashboard
          save={save}
          mutating={mutating}
          {...(actionError ? { actionError } : {})}
          onSign={onSignCollegeAgreement}
          onReportToCollege={onReportToCollege}
        />
      )}
    </div>
  );
}
