import { useState } from "react";
import type { RelationshipNpc, RelationshipRole } from "../../core/relationships/types";
import type { CareerSave } from "../../storage/saves/schema";
import { Icon } from "../ui/Icon";
import { OverlayDialog } from "../ui/OverlayDialog";

interface SocialLifeDashboardProps {
  save: CareerSave;
  mutating?: boolean;
  onResolveRelationshipEvent?(optionId: string): Promise<void>;
}

function roleLabel(role: RelationshipRole): string {
  return {
    guardian: "Семья",
    "head-coach": "Главный тренер",
    "position-coach": "Позиционный тренер",
    rival: "Соперник",
    teammate: "Партнёр",
    counselor: "Куратор",
    reporter: "Медиа",
  }[role];
}

function relationshipLabel(value: number): string {
  if (value >= 82) return "Близкие";
  if (value >= 68) return "Крепкие";
  if (value >= 52) return "Рабочие";
  if (value >= 36) return "Холодные";
  return "Конфликт";
}

function statusLabel(status: RelationshipNpc["status"]): string {
  return {
    steady: "Стабильно",
    "under-pressure": "Под давлением",
    hopeful: "Настроен позитивно",
    frustrated: "Раздражён",
    focused: "Сосредоточен",
    concerned: "Обеспокоен",
  }[status];
}

