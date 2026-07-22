import { useState } from "react";
import type { RecruitingActionId } from "../../sports/football/recruiting/types";
import type { CareerSave } from "../../storage/saves/schema";
import { SectionTabs } from "../ui/SectionTabs";
import { RecruitingDashboard } from "./RecruitingDashboard";
import { SeasonDashboard } from "./SeasonDashboard";

const views = [
  { id: "season", label: "Сезон" },
  { id: "recruiting", label: "Рекрутинг" },
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
}

export function CareerDashboard({ save, mutating, actionError, onOpenMatch, onRecruitingAction, onCommitToCollege, onWithdrawCommitment }: CareerDashboardProps) {
  const [view, setView] = useState<ViewId>("season");
  return (
    <div className="career-dashboard-shell">
      <SectionTabs<ViewId> tabs={views} active={view} onChange={setView} ariaLabel="Карьера и рекрутинг" />
      {view === "season" ? (
        <SeasonDashboard save={save} onOpenMatch={onOpenMatch} />
      ) : (
        <RecruitingDashboard save={save} mutating={mutating} {...(actionError ? { actionError } : {})} onAction={onRecruitingAction} onCommit={onCommitToCollege} onWithdrawCommitment={onWithdrawCommitment} />
      )}
    </div>
  );
}
