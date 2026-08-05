import type { CareerSave } from "../../storage/saves/schema";
import type { ProfessionalCampApproach, ProfessionalEvaluationFocus } from "../../sports/football/pro/types";
import { Icon } from "../ui/Icon";
import { ManagerPageHeader } from "./ManagerPageHeader";
import { WeeklyReportPanel } from "./WeeklyReportPanel";
import type { WeeklyReport } from "../../application/career/weekly/types";

interface ProfessionalTransitionDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  weeklyReport?: WeeklyReport;
  onAdvanceWeek(): Promise<void>;
  onResolveDeclaration(optionId: "return-college" | "declare"): Promise<void>;
  onSelectAgent(agentId: string): Promise<void>;
  onCompleteEvaluation(focus: ProfessionalEvaluationFocus): Promise<void>;
  onRunDraft(): Promise<void>;
  onAcceptCampInvite(teamId: string): Promise<void>;
  onAdvanceCamp(approach: ProfessionalCampApproach): Promise<void>;
  onAdvanceProfessionalOffseason(): Promise<void>;
  onAcceptFreeAgentOffer(teamId: string): Promise<void>;
}

function money(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  return `$${Math.round(value / 1_000)}K`;
}

function statusLabel(status: CareerSave["football"]["professional"]["status"]): string {
  return {
    dormant: "Подготовка",
    decision: "Решение",
    "agent-selection": "Выбор агента",
    evaluation: "Combine",
    "draft-ready": "Драфт",
    drafted: "Выбран",
    undrafted: "Свободный агент",
    "training-camp": "Лагерь",
    roster: "Активный состав",
    "practice-squad": "Тренировочный состав",
    "free-agent": "Свободный агент",
    cut: "Отчислен",
  }[status];
}


function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function gradeClass(value: number): string {
  return value >= 82 ? "is-elite" : value >= 68 ? "is-solid" : "is-risk";
}

