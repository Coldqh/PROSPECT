import type { RelationshipNpc, RelationshipRole } from "../../core/relationships/types";
import type { CareerSave } from "../../storage/saves/schema";
import { Icon } from "../ui/Icon";

interface SocialLifeDashboardProps {
  save: CareerSave;
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

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function SocialLifeDashboard({ save }: SocialLifeDashboardProps) {
  const contacts = [...save.relationships.npcs].sort((left, right) => right.relationship - left.relationship);
  const closeContacts = contacts.slice(0, 4);
  const recent = [...save.relationships.resolvedEvents].reverse().slice(0, 5);
  const pending = save.relationships.pendingEvent;
  const averageRelationship = contacts.length > 0
    ? Math.round(contacts.reduce((sum, npc) => sum + npc.relationship, 0) / contacts.length)
    : 0;

  return (
    <div className="social-life-page elite-page">
      <header className="elite-page-heading">
        <div>
          <small>ВНЕ ПОЛЯ</small>
          <h1>Социальная жизнь</h1>
        </div>
        <span className="elite-score-chip"><Icon name="team" size={18} />{contacts.length}</span>
      </header>

      <section className="social-summary-strip" aria-label="Состояние социальной жизни">
        <article><small>Связи</small><strong>{contacts.length}</strong></article>
        <article><small>Средний уровень</small><strong>{averageRelationship}</strong></article>
        <article><small>События</small><strong>{save.relationships.resolvedEvents.length}</strong></article>
      </section>

      {pending && (
        <section className="social-priority-card">
          <div className="social-priority-card__icon"><Icon name="message" /></div>
          <div>
            <small>ТРЕБУЕТ РЕШЕНИЯ</small>
            <h2>{pending.title}</h2>
            <p>{pending.scene}</p>
          </div>
          <Icon name="arrow-right" />
        </section>
      )}

      <section className="elite-section">
        <header className="elite-section__head"><h2>Близкие контакты</h2><span>{closeContacts.length}</span></header>
        <div className="social-contact-rail">
          {closeContacts.map((npc) => (
            <article key={npc.id} className="social-contact-card">
              <span className="social-avatar" aria-hidden="true">{initials(npc.name)}</span>
              <strong>{npc.name}</strong>
              <small>{roleLabel(npc.role)}</small>
              <em>{relationshipLabel(npc.relationship)}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="elite-section">
        <header className="elite-section__head"><h2>Отношения</h2><span>{contacts.length}</span></header>
        <div className="social-relationship-list">
          {contacts.map((npc) => (
            <article key={npc.id}>
              <span className="social-avatar social-avatar--small" aria-hidden="true">{initials(npc.name)}</span>
              <div>
                <strong>{npc.name}</strong>
                <small>{roleLabel(npc.role)} · {statusLabel(npc.status)}</small>
              </div>
              <div className="social-relationship-value">
                <strong>{Math.round(npc.relationship)}</strong>
                <i><b style={{ width: `${Math.max(0, Math.min(100, npc.relationship))}%` }} /></i>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="elite-section">
        <header className="elite-section__head"><h2>Последние события</h2><span>{recent.length}</span></header>
        <div className="social-event-list">
          {recent.length === 0 ? <div className="elite-empty">Событий пока нет</div> : recent.map((event) => {
            const npc = contacts.find((item) => item.id === event.primaryNpcId);
            return (
              <article key={event.id}>
                <span className="social-avatar social-avatar--small" aria-hidden="true">{initials(npc?.name ?? "PROSPECT")}</span>
                <div><strong>{event.title}</strong><small>{npc?.name ?? "Система"}</small><p>{event.outcome}</p></div>
                <em>{event.relationshipDelta > 0 ? "+" : ""}{event.relationshipDelta}</em>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
