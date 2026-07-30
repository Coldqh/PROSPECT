import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { EcosystemMarketNegotiation, EcosystemPlayer, EcosystemTransaction } from "../../sports/football/ecosystem/types";
import { candidateKindLabel, getCoachTransactions, getMarketTransactions, getPositionPressure, promiseRoleLabel, vacancyStatusLabel } from "../../sports/football/ecosystem/visibility";
import { Icon } from "../ui/Icon";
import { EcosystemPlayerProfile } from "./EcosystemPlayerProfile";

type MarketView = "movement" | "coaches" | "positions";
type MarketFilter = "all" | "offers" | "transfers" | "commitments";

interface MarketDashboardProps {
  save: CareerSave;
  mutating?: boolean;
  actionError?: string;
  onOpenTeam?: (teamId: string) => void;
  onResolveCollegeDecision?: (optionId: string) => Promise<void>;
}

const views: readonly { id: MarketView; label: string }[] = [
  { id: "movement", label: "Игроки" },
  { id: "coaches", label: "Тренеры" },
  { id: "positions", label: "Позиции" },
];
const filters: readonly { id: MarketFilter; label: string }[] = [
  { id: "all", label: "Все" }, { id: "offers", label: "Офферы" }, { id: "transfers", label: "Портал" }, { id: "commitments", label: "Коммиты" },
];

function transactionGroup(kind: EcosystemTransaction["kind"]): MarketFilter {
  if (kind === "offer-issued" || kind === "offer-withdrawn") return "offers";
  if (kind === "portal-entry" || kind === "transfer") return "transfers";
  if (["commitment", "recruit-enrolled", "talent-enrolled", "juco-entry", "walk-on-entry"].includes(kind)) return "commitments";
  return "all";
}

function transactionCode(kind: EcosystemTransaction["kind"]): string {
  return ({
    "portal-entry": "PORT", transfer: "MOVE", graduation: "GRAD", "recruit-enrolled": "ENRL", "juco-entry": "JUCO", "walk-on-entry": "WALK",
    "talent-enrolled": "SIGN", "position-change": "POS", "scholarship-awarded": "SCH", "redshirt-assigned": "RS", "offer-issued": "OFFR",
    "offer-withdrawn": "OUT", commitment: "COM", "coach-fired": "FIRE", "coach-hired": "HIRE", "coach-vacancy": "OPEN", "tactical-change": "SYS", "scheme-fit": "FIT",
  } as Partial<Record<EcosystemTransaction["kind"], string>>)[kind] ?? "MOVE";
}

function negotiationStatus(item: EcosystemMarketNegotiation): string {
  if (item.status === "offered") return `до W${item.expiresWeek}`;
  if (item.status === "accepted") return "принят";
  if (item.status === "withdrawn") return "отозван";
  return "истёк";
}

