import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { ScreenShell } from "../components/layout/ScreenShell";
import { LoadingScreen } from "../components/feedback/LoadingScreen";
import { Icon } from "../components/ui/Icon";
import { formatGameDate } from "../core/calendar/types";
import { useCareerSave } from "../hooks/useCareerSave";

export default function CareerOverviewScreen() {
  const navigate = useNavigate();
  const { careerId } = useParams();
  const { save, loading, error } = useCareerSave(careerId);

  if (loading) {
    return <LoadingScreen label="Восстановление карьеры" />;
  }

  if (!save || error) {
    return (
      <ScreenShell narrow>
        <section className="fatal-panel">
          <span className="eyebrow">Сохранение недоступно</span>
          <h1>{error ?? "Карьера не найдена"}</h1>
          <button className="button button--primary" onClick={() => navigate("/")}>К списку карьер</button>
        </section>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      narrow
      header={
        <AppHeader
          action={
            <button className="icon-button" aria-label="К списку карьер" onClick={() => navigate("/")}>
              <Icon name="arrow-left" />
            </button>
          }
        />
      }
    >
      <section className="career-hero">
        <span className="eyebrow">American Football · Foundation</span>
        <h1>Новый проспект</h1>
        <p>{formatGameDate(save.meta.currentDate)}</p>
        <div className="career-hero__status">
          <span>Схема v{save.meta.schemaVersion}</span>
          <span>Снимок #{save.meta.revision}</span>
          <span>Офлайн</span>
        </div>
      </section>

      <section className="foundation-status">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Патч 1</span>
            <h2>Фундамент готов</h2>
          </div>
        </div>

        <div className="status-stack">
          <article>
            <span className="status-stack__icon"><Icon name="database" /></span>
            <div><strong>Карьера сохранена</strong><p>Основной снимок записан в IndexedDB.</p></div>
            <span className="status-dot" />
          </article>
          <article>
            <span className="status-stack__icon"><Icon name="spark" /></span>
            <div><strong>Мир зафиксирован</strong><p className="seed-line">{save.meta.worldSeed}</p></div>
            <span className="status-dot" />
          </article>
          <article>
            <span className="status-stack__icon"><Icon name="football" /></span>
            <div><strong>Football загружен отдельно</strong><p>Basketball не создан и не участвует в состоянии.</p></div>
            <span className="status-dot" />
          </article>
        </div>
      </section>

      <section className="next-patch-card">
        <span className="eyebrow">Следующий патч</span>
        <h2>Создание спортсмена</h2>
        <p>Имя, происхождение, физический профиль, личность, позиция и стартовые условия школьного сезона.</p>
      </section>
    </ScreenShell>
  );
}
