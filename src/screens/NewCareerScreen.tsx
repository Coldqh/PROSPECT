import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { ScreenShell } from "../components/layout/ScreenShell";
import { Icon } from "../components/ui/Icon";
import { sportDescriptors } from "../core/sports/sportRegistry";
import { useCareerLibrary } from "../state/CareerLibraryProvider";

export default function NewCareerScreen() {
  const navigate = useNavigate();
  const { createFootballCareer } = useCareerLibrary();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();

  async function createCareer() {
    setCreating(true);
    setError(undefined);

    try {
      const save = await createFootballCareer();
      navigate(`/career/${save.meta.id}`, { replace: true });
    } catch (caught) {
      console.error(caught);
      setError("Не удалось создать локальное сохранение.");
      setCreating(false);
    }
  }

  return (
    <ScreenShell
      narrow
      header={
        <AppHeader
          action={
            <button className="icon-button" aria-label="Назад" onClick={() => navigate(-1)}>
              <Icon name="arrow-left" />
            </button>
          }
        />
      }
    >
      <section className="page-intro">
        <span className="eyebrow">Новая карьера</span>
        <h1>Выбери спортивный мир</h1>
        <p>Выбор фиксируется на всю карьеру. Второй модуль не будет загружен и не попадёт в симуляцию.</p>
      </section>

      <div className="sport-grid">
        {sportDescriptors.map((sport) => {
          const available = sport.status === "available";
          return (
            <article className={`sport-card ${available ? "sport-card--active" : "sport-card--locked"}`} key={sport.id}>
              <div className="sport-card__topline">
                <span className="sport-card__icon">
                  <Icon name={available ? "football" : "lock"} size={27} />
                </span>
                <span className="sport-card__status">{available ? "Доступно" : "После футбольного среза"}</span>
              </div>
              <h2>{sport.name}</h2>
              <p>{sport.summary}</p>
              {available ? (
                <button className="button button--primary button--wide" disabled={creating} onClick={() => void createCareer()}>
                  {creating ? "Создание мира…" : "Начать карьеру"}
                  {!creating && <Icon name="arrow-right" />}
                </button>
              ) : (
                <button className="button button--disabled button--wide" disabled>
                  Модуль не загружается
                </button>
              )}
            </article>
          );
        })}
      </div>

      {error && <div className="inline-message inline-message--error">{error}</div>}

      <aside className="technical-note">
        <Icon name="database" size={20} />
        <p>Сейчас создаётся техническая основа карьеры. Имя, происхождение, позиция и личность появятся в следующем патче.</p>
      </aside>
    </ScreenShell>
  );
}