export function ProfessionalTransitionDashboard({
  save,
  mutating,
  actionError,
  weeklyReport,
  onAdvanceWeek,
  onResolveDeclaration,
  onSelectAgent,
  onCompleteEvaluation,
  onRunDraft,
  onAcceptCampInvite,
  onAdvanceCamp,
  onAdvanceProfessionalOffseason,
  onAcceptFreeAgentOffer,
}: ProfessionalTransitionDashboardProps) {
  const professional = save.football.professional;
  const selectedAgent = professional.agents.find((agent) => agent.id === professional.selectedAgentId);
  const selectedTeamId = professional.heroSelection?.teamId ?? professional.contract?.teamId ?? professional.camp?.teamId;
  const selectedTeam = professional.teams.find((team) => team.id === selectedTeamId);
  const heroRank = professional.prospects.findIndex((prospect) => prospect.isHero) + 1;
  const topProspects = professional.prospects.slice(0, 8);
  const recentDraft = professional.draftResults.filter((pick) => pick.round <= 2).slice(0, 12);
  const league = professional.league;
  const heroCareer = professional.heroCareer;
  const heroTeam = heroCareer?.teamId ? professional.teams.find((team) => team.id === heroCareer.teamId) : undefined;
  const activeGame = league.activeGameId ? league.schedule.find((game) => game.id === league.activeGameId) : undefined;
  const opponentId = activeGame && heroTeam ? (activeGame.homeTeamId === heroTeam.id ? activeGame.awayTeamId : activeGame.homeTeamId) : undefined;
  const opponent = opponentId ? professional.teams.find((team) => team.id === opponentId) : undefined;
  const heroCanPlay = professional.status === "roster" && heroCareer?.role !== "inactive";
  const activeProfessionalCareer = save.meta.phase === "professional-career"
    && ["roster", "practice-squad", "free-agent", "cut"].includes(professional.status);
  const professionalTeamLabel = heroTeam ? `${heroTeam.city} ${heroTeam.name}` : "FREE AGENT";

  return (
    <div className="professional-shell">
      <ManagerPageHeader
        eyebrow={activeProfessionalCareer ? `${statusLabel(professional.status).toUpperCase()} · НЕДЕЛЯ ${league.week}` : `ПРОФЕССИОНАЛЬНЫЙ ДРАФТ · ${professional.draftYear}`}
        title={activeProfessionalCareer ? professionalTeamLabel : statusLabel(professional.status)}
        subtitle={activeProfessionalCareer ? `${league.seasonYear} · ${heroCareer?.role ?? "free agent"} · ${save.football.position}` : `${save.football.college.program?.shortName ?? save.football.school.shortName} · ${save.football.position} · ${professional.projectedRange}`}
        badge="PRO"
        metrics={activeProfessionalCareer ? [
          { label: "Рекорд", value: heroTeam ? `${heroTeam.wins}–${heroTeam.losses}` : "—" },
          { label: "Игры", value: heroCareer?.gamesPlayed ?? 0 },
          { label: "Снэпы", value: heroCareer?.snaps ?? 0 },
          { label: "Здоровье", value: Math.round(save.character.condition.health), tone: save.character.condition.health >= 75 ? "positive" : "warning" },
        ] : [
          { label: "Big board", value: heroRank ? `#${heroRank}` : "—" },
          { label: "Draft stock", value: Math.round(professional.draftStock), tone: professional.draftStock >= 75 ? "positive" : "warning" },
          { label: "Раунд", value: professional.projectedRound ? `R${professional.projectedRound}` : "UDFA" },
          { label: "OVR", value: Math.round(save.football.ratings.overall) },
        ]}
      />

      <section className="pro-player-banner">
        <div className="pro-player-banner__portrait" aria-hidden="true">
          <span>{initials(save.character.identity.fullName)}</span>
          <strong>#{save.football.jerseyNumber}</strong>
        </div>
        <div className="pro-player-banner__identity">
          <small>{activeProfessionalCareer ? professionalTeamLabel : save.football.college.program?.shortName ?? save.football.school.shortName}</small>
          <h2>{save.character.identity.fullName}</h2>
          <p>{save.football.position} · {activeProfessionalCareer ? statusLabel(professional.status) : professional.projectedRange}</p>
          <div>
            <span><small>{activeProfessionalCareer ? "Роль" : "Проекция"}</small><strong>{activeProfessionalCareer ? heroCareer?.role ?? "FA" : professional.projectedRange}</strong></span>
            <span><small>{activeProfessionalCareer ? "Depth" : "Агент"}</small><strong>{activeProfessionalCareer ? heroCareer?.depthRank ? `#${heroCareer.depthRank}` : "—" : selectedAgent?.name ?? "Не выбран"}</strong></span>
          </div>
        </div>
        <div className={`pro-player-banner__grade ${gradeClass(activeProfessionalCareer ? heroCareer?.coachTrust ?? 0 : professional.draftStock)}`}>
          <small>{activeProfessionalCareer ? "OVR" : "STOCK"}</small>
          <strong>{Math.round(activeProfessionalCareer ? save.football.ratings.overall : professional.draftStock)}</strong>
          <span>{activeProfessionalCareer ? `TRUST ${Math.round(heroCareer?.coachTrust ?? 0)}` : professional.projectedRound ? `ROUND ${professional.projectedRound}` : "UDFA"}</span>
        </div>
      </section>

      {professional.status === "decision" && (
        <section className="professional-decision">
          <small>КАРЬЕРНОЕ РЕШЕНИЕ</small>
          <h2>Декларация</h2>
          <div>
            {save.football.college.heroCareer && save.football.college.heroCareer.eligibilityYears > 0 && save.football.college.heroCareer.status !== "complete" && (
              <button type="button" disabled={mutating} onClick={() => void onResolveDeclaration("return-college")}>
                <Icon name="history" /><span><strong>Вернуться в колледж</strong><small>Eligibility {save.football.college.heroCareer?.eligibilityYears ?? 0}</small></span>
              </button>
            )}
            <button type="button" className="is-primary" disabled={mutating} onClick={() => void onResolveDeclaration("declare")}>
              <Icon name="arrow-right" /><span><strong>Подать декларацию</strong><small>Draft {professional.draftYear}</small></span>
            </button>
          </div>
        </section>
      )}

      {professional.status === "agent-selection" && (
        <section className="professional-section">
          <header><div><small>ПРЕДСТАВИТЕЛЬ</small><h2>Агенты</h2></div></header>
          <div className="professional-agent-grid">
            {professional.agents.map((agent) => (
              <button type="button" key={agent.id} disabled={mutating} onClick={() => void onSelectAgent(agent.id)}>
                <div><small>{agent.agency}</small><strong>{agent.name}</strong></div>
                <section><span><small>Доступ</small><b>{agent.teamAccess}</b></span><span><small>Сделки</small><b>{agent.negotiation}</b></span><span><small>Медиа</small><b>{agent.mediaReach}</b></span><span><small>Риск</small><b>{agent.risk}</b></span><span><small>Комиссия</small><b>{agent.commission}%</b></span></section>
              </button>
            ))}
          </div>
        </section>
      )}

      {professional.status === "evaluation" && selectedAgent && (
        <section className="professional-section">
          <header><div><small>{selectedAgent.name.toUpperCase()}</small><h2>Combine · Pro Day</h2></div></header>
          <div className="professional-focus-grid">
            <button type="button" disabled={mutating} onClick={() => void onCompleteEvaluation("athletic")}><Icon name="bolt" /><strong>Атлетизм</strong><small>40 · SHUT · VERT</small></button>
            <button type="button" disabled={mutating} onClick={() => void onCompleteEvaluation("technical")}><Icon name="target" /><strong>Техника</strong><small>DRILL · TEC</small></button>
            <button type="button" disabled={mutating} onClick={() => void onCompleteEvaluation("interview")}><Icon name="message" /><strong>Интервью</strong><small>INT · IQ</small></button>
          </div>
        </section>
      )}

      {professional.evaluation && (
        <section className="professional-combine-card">
          <header><div><small>РЕЗУЛЬТАТ ОЦЕНКИ</small><h2>{professional.evaluation.overallScore.toFixed(1)}</h2></div><strong className={professional.evaluation.stockDelta >= 0 ? "is-positive" : "is-negative"}>{professional.evaluation.stockDelta >= 0 ? "+" : ""}{professional.evaluation.stockDelta.toFixed(1)}</strong></header>
          <div>
            <span><small>40 yd</small><strong>{professional.evaluation.fortyYard}s</strong></span>
            <span><small>Shuttle</small><strong>{professional.evaluation.shuttle}s</strong></span>
            <span><small>Vertical</small><strong>{professional.evaluation.vertical}″</strong></span>
            <span><small>Bench</small><strong>{professional.evaluation.benchReps}</strong></span>
            <span><small>Drills</small><strong>{Math.round(professional.evaluation.positionDrill)}</strong></span>
            <span><small>Interview</small><strong>{Math.round(professional.evaluation.interview)}</strong></span>
          </div>
        </section>
      )}

      {professional.status === "draft-ready" && (
        <section className="professional-draft-stage professional-draft-stage--manager">
          <div className="professional-board">
            <header><small>BIG BOARD</small><h2>Верхушка класса</h2></header>
            {topProspects.map((prospect, index) => (
              <article key={prospect.id} className={prospect.isHero ? "is-hero" : ""}>
                <span>{index + 1}</span><div><strong>{prospect.name}</strong><small>{prospect.position} · {prospect.collegeName}</small></div><em>{Math.round(prospect.draftGrade)}</em>
              </article>
            ))}
          </div>
          <button type="button" className="primary-action-bar" disabled={mutating} onClick={() => void onRunDraft()}>
            <span><small>7 раундов · 112 выборов</small><strong>{mutating ? "Клубы выбирают…" : "Начать драфт"}</strong></span><Icon name="arrow-right" />
          </button>
        </section>
      )}

      {(professional.status === "drafted" || professional.status === "undrafted") && (
        <section className="professional-section">
          <header><div><small>{professional.status === "drafted" ? "ROOKIE CONTRACT" : "UNDRAFTED FREE AGENCY"}</small><h2>{professional.heroSelection ? `Выбор №${professional.heroSelection.overallPick}` : "UDFA"}</h2></div></header>
          {professional.contract && (
            <div className="professional-contract-card">
              <div><small>{professional.contract.teamName}</small><strong>{money(professional.contract.totalValue)}</strong><span>{professional.contract.years} года</span></div>
              <section><span><small>Гарантии</small><b>{money(professional.contract.guaranteed)}</b></span><span><small>Бонус</small><b>{money(professional.contract.signingBonus)}</b></span><span><small>Агент</small><b>{money(professional.contract.agentFee)}</b></span></section>
            </div>
          )}
          <div className="professional-invite-list">
            {professional.campInvites.map((invite) => (
              <button type="button" key={invite.teamId} disabled={mutating} onClick={() => void onAcceptCampInvite(invite.teamId)}>
                <span>{invite.shortName}</span><div><strong>{invite.teamName}</strong><small>FIT {Math.round(invite.schemeFit)} · COMP {Math.round(invite.positionCompetition)} · ${Math.round(invite.signingBonus / 1000)}K</small></div><em>{Math.round(invite.rosterOpportunity)}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {professional.status === "training-camp" && professional.camp && selectedTeam && (
        <section className="professional-section professional-camp">
          <header><div><small>{selectedTeam.shortName} TRAINING CAMP</small><h2>День {professional.camp.day} / {professional.camp.totalDays}</h2></div><strong>#{professional.camp.rosterRank} · TRUST {Math.round(professional.camp.coachTrust)}</strong></header>
          <div className="professional-camp-track">
            {Array.from({ length: professional.camp.totalDays }, (_, index) => <span key={index} className={index < professional.camp!.sessions.length ? "is-complete" : index === professional.camp!.sessions.length ? "is-current" : ""}>{index + 1}</span>)}
          </div>
          <div className="professional-focus-grid">
            <button type="button" disabled={mutating} onClick={() => void onAdvanceCamp("controlled")}><Icon name="shield" /><strong>Контроль</strong><small>RISK − · CEIL −</small></button>
            <button type="button" disabled={mutating} onClick={() => void onAdvanceCamp("balanced")}><Icon name="target" /><strong>Баланс</strong><small>RISK = · CEIL =</small></button>
            <button type="button" disabled={mutating} onClick={() => void onAdvanceCamp("aggressive")}><Icon name="flame" /><strong>Атака</strong><small>RISK + · CEIL +</small></button>
          </div>
          {professional.camp.sessions.length > 0 && (
            <div className="professional-camp-log">{[...professional.camp.sessions].reverse().map((session) => <article key={session.id}><span>{session.grade}</span><div><strong>День {session.day} · {session.approach}</strong><small>HP {session.healthDelta >= 0 ? "+" : ""}{session.healthDelta} · TRUST {session.coachTrustDelta >= 0 ? "+" : ""}{session.coachTrustDelta}</small></div><em>{Math.round(session.performance)}</em></article>)}</div>
          )}
        </section>
      )}

      {save.meta.phase === "professional-career" && (
        <section className="professional-season professional-season--manager">
          <header className="professional-season__head">
            <div><small>{league.phase === "playoffs" ? "ПЛЕЙ-ОФФ" : league.phase === "complete" ? "СЕЗОН ЗАВЕРШЁН" : "РЕГУЛЯРНЫЙ СЕЗОН"}</small><h2>{league.seasonYear} · Неделя {league.week}</h2></div>
            <strong>{heroTeam ? `${heroTeam.wins}–${heroTeam.losses}` : "FA"}</strong>
          </header>

          <WeeklyReportPanel report={weeklyReport} />

          {heroCareer?.weeklyPlan && league.phase !== "complete" && (
            <section className="weekly-composition-card weekly-composition-card--professional">
              <header><small>АВТОМАТИЧЕСКАЯ ПОДГОТОВКА</small><strong>{heroCareer.weeklyPlan.focus}</strong><span>W{league.week}</span></header>
              <div><article><small>Роль</small><strong>{heroCareer.role}</strong></article><article><small>Depth</small><strong>#{heroCareer.depthRank}</strong></article><article><small>Trust</small><strong>{Math.round(heroCareer.coachTrust)}</strong></article><article><small>Допуск</small><strong>{heroCareer.availability}</strong></article></div>
              <p>Штаб сам выбирает нагрузку, готовит игрока и проводит матч внутри недельного расчёта.</p>
            </section>
          )}

          {activeGame && heroTeam && opponent && (
            <div className="professional-next-game">
              <div><small>{activeGame.playoffRound ? activeGame.playoffRound.toUpperCase() : `WEEK ${activeGame.week}`}</small><strong>{heroTeam.shortName} — {opponent.shortName}</strong><span>{heroCanPlay ? `${activeGame.date.month}/${activeGame.date.day} · ${opponent.wins}–${opponent.losses}` : heroCareer?.availability?.toUpperCase()}</span></div>
            </div>
          )}

          {(professional.status === "free-agent" || professional.status === "cut") && professional.campInvites.length > 0 && (
            <div className="professional-free-agent-market">
              <header><small>ПРЕДЛОЖЕНИЯ</small><strong>Рынок свободных агентов</strong></header>
              {professional.campInvites.map((offer) => <button type="button" key={offer.teamId} disabled={mutating} onClick={() => void onAcceptFreeAgentOffer(offer.teamId)}><span>{offer.shortName}</span><div><strong>{offer.teamName}</strong><small>FIT {Math.round(offer.schemeFit)} · COMP {Math.round(offer.positionCompetition)}</small></div><em>{Math.round(offer.rosterOpportunity)}</em></button>)}
            </div>
          )}

          {league.phase !== "complete" && professional.status !== "free-agent" && professional.status !== "cut" && (
            <button type="button" className="primary-action-bar weekly-advance-button" disabled={mutating} onClick={() => void onAdvanceWeek()}>
              <span><small>Подготовка · лига · матч</small><strong>{mutating ? "РАСЧЁТ НЕДЕЛИ…" : "ПРОДОЛЖИТЬ НЕДЕЛЮ"}</strong></span><Icon name="arrow-right" />
            </button>
          )}
          {league.phase === "complete" && (
            <button type="button" className="primary-action-bar" disabled={mutating} onClick={() => void onAdvanceProfessionalOffseason()}>
              <span><strong>{mutating ? "РАСЧЁТ…" : `СЕЗОН ${league.seasonYear + 1}`}</strong></span><Icon name="arrow-right" />
            </button>
          )}
        </section>
      )}

      {!activeProfessionalCareer && recentDraft.length > 0 && (
        <section className="professional-draft-feed">
          <header><small>ПЕРВЫЕ РАУНДЫ</small><h2>Драфт</h2></header>
          {recentDraft.map((pick) => {
            const team = professional.teams.find((item) => item.id === pick.teamId);
            return <article key={pick.id} className={pick.isHero ? "is-hero" : ""}><span>{pick.overallPick}</span><div><strong>{pick.prospectName}</strong><small>{team?.shortName} · {pick.position} · {pick.collegeName}</small></div><em>R{pick.round}</em></article>;
          })}
        </section>
      )}

      {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
    </div>
  );
}
