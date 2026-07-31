import { useMemo, useState } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import type { EcosystemMarketNegotiation, EcosystemPlayer, EcosystemTransaction } from "../../sports/football/ecosystem/types";
import { candidateKindLabel, getCoachTransactions, getMarketTransactions, promiseRoleLabel, vacancyStatusLabel } from "../../sports/football/ecosystem/visibility";
import { Icon } from "../ui/Icon";
import { EcosystemPlayerProfile } from "./EcosystemPlayerProfile";

type MarketView = "overview" | "players" | "coaches";
type PlayerFilter = "all" | "portal" | "offers" | "signed";

interface MarketDashboardProps {
  save: CareerSave;
  mutating?: boolean;
  actionError?: string;
  onOpenTeam?: (teamId: string) => void;
  onResolveCollegeDecision?: (optionId: string) => Promise<void>;
}

function transactionGroup(kind: EcosystemTransaction["kind"]): PlayerFilter {
  if (kind === "portal-entry" || kind === "transfer") return "portal";
  if (kind === "offer-issued" || kind === "offer-withdrawn") return "offers";
  if (["commitment", "recruit-enrolled", "talent-enrolled", "juco-entry", "walk-on-entry"].includes(kind)) return "signed";
  return "all";
}

function transactionLabel(kind: EcosystemTransaction["kind"]): string {
  return ({
    "portal-entry": "Вышел в портал",
    transfer: "Сменил программу",
    graduation: "Завершил колледж",
    "recruit-enrolled": "Прибыл в программу",
    "juco-entry": "Выбрал маршрут JUCO",
    "walk-on-entry": "Пришёл без стипендии",
    "talent-enrolled": "Подписал соглашение",
    "position-change": "Сменил позицию",
    "scholarship-awarded": "Получил стипендию",
    "redshirt-assigned": "Получил redshirt",
    "offer-issued": "Получил оффер",
    "offer-withdrawn": "Оффер отозван",
    commitment: "Сделал коммит",
    "coach-fired": "Тренер уволен",
    "coach-hired": "Тренер нанят",
    "coach-vacancy": "Открыта вакансия",
    "tactical-change": "Изменена система",
    "scheme-fit": "Пересмотрена схема",
  } as Partial<Record<EcosystemTransaction["kind"], string>>)[kind] ?? "Изменение состава";
}

function negotiationStatus(item: EcosystemMarketNegotiation): string {
  if (item.status === "offered") return `Решение до недели ${item.expiresWeek}`;
  if (item.status === "accepted") return "Предложение принято";
  if (item.status === "withdrawn") return "Предложение отозвано";
  return "Срок предложения истёк";
}

function negotiationTone(item: EcosystemMarketNegotiation): string {
  if (item.status === "accepted") return "is-positive";
  if (item.status === "offered") return "is-active";
  return "is-muted";
}

