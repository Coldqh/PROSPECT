import { useMemo, useState } from "react";
import type { RelationshipGroup, RelationshipNpc } from "../../core/relationships/types";
import type { CareerSave } from "../../storage/saves/schema";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { SectionTabs } from "../ui/SectionTabs";

const views = [
  { id: "important", label: "Важные" },
  { id: "team", label: "Команда" },
  { id: "family", label: "Дом" },
  { id: "school", label: "Школа" },
] as const;

type ViewId = (typeof views)[number]["id"];

const roleLabels: Record<RelationshipNpc["role"], string> = {
  guardian: "Семья",
  "head-coach": "Главный тренер",
  "position-coach": "Позиционный тренер",
  rival: "Конкурент",
  teammate: "Партнёр по команде",
  counselor: "Школьный консультант",
  reporter: "Местная пресса",
};

const statusLabels: Record<RelationshipNpc["status"], string> = {
  steady: "стабильно",
  "under-pressure": "под давлением",
  hopeful: "воодушевлён",
  frustrated: "раздражён",
  focused: "сосредоточен",
  concerned: "обеспокоен",
};

function relationshipLabel(value: number): string {
  if (value >= 65) return "Очень близкие";
  if (value >= 35) return "Хорошие";
  if (value >= 12) return "Положительные";
  if (value > -12) return "Нейтральные";
  if (value > -35) return "Напряжённые";
  return "Конфликт";
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((part) => part[0] ?? "").join("");
}

function groupForView(view: ViewId): RelationshipGroup[] {
  if (view === "team") return ["team"];
  if (view === "family") return ["family"];
  if (view === "school") return ["school", "media"];
  return ["family", "team", "school", "media"];
}

export function PeopleDashboard({ save }: { save: CareerSave }) {
  const [view, setView] = useState<ViewId>("important");
  const [selectedNpcId, setSelectedNpcId] = useState<string>();
  const pendingNpcId = save.relationships.pendingEvent?.primaryNpcId;
  const people = useMemo(() => {
    const groups = groupForView(view);
    const filtered = save.relationships.npcs.filter((npc) => groups.includes(npc.group));
    if (view !== "important") return filtered;
    return [...filtered]
      .sort((left, right) => {
        if (left.id === pendingNpcId) return -1;
        if (right.id === pendingNpcId) return 1;
        const leftWeight = Math.abs(left.relationship) + left.memories.length * 4;
        const rightWeight = Math.abs(right.relationship) + right.memories.length * 4;
        return rightWeight - leftWeight;
      })
      .slice(0, 5);
  }, [pendingNpcId, save.relationships.npcs, view]);
  const selected = save.relationships.npcs.find((npc) => npc.id === selectedNpcId);

  return (
    <div className="compact-view people-dashboard">
      <SectionTabs<ViewId> tabs={views} active={view} onChange={setView} ariaLabel="Группы людей" />

      {save.relationships.pendingEvent && (
        <section className="people-pending-strip">
          <Icon name="message" />
          <div><small>СЕГОДНЯШНЯЯ СИТУАЦИЯ</small><strong>{save.relationships.pendingEvent.title}</strong></div>
          <span>1</span>
        </section>
      )}

      <div className="people-list">
        {people.map((npc) => (
          <button type="button" key={npc.id} className={npc.id === pendingNpcId ? "has-event" : ""} onClick={() => setSelectedNpcId(npc.id)}>
            <span className="people-avatar">{initials(npc.name)}</span>
            <div className="people-copy">
              <small>{roleLabels[npc.role]} · {statusLabels[npc.status]}</small>
              <strong>{npc.name}</strong>
              <p>{npc.currentSituation}</p>
            </div>
            <div className={`people-relation ${npc.relationship < 0 ? "is-negative" : ""}`}>
              <small>отношение</small><strong>{npc.relationship > 0 ? "+" : ""}{npc.relationship}</strong>
            </div>
          </button>
        ))}
      </div>

      <div className="people-footnote">
        <Icon name="brain" />
        <p>У каждого человека одна шкала отношения. Характер, цели и память определяют, как именно он действует.</p>
      </div>

      <BottomSheet open={Boolean(selected)} onClose={() => setSelectedNpcId(undefined)} eyebrow={selected ? roleLabels[selected.role] : "Человек"} title={selected?.name ?? ""}>
        {selected && (
          <div className="person-sheet">
            <section className="person-relation-card">
              <div><small>ОТНОШЕНИЕ</small><strong>{selected.relationship > 0 ? "+" : ""}{selected.relationship}</strong></div>
              <span>{relationshipLabel(selected.relationship)}</span>
              <i><b style={{ width: `${(selected.relationship + 100) / 2}%` }} /></i>
            </section>
            <section><small>СЕЙЧАС</small><p>{selected.currentSituation}</p></section>
            <section><small>ЧЕГО ХОЧЕТ</small><p>{selected.goal}</p></section>
            <section><small>ЧЕГО БОИТСЯ</small><p>{selected.fear}</p></section>
            <section className="person-memory-section">
              <small>ПАМЯТЬ</small>
              {selected.memories.length === 0 ? <p>Между вами пока не произошло ничего важного.</p> : (
                <div>{[...selected.memories].reverse().map((memory) => (
                  <article key={memory.id}>
                    <span className={memory.impact < 0 ? "is-negative" : ""}>{memory.impact > 0 ? "+" : ""}{memory.impact}</span>
                    <p>{memory.summary}</p>
                  </article>
                ))}</div>
              )}
            </section>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