function temperamentLabel(value: RelationshipNpc["temperament"]): string {
  return { direct: "Прямой", reserved: "Закрытый", volatile: "Вспыльчивый", warm: "Тёплый", calculating: "Расчётливый", demanding: "Требовательный" }[value];
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function SocialLifeDashboard({ save, mutating = false, onResolveRelationshipEvent }: SocialLifeDashboardProps) {
  const [selectedNpc, setSelectedNpc] = useState<RelationshipNpc>();
  const [eventOpen, setEventOpen] = useState(false);
  const contacts = [...save.relationships.npcs].sort((left, right) => right.relationship - left.relationship);
  const closeContacts = contacts.slice(0, 4);
  const recent = [...save.relationships.resolvedEvents].reverse().slice(0, 8);
  const pending = save.relationships.pendingEvent;
  const averageRelationship = contacts.length > 0
    ? Math.round(contacts.reduce((sum, npc) => sum + npc.relationship, 0) / contacts.length)
    : 0;

  async function resolveEvent(optionId: string) {
    if (!onResolveRelationshipEvent || mutating) return;
    await onResolveRelationshipEvent(optionId);
    setEventOpen(false);
  }

  return (
    <div className="social-life-page elite-page">
      <header className="elite-page-heading">
        <div><small>ВНЕ ПОЛЯ</small><h1>Социальная жизнь</h1></div>
        <span className="elite-score-chip"><Icon name="team" size={16} />{contacts.length}</span>
      </header>

      <section className="social-summary-strip" aria-label="Состояние социальной жизни">
        <article><small>Связи</small><strong>{contacts.length}</strong></article>
        <article><small>Средний уровень</small><strong>{averageRelationship}</strong></article>
        <article><small>События</small><strong>{save.relationships.resolvedEvents.length}</strong></article>
      </section>

      {pending && (
        <button type="button" className="social-priority-card" onClick={() => setEventOpen(true)}>
          <div className="social-priority-card__icon"><Icon name="message" /></div>
          <div><small>ТРЕБУЕТ РЕШЕНИЯ</small><h2>{pending.title}</h2><p>{pending.scene}</p></div>
          <Icon name="arrow-right" />
        </button>
      )}

      <section className="elite-section">
        <header className="elite-section__head"><h2>Близкие контакты</h2><span>{closeContacts.length}</span></header>
        <div className="social-contact-rail">
          {closeContacts.map((npc) => (
            <button type="button" key={npc.id} className="social-contact-card" onClick={() => setSelectedNpc(npc)}>
              <span className="social-avatar" aria-hidden="true">{initials(npc.name)}</span>
              <strong>{npc.name}</strong><small>{roleLabel(npc.role)}</small><em>{relationshipLabel(npc.relationship)}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="elite-section">
        <header className="elite-section__head"><h2>Отношения</h2><span>{contacts.length}</span></header>
        <div className="social-relationship-list">
          {contacts.map((npc) => (
            <button type="button" key={npc.id} onClick={() => setSelectedNpc(npc)}>
              <span className="social-avatar social-avatar--small" aria-hidden="true">{initials(npc.name)}</span>
              <div><strong>{npc.name}</strong><small>{roleLabel(npc.role)} · {statusLabel(npc.status)}</small></div>
              <div className="social-relationship-value"><strong>{Math.round(npc.relationship)}</strong><i><b style={{ width: `${Math.max(0, Math.min(100, npc.relationship))}%` }} /></i></div>
            </button>
          ))}
        </div>
      </section>

      <section className="elite-section">
        <header className="elite-section__head"><h2>Последние события</h2><span>{recent.length}</span></header>
        <div className="social-event-list">
          {recent.length === 0 ? <div className="elite-empty">Событий пока нет</div> : recent.map((event) => {
            const npc = contacts.find((item) => item.id === event.primaryNpcId);
            return (
              <button type="button" key={event.id} onClick={() => npc && setSelectedNpc(npc)}>
                <span className="social-avatar social-avatar--small" aria-hidden="true">{initials(npc?.name ?? "PROSPECT")}</span>
                <div><strong>{event.title}</strong><small>{npc?.name ?? "Система"}</small><p>{event.outcome}</p></div>
                <em>{event.relationshipDelta > 0 ? "+" : ""}{event.relationshipDelta}</em>
              </button>
            );
          })}
        </div>
      </section>

      <OverlayDialog open={Boolean(selectedNpc)} title={selectedNpc?.name ?? "Контакт"} eyebrow={selectedNpc ? roleLabel(selectedNpc.role) : "КОНТАКТ"} onClose={() => setSelectedNpc(undefined)}>
        {selectedNpc && (
          <div className="social-person-profile">
            <header><span>{initials(selectedNpc.name)}</span><div><small>{selectedNpc.age} лет · {temperamentLabel(selectedNpc.temperament)}</small><strong>{statusLabel(selectedNpc.status)}</strong></div><em>{Math.round(selectedNpc.relationship)}</em></header>
            <section><small>Текущая ситуация</small><p>{selectedNpc.currentSituation}</p></section>
            <div className="social-person-profile__facts"><span><small>Хочет</small><strong>{selectedNpc.goal}</strong></span><span><small>Боится</small><strong>{selectedNpc.fear}</strong></span></div>
            <section><small>Память отношений</small><div className="social-memory-list">{[...selectedNpc.memories].reverse().slice(0, 10).map((memory) => <article key={memory.id}><div><strong>{memory.summary}</strong><small>{memory.date.month}/{memory.date.day}/{memory.date.year}</small></div><em>{memory.impact > 0 ? "+" : ""}{memory.impact}</em></article>)}{selectedNpc.memories.length === 0 && <div className="data-empty">Общей истории пока нет</div>}</div></section>
            {pending?.primaryNpcId === selectedNpc.id && <button type="button" className="button button--primary button--wide" onClick={() => { setSelectedNpc(undefined); setEventOpen(true); }}>Открыть текущий разговор<Icon name="arrow-right" /></button>}
          </div>
        )}
      </OverlayDialog>

      <OverlayDialog open={eventOpen && Boolean(pending)} title={pending?.title ?? "Разговор"} eyebrow="ЖИВАЯ СИТУАЦИЯ" onClose={() => setEventOpen(false)}>
        {pending && (() => {
          const npc = contacts.find((item) => item.id === pending.primaryNpcId);
          return <div className="relationship-event-sheet"><header><span>{initials(npc?.name ?? "NPC")}</span><div><small>{npc?.name}</small><strong>{pending.scene}</strong></div></header><div className="relationship-event-context">{pending.context.map((item) => <p key={item}>{item}</p>)}</div><div className="relationship-event-options">{pending.options.map((option) => <button type="button" key={option.id} disabled={mutating || !onResolveRelationshipEvent} onClick={() => void resolveEvent(option.id)}><strong>{option.label}</strong><span>{option.detail}</span></button>)}</div></div>;
        })()}
      </OverlayDialog>
    </div>
  );
}