export function MarketDashboard({ save, mutating = false, actionError, onOpenTeam, onResolveCollegeDecision }: MarketDashboardProps) {
  const [view, setView] = useState<MarketView>("overview");
  const [filter, setFilter] = useState<PlayerFilter>("all");
  const [selectedPlayer, setSelectedPlayer] = useState<EcosystemPlayer>();
  const world = save.world;
  const playerTransactions = useMemo(() => getMarketTransactions(world), [world]);
  const coachTransactions = useMemo(() => getCoachTransactions(world), [world]);
  const negotiations = useMemo(() => world.movementMarket.negotiations.slice().sort((left, right) => Number(right.status === "offered") - Number(left.status === "offered") || right.createdWeek - left.createdWeek || right.score - left.score), [world.movementMarket.negotiations]);
  const openings = useMemo(() => world.movementMarket.openings
    .filter((item) => item.status === "open")
    .map((item) => ({ item, remaining: Math.max(0, item.slots - item.filledByCandidateIds.length) }))
    .filter(({ remaining }) => remaining > 0)
    .sort((left, right) => right.remaining - left.remaining || right.item.recruitingAvailable - left.item.recruitingAvailable), [world.movementMarket.openings]);
  const visibleTransactions = filter === "all" ? playerTransactions : playerTransactions.filter((item) => transactionGroup(item.kind) === filter);
  const latestMoves = playerTransactions.slice(0, 8);
  const heroCareer = save.football.college.heroCareer;
  const heroDecision = heroCareer?.pendingDecision;
  const heroInPortal = heroCareer?.transferIntent === "portal" || world.players.some((player) => player.isHero && player.transferStatus === "portal");
  const activeOffers = negotiations.filter((item) => item.status === "offered");
  const activeVacancies = world.movementMarket.coachVacancies.filter((item) => item.status === "open");
  const marketDigest = [...world.movementMarket.digest].slice(-4).reverse();

  function teamName(teamId?: string): string {
    if (!teamId) return "Без команды";
    return world.teams.find((team) => team.id === teamId)?.shortName ?? teamId;
  }

  function openTransaction(item: EcosystemTransaction) {
    const player = item.playerId ? world.players.find((candidate) => candidate.id === item.playerId) : undefined;
    if (player) return setSelectedPlayer(player);
    const teamId = item.toTeamId ?? item.fromTeamId;
    if (teamId) onOpenTeam?.(teamId);
  }

  return (
    <div className="market-hub">
      <header className="market-hub__head">
        <div><small>{world.phase === "offseason" ? "ТРАНСФЕРНОЕ ОКНО" : `НЕДЕЛЯ ${world.seasonWeek}`}</small><h1>Движение мира</h1></div>
        <span>{world.seasonYear}</span>
      </header>

      <section className="market-hub__brief">
        <div><strong>{activeOffers.length} активных предложений</strong><p>{world.market.portalPlayers} игроков находятся в портале, {openings.reduce((sum, item) => sum + item.remaining, 0)} мест остаются открытыми.</p></div>
        <div className="market-hub__brief-counts"><span><strong>{latestMoves.length}</strong><small>последних движений</small></span><span><strong>{activeVacancies.length}</strong><small>вакансий штабов</small></span></div>
      </section>

      {heroCareer && (
        <section className={`market-hub__hero ${heroInPortal ? "is-portal" : ""}`}>
          <header><div><small>ТВОЯ СИТУАЦИЯ</small><strong>{heroInPortal ? "Ты находишься в трансферном портале" : heroCareer.transferIntent === "open" ? "Ты изучаешь варианты" : "Ты остаёшься в программе"}</strong></div><span>{heroCareer.transferOffers.length} предложений</span></header>
          {heroDecision && (heroDecision.kind === "transfer-window" || heroDecision.kind === "transfer-destination") ? (
            <div className="market-hub__hero-actions"><p>{heroDecision.detail}</p>{heroDecision.options.map((option) => <button type="button" key={option.id} disabled={mutating || !onResolveCollegeDecision} onClick={() => void onResolveCollegeDecision?.(option.id)}><div><strong>{option.label}</strong><small>{option.detail}</small></div><Icon name="arrow-right" /></button>)}</div>
          ) : heroCareer.transferOffers.length > 0 ? (
            <div className="market-hub__hero-offers">{heroCareer.transferOffers.map((offer) => <button type="button" key={offer.teamId} onClick={() => onOpenTeam?.(offer.teamId)}><div><strong>{offer.teamName}</strong><small>{offer.projectedRole} · соответствие системе {Math.round(offer.schemeFit)}</small></div><span>{offer.scholarship ? "Полная стипендия" : "Без стипендии"}</span></button>)}</div>
          ) : null}
          {actionError && <div className="inline-message inline-message--error">{actionError}</div>}
        </section>
      )}

      <nav className="market-hub__tabs" aria-label="Разделы рынка">
        <button type="button" className={view === "overview" ? "is-active" : ""} onClick={() => setView("overview")}>Обзор</button>
        <button type="button" className={view === "players" ? "is-active" : ""} onClick={() => setView("players")}>Игроки</button>
        <button type="button" className={view === "coaches" ? "is-active" : ""} onClick={() => setView("coaches")}>Тренеры</button>
      </nav>

      {view === "overview" && (
        <div className="market-hub__overview">
          <section className="market-headlines">
            <header><div><small>ГЛАВНОЕ</small><h2>Что изменилось</h2></div><span>Последняя неделя</span></header>
            {marketDigest.length > 0 ? marketDigest.map((item, index) => <article key={`${index}:${item}`}><span>{index + 1}</span><strong>{item}</strong></article>) : latestMoves.slice(0, 4).map((item, index) => <button type="button" key={item.id} onClick={() => openTransaction(item)}><span>{index + 1}</span><div><strong>{transactionLabel(item.kind)}</strong><small>{item.title}</small></div><Icon name="arrow-right" /></button>)}
            {marketDigest.length === 0 && latestMoves.length === 0 && <div className="data-empty">Рынок пока спокоен</div>}
          </section>

          <section className="market-table">
            <header><div><small>ИГРОКИ</small><h2>Последние решения</h2></div><button type="button" onClick={() => setView("players")}>Все движения</button></header>
            <div className="market-table__head"><span>Событие</span><span>Маршрут</span><span>Неделя</span></div>
            {latestMoves.slice(0, 6).map((item) => <button type="button" key={item.id} onClick={() => openTransaction(item)}><div><strong>{transactionLabel(item.kind)}</strong><small>{item.title}</small></div><span>{teamName(item.fromTeamId)} → {teamName(item.toTeamId)}</span><em>W{item.week}</em></button>)}
            {latestMoves.length === 0 && <div className="data-empty">Движений игроков пока нет</div>}
          </section>

          <section className="market-needs">
            <header><div><small>КОМАНДЫ</small><h2>Кого ищут прямо сейчас</h2></div><span>{openings.length} активных потребностей</span></header>
            {openings.slice(0, 8).map(({ item, remaining }) => <button type="button" key={item.id} onClick={() => onOpenTeam?.(item.teamId)}><span>{item.position}</span><div><strong>{teamName(item.teamId)}</strong><small>{item.reason}</small></div><em>{remaining} {remaining === 1 ? "место" : "места"}</em></button>)}
            {openings.length === 0 && <div className="data-empty">Все основные потребности закрыты</div>}
          </section>
        </div>
      )}

      {view === "players" && (
        <div className="market-hub__players">
          <nav className="market-hub__filters" aria-label="Фильтр движений игроков">
            <button type="button" className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>Все</button>
            <button type="button" className={filter === "portal" ? "is-active" : ""} onClick={() => setFilter("portal")}>Портал</button>
            <button type="button" className={filter === "offers" ? "is-active" : ""} onClick={() => setFilter("offers")}>Офферы</button>
            <button type="button" className={filter === "signed" ? "is-active" : ""} onClick={() => setFilter("signed")}>Подписания</button>
          </nav>

          <section className="market-negotiations">
            <header><div><small>ПЕРЕГОВОРЫ</small><h2>Кто принимает решение</h2></div><span>{activeOffers.length} активных</span></header>
            {negotiations.slice(0, filter === "offers" ? 40 : 14).map((item) => <button type="button" key={item.id} className={negotiationTone(item)} onClick={() => onOpenTeam?.(item.teamId)}><span>{item.position}</span><div><strong>{item.candidateName}</strong><small>{teamName(item.teamId)} · {candidateKindLabel(item.candidateKind)} · {promiseRoleLabel(item.promisedRole)}</small><p>{item.reason}</p></div><em>{negotiationStatus(item)}</em></button>)}
            {negotiations.length === 0 && <div className="data-empty">Активных переговоров нет</div>}
          </section>

          <section className="market-movement-list">
            <header><div><small>ХРОНОЛОГИЯ</small><h2>Движение игроков</h2></div><span>{visibleTransactions.length}</span></header>
            {visibleTransactions.map((item) => <button type="button" key={item.id} onClick={() => openTransaction(item)}><span>{transactionLabel(item.kind)}</span><div><strong>{item.title}</strong><small>{teamName(item.fromTeamId)} → {teamName(item.toTeamId)} · неделя {item.week}</small></div><Icon name="arrow-right" /></button>)}
            {visibleTransactions.length === 0 && <div className="data-empty">Событий этого типа пока нет</div>}
          </section>
        </div>
      )}

      {view === "coaches" && (
        <div className="market-hub__coaches">
          <section className="market-vacancies">
            <header><div><small>ВАКАНСИИ</small><h2>Открытые места в штабах</h2></div><span>{activeVacancies.length}</span></header>
            {world.movementMarket.coachVacancies.slice().reverse().map((vacancy) => <button type="button" key={vacancy.id} onClick={() => onOpenTeam?.(vacancy.teamId)}><span>{vacancy.role === "head-coach" ? "Главный" : vacancy.role === "offensive-coordinator" ? "Атака" : vacancy.role === "defensive-coordinator" ? "Защита" : "Позиция"}</span><div><strong>{teamName(vacancy.teamId)}</strong><small>{vacancy.reason}</small></div><em>{vacancyStatusLabel(vacancy.status)}</em></button>)}
            {world.movementMarket.coachVacancies.length === 0 && <div className="data-empty">Открытых вакансий нет</div>}
          </section>

          <section className="market-movement-list">
            <header><div><small>ШТАБЫ</small><h2>Последние решения</h2></div><span>{coachTransactions.length}</span></header>
            {coachTransactions.map((item) => <button type="button" key={item.id} onClick={() => { const id = item.toTeamId ?? item.fromTeamId; if (id) onOpenTeam?.(id); }}><span>{transactionLabel(item.kind)}</span><div><strong>{item.title}</strong><small>Неделя {item.week}</small></div><Icon name="arrow-right" /></button>)}
            {coachTransactions.length === 0 && <div className="data-empty">Штабы пока стабильны</div>}
          </section>
        </div>
      )}

      <EcosystemPlayerProfile save={save} player={selectedPlayer} onClose={() => setSelectedPlayer(undefined)} {...(onOpenTeam ? { onOpenTeam } : {})} />
    </div>
  );
}