export function MarketDashboard({ save, mutating = false, actionError, onOpenTeam, onResolveCollegeDecision }: MarketDashboardProps) {
  const [view, setView] = useState<MarketView>("movement");
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [selectedPlayer, setSelectedPlayer] = useState<EcosystemPlayer>();
  const world = save.world;
  const playerTransactions = useMemo(() => getMarketTransactions(world), [world]);
  const coachTransactions = useMemo(() => getCoachTransactions(world), [world]);
  const positionPressure = useMemo(() => getPositionPressure(world), [world]);
  const negotiations = useMemo(() => world.movementMarket.negotiations.slice().sort((left, right) => Number(right.status === "offered") - Number(left.status === "offered") || right.createdWeek - left.createdWeek || right.score - left.score), [world.movementMarket.negotiations]);
  const visibleTransactions = filter === "all" ? playerTransactions : playerTransactions.filter((item) => transactionGroup(item.kind) === filter);
  const heroCareer = save.football.college.heroCareer;
  const heroDecision = heroCareer?.pendingDecision;
  const heroInPortal = heroCareer?.transferIntent === "portal" || world.players.some((player) => player.isHero && player.transferStatus === "portal");

  function teamName(teamId?: string): string {
    if (!teamId) return "Свободный рынок";
    return world.teams.find((team) => team.id === teamId)?.shortName ?? teamId;
  }

  function openTransaction(item: EcosystemTransaction) {
    const player = item.playerId ? world.players.find((candidate) => candidate.id === item.playerId) : undefined;
    if (player) return setSelectedPlayer(player);
    const teamId = item.toTeamId ?? item.fromTeamId;
    if (teamId) onOpenTeam?.(teamId);
  }

  return (
    <div className="market-dashboard">
      <header className="market-dashboard__head"><div><small>{world.phase === "offseason" ? "МЕЖСЕЗОНЬЕ" : `W${world.seasonWeek}`}</small><h1>Рынок</h1></div><strong>{world.seasonYear}</strong></header>
      <section className="market-dashboard__metrics">
        <article><small>Активные офферы</small><strong>{world.market.activeNegotiations}</strong></article>
        <article><small>Игроки в портале</small><strong>{world.market.portalPlayers}</strong></article>
        <article><small>Места в классах</small><strong>{world.market.plannedClassSpots}</strong></article>
        <article><small>Вакансии штабов</small><strong>{world.market.coachOpenings}</strong></article>
      </section>

      {heroCareer && (
        <section className={`market-hero ${heroInPortal ? "is-portal" : ""}`}>
          <header><div><small>ТВОЙ СТАТУС</small><strong>{heroInPortal ? "Трансферный портал" : heroCareer.transferIntent === "open" ? "Изучение вариантов" : "Остаётся в программе"}</strong></div><span>{heroCareer.transferOffers.length} предложений</span></header>
          {heroDecision && (heroDecision.kind === "transfer-window" || heroDecision.kind === "transfer-destination") ? (
            <div className="market-hero__actions"><p>{heroDecision.detail}</p>{heroDecision.options.map((option) => <button type="button" key={option.id} disabled={mutating || !onResolveCollegeDecision} onClick={() => void onResolveCollegeDecision?.(option.id)}><span><strong>{option.label}</strong><small>{option.detail}</small></span><Icon name="arrow-right" size={16} /></button>)}</div>
          ) : heroCareer.transferOffers.length > 0 ? (
            <div className="market-hero__offers">{heroCareer.transferOffers.map((offer) => <button type="button" key={offer.teamId} onClick={() => onOpenTeam?.(offer.teamId)}><span><strong>{offer.teamName}</strong><small>{offer.projectedRole} · FIT {Math.round(offer.schemeFit)}</small></span><em>{offer.scholarship ? "FULL" : "PWO"}</em></button>)}</div>
          ) : null}
          {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
        </section>
      )}

      <nav className="market-dashboard__tabs" aria-label="Рынок">{views.map((item) => <button type="button" key={item.id} className={view === item.id ? "is-active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>

      {view === "movement" && <>
        <div className="market-dashboard__filters">{filters.map((item) => <button type="button" key={item.id} className={filter === item.id ? "is-active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
        {(filter === "all" || filter === "offers") && <section className="market-section"><header><h2>Переговоры</h2><span>{negotiations.filter((item) => item.status === "offered").length} активных</span></header><div className="market-list">
          {negotiations.slice(0, filter === "offers" ? 40 : 12).map((item) => <button type="button" key={item.id} onClick={() => onOpenTeam?.(item.teamId)}><span className={`market-list__code is-${item.status}`}>{item.position}</span><div><strong>{item.candidateName}</strong><small>{teamName(item.teamId)} · {candidateKindLabel(item.candidateKind)} · {promiseRoleLabel(item.promisedRole)}</small></div><em>{negotiationStatus(item)}</em></button>)}
          {negotiations.length === 0 && <div className="data-empty">Активных переговоров нет</div>}
        </div></section>}
        <section className="market-section"><header><h2>Движение игроков</h2><span>{visibleTransactions.length}</span></header><div className="market-list">
          {visibleTransactions.map((item) => <button type="button" key={item.id} onClick={() => openTransaction(item)}><span className="market-list__code">{transactionCode(item.kind)}</span><div><strong>{item.title}</strong><small>{teamName(item.fromTeamId)} → {teamName(item.toTeamId)} · W{item.week}</small></div><Icon name="arrow-right" size={15} /></button>)}
          {visibleTransactions.length === 0 && <div className="data-empty">Событий этого типа пока нет</div>}
        </div></section>
      </>}

      {view === "coaches" && <>
        <section className="market-section"><header><h2>Вакансии</h2><span>{world.movementMarket.coachVacancies.filter((item) => item.status === "open").length} открытых</span></header><div className="market-list">
          {world.movementMarket.coachVacancies.slice().reverse().map((vacancy) => <button type="button" key={vacancy.id} onClick={() => onOpenTeam?.(vacancy.teamId)}><span className={`market-list__code is-${vacancy.status}`}>HC</span><div><strong>{teamName(vacancy.teamId)}</strong><small>{vacancy.reason} · ${vacancy.salaryBudget.toFixed(1)}M</small></div><em>{vacancyStatusLabel(vacancy.status)}</em></button>)}
          {world.movementMarket.coachVacancies.length === 0 && <div className="data-empty">Вакансий пока нет</div>}
        </div></section>
        <section className="market-section"><header><h2>Карусель штабов</h2><span>{coachTransactions.length}</span></header><div className="market-list">
          {coachTransactions.map((item) => <button type="button" key={item.id} onClick={() => { const id = item.toTeamId ?? item.fromTeamId; if (id) onOpenTeam?.(id); }}><span className="market-list__code">{transactionCode(item.kind)}</span><div><strong>{item.title}</strong><small>W{item.week}</small></div><Icon name="arrow-right" size={15} /></button>)}
          {coachTransactions.length === 0 && <div className="data-empty">Штабы пока стабильны</div>}
        </div></section>
      </>}

      {view === "positions" && <section className="market-section"><header><h2>Давление по позициям</h2><span>Колледжи</span></header><div className="market-position-grid">{positionPressure.map((item) => <article key={item.position}><header><strong>{item.position}</strong><span>{item.openings} мест</span></header><div><small>Планируют добавить</small><b>{item.targetAdds}</b></div><div><small>Активные офферы</small><b>{item.activeOffers}</b></div></article>)}</div></section>}

      <EcosystemPlayerProfile save={save} player={selectedPlayer} onClose={() => setSelectedPlayer(undefined)} {...(onOpenTeam ? { onOpenTeam } : {})} />
    </div>
  );
}
