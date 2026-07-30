import { useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { ProfessionalCampApproach, ProfessionalEvaluationFocus, ProfessionalWeekFocus } from "../../sports/football/pro/types";
import type { MatchParticipationMode } from "../../sports/football/matches/types";
import { MatchDashboard } from "./MatchDashboard";
import { Icon } from "../ui/Icon";

interface ProfessionalTransitionDashboardProps {
  save: CareerSave;
  mutating: boolean;
  actionError?: string;
  onResolveDeclaration(optionId: "return-college" | "declare"): Promise<void>;
  onSelectAgent(agentId: string): Promise<void>;
  onCompleteEvaluation(focus: ProfessionalEvaluationFocus): Promise<void>;
  onRunDraft(): Promise<void>;
  onAcceptCampInvite(teamId: string): Promise<void>;
  onAdvanceCamp(approach: ProfessionalCampApproach): Promise<void>;
  onStartMatch(mode: MatchParticipationMode, analysisMode: boolean): Promise<void>;
  onResolveMatchDecision(optionId: string): Promise<void>;
  onFinalizeProfessionalMatch(): Promise<void>;
  onSetProfessionalWeekFocus(focus: ProfessionalWeekFocus): Promise<void>;
  onAdvanceProfessionalWeek(): Promise<void>;
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

function professionalFocusLabel(focus: ProfessionalWeekFocus): string {
  return { playbook: "Плейбук", technique: "Техника", recovery: "Восстановление", competition: "Конкуренция" }[focus];
}

function professionalFocusDetail(focus: ProfessionalWeekFocus): string {
  return {
    playbook: "Trust и назначение",
    technique: "OVR и форма",
    recovery: "Здоровье и допуск",
    competition: "Depth chart и риск",
  }[focus];
}

export function ProfessionalTransitionDashboard({
  save,
  mutating,
  actionError,
  onResolveDeclaration,
  onSelectAgent,
  onCompleteEvaluation,
  onRunDraft,
  onAcceptCampInvite,
  onAdvanceCamp,
  onStartMatch,
  onResolveMatchDecision,
  onFinalizeProfessionalMatch,
  onSetProfessionalWeekFocus,
  onAdvanceProfessionalWeek,
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
  const [matchOpen, setMatchOpen] = useState(false);
  const league = professional.league;
  const heroCareer = professional.heroCareer;
  const heroTeam = heroCareer?.teamId ? professional.teams.find((team) => team.id === heroCareer.teamId) : undefined;
  const activeGame = league.activeGameId ? league.schedule.find((game) => game.id === league.activeGameId) : undefined;
  const opponentId = activeGame && heroTeam ? (activeGame.homeTeamId === heroTeam.id ? activeGame.awayTeamId : activeGame.homeTeamId) : undefined;
  const opponent = opponentId ? professional.teams.find((team) => team.id === opponentId) : undefined;
  const heroCanPlay = professional.status === "roster" && heroCareer?.role !== "inactive";
  const matchBelongsToLeague = Boolean(activeGame && save.football.match.gameId === activeGame.id);
  const showMatch = matchBelongsToLeague && (matchOpen || save.football.match.status !== "upcoming");
  const activeProfessionalCareer = save.meta.phase === "professional-career"
    && ["roster", "practice-squad", "free-agent", "cut"].includes(professional.status);
  const professionalTeamLabel = heroTeam ? `${heroTeam.city} ${heroTeam.name}` : "FREE AGENT";

  if (showMatch) {
    return (
      <div className="professional-shell professional-match-shell">
        {save.football.match.status === "upcoming" && <button type="button" className="professional-back-button" onClick={() => setMatchOpen(false)}><Icon name="arrow-left" /> Сезон</button>}
        <MatchDashboard
          save={save}
          mutating={mutating}
          {...(actionError ? { actionError } : {})}
          onStartMatch={onStartMatch}
          onResolveDecision={onResolveMatchDecision}
          onFinalizeMatch={async () => { await onFinalizeProfessionalMatch(); setMatchOpen(false); }}
        />
      </div>
    );
  }


  return (
    <div className="professional-shell">
      <header className="elite-draft-header">
        <div className="elite-draft-header__title">
          <span className="elite-draft-shield">PRO</span>
          {activeProfessionalCareer ? (
            <div><small>{statusLabel(professional.status).toUpperCase()}</small><h1>{professionalTeamLabel}</h1><p>{league.seasonYear} · W{league.week}</p></div>
          ) : (
            <div><small>ПРОФЕССИОНАЛЬНЫЙ ДРАФТ</small><h1>{professional.draftYear}</h1><p>{statusLabel(professional.status)}</p></div>
          )}
        </div>
      </header>

      <section className="elite-draft-candidate">
        <div className="elite-draft-candidate__art" aria-hidden="true"><span>{initials(save.character.identity.fullName)}</span><strong>#{save.football.jerseyNumber}</strong></div>
        <div className="elite-draft-candidate__copy"><small>{activeProfessionalCareer ? professionalTeamLabel : save.football.college.program?.shortName ?? save.football.school.shortName}</small><h2>{save.character.identity.fullName}</h2><p>{save.football.position}</p><div>{activeProfessionalCareer ? <><span><small>Role</small><strong>{heroCareer?.role ?? "FA"}</strong></span><span><small>Depth</small><strong>{heroCareer?.depthRank ? `#${heroCareer.depthRank}` : "—"}</strong></span></> : <><span><small>Проекция</small><strong>{professional.projectedRange}</strong></span><span><small>OVR</small><strong>{Math.round(save.football.ratings.overall)}</strong></span></>}</div></div>
        {activeProfessionalCareer ? <div className={`professional-stock ${gradeClass(heroCareer?.coachTrust ?? 0)}`}><small>OVR</small><strong>{Math.round(save.football.ratings.overall)}</strong><span>TRUST {Math.round(heroCareer?.coachTrust ?? 0)}</span></div> : <div className={`professional-stock ${gradeClass(professional.draftStock)}`}><small>Draft stock</small><strong>{Math.round(professional.draftStock)}</strong><span>{professional.projectedRound ? `R${professional.projectedRound}` : "UDFA"}</span></div>}
      </section>

      <section className="professional-market-strip">
        {activeProfessionalCareer ? <><span><small>Record</small><strong>{heroTeam ? `${heroTeam.wins}–${heroTeam.losses}` : "—"}</strong></span><span><small>Games</small><strong>{heroCareer?.gamesPlayed ?? 0}</strong></span><span><small>Snaps</small><strong>{heroCareer?.snaps ?? 0}</strong></span><span><small>Health</small><strong>{Math.round(save.character.condition.health)}</strong></span></> : <><span><small>Класс</small><strong>#{heroRank || "—"}</strong></span><span><small>Клубы</small><strong>{professional.teams.length}</strong></span><span><small>Пики</small><strong>{professional.draftOrder.length}</strong></span><span><small>Позиция</small><strong>{save.football.position}</strong></span></>}
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
        <section className="professional-draft-stage">
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
        <section className="professional-season">
          <header className="professional-season__head">
            <div><small>{league.phase === "playoffs" ? "ПЛЕЙ-ОФФ" : league.phase === "complete" ? "СЕЗОН ЗАВЕРШЁН" : "РЕГУЛЯРНЫЙ СЕЗОН"}</small><h2>{league.seasonYear} · Неделя {league.week}</h2></div>
            <strong>{heroTeam ? `${heroTeam.wins}–${heroTeam.losses}` : "FA"}</strong>
          </header>

          {heroCareer?.weeklyPlan && league.phase !== "complete" && (
            <div className={`professional-week-plan${heroCareer.weeklyPlan.resolved ? " is-resolved" : ""}`}>
              <header><div><small>ПОДГОТОВКА НЕДЕЛИ</small><strong>{heroCareer.weeklyPlan.resolved ? professionalFocusLabel(heroCareer.weeklyPlan.focus) : "НЕ ВЫБРАНО"}</strong></div><span>W{league.week}</span></header>
              {!heroCareer.weeklyPlan.resolved ? <div>{(["playbook", "technique", "recovery", "competition"] as const).map((focus) => <button type="button" key={focus} disabled={mutating} onClick={() => void onSetProfessionalWeekFocus(focus)}><strong>{professionalFocusLabel(focus)}</strong><small>{professionalFocusDetail(focus)}</small></button>)}</div> : <section><footer><span>FORM {heroCareer.weeklyPlan.readinessDelta >= 0 ? "+" : ""}{heroCareer.weeklyPlan.readinessDelta}</span><span>TRUST {heroCareer.weeklyPlan.coachTrustDelta >= 0 ? "+" : ""}{heroCareer.weeklyPlan.coachTrustDelta}</span><span>HP {heroCareer.weeklyPlan.healthDelta >= 0 ? "+" : ""}{heroCareer.weeklyPlan.healthDelta}</span></footer></section>}
            </div>
          )}

          {activeGame && heroTeam && opponent && (
            <div className="professional-next-game">
              <div><small>{activeGame.playoffRound ? activeGame.playoffRound.toUpperCase() : `WEEK ${activeGame.week}`}</small><strong>{heroTeam.shortName} — {opponent.shortName}</strong><span>{heroCanPlay ? `${activeGame.date.month}/${activeGame.date.day} · ${opponent.wins}–${opponent.losses}` : heroCareer?.availability?.toUpperCase()}</span></div>
              {heroCanPlay && <button type="button" disabled={mutating} onClick={() => setMatchOpen(true)}><Icon name="football" /><span>Играть</span></button>}
            </div>
          )}

          {(professional.status === "free-agent" || professional.status === "cut") && professional.campInvites.length > 0 && (
            <div className="professional-free-agent-market">
              <header><small>ПРЕДЛОЖЕНИЯ</small><strong>Рынок свободных агентов</strong></header>
              {professional.campInvites.map((offer) => <button type="button" key={offer.teamId} disabled={mutating} onClick={() => void onAcceptFreeAgentOffer(offer.teamId)}><span>{offer.shortName}</span><div><strong>{offer.teamName}</strong><small>FIT {Math.round(offer.schemeFit)} · COMP {Math.round(offer.positionCompetition)}</small></div><em>{Math.round(offer.rosterOpportunity)}</em></button>)}
            </div>
          )}

          {league.phase !== "complete" && (!activeGame || !heroCanPlay) && professional.status !== "free-agent" && professional.status !== "cut" && (
            <button type="button" className="primary-action-bar" disabled={mutating} onClick={() => void onAdvanceProfessionalWeek()}>
              <span><strong>{mutating ? "РАСЧЁТ…" : "ЗАВЕРШИТЬ НЕДЕЛЮ"}</strong></span><Icon name="arrow-right" />
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
