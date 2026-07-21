import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { ScreenShell } from "../components/layout/ScreenShell";
import { Icon } from "../components/ui/Icon";
import { useCareerLibrary } from "../state/CareerLibraryProvider";
import { downloadBlob } from "../utils/downloadBlob";

export default function CareerLibraryScreen() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const { careers, loading, error, removeCareer, importCareer, exportCareer } = useCareerLibrary();
  const [busyCareer, setBusyCareer] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function handleDelete(careerId: string) {
    if (!window.confirm("Удалить карьеру и все её резервные снимки?")) {
      return;
    }

    setBusyCareer(careerId);
    setMessage(undefined);
    try {
      await removeCareer(careerId);
    } finally {
      setBusyCareer(undefined);
    }
  }

  async function handleExport(careerId: string) {
    setBusyCareer(careerId);
    setMessage(undefined);
    try {
      const blob = await exportCareer(careerId);
      downloadBlob(blob, `prospect-career-${careerId.slice(0, 8)}.json`);
      setMessage("Карьера экспортирована.");
    } catch {
      setMessage("Экспорт не удался.");
    } finally {
      setBusyCareer(undefined);
    }
  }

  async function handleImport(file: File | undefined) {
    if (!file) {
      return;
    }

    setMessage(undefined);
    try {
      const save = await importCareer(file);
      navigate(`/career/${save.meta.id}`);
    } catch (caught) {
      console.error(caught);
      setMessage("Файл не является совместимым сохранением PROSPECT.");
    } finally {
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  }

  return (
    <ScreenShell header={<AppHeader />}>
      <section className="hero-panel">
        <span className="eyebrow">Career life simulator</span>
        <h1>Построй карьеру.<br />Проживи последствия.</h1>
        <p>
          Один спортсмен, один мир, одна история. Первый модуль — последний школьный сезон в American Football.
        </p>
        <Link className="button button--primary button--wide" to="/new">
          Новая карьера
          <Icon name="arrow-right" />
        </Link>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Локальные сохранения</span>
            <h2>Карьеры</h2>
          </div>
          <button className="button button--ghost button--compact" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={18} />
            Импорт
          </button>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />
        </div>

        {message && <div className="inline-message">{message}</div>}
        {error && <div className="inline-message inline-message--error">{error}</div>}

        {loading ? (
          <div className="empty-card">Читаем IndexedDB…</div>
        ) : careers.length === 0 ? (
          <div className="empty-card">
            <Icon name="database" size={26} />
            <strong>Сохранений пока нет</strong>
            <span>Новая карьера сразу получит world seed, версию схемы и резервный снимок.</span>
          </div>
        ) : (
          <div className="career-list">
            {careers.map((career) => (
              <article className="career-card" key={career.id}>
                <button
                  className="career-card__main"
                  onClick={() => navigate(`/career/${career.id}`)}
                  disabled={busyCareer === career.id}
                >
                  <span className="career-card__sport"><Icon name="football" size={22} /></span>
                  <span className="career-card__copy">
                    <strong>{career.displayName}</strong>
                    <span>American Football · версия {career.revision}</span>
                  </span>
                  <Icon name="arrow-right" />
                </button>
                <div className="career-card__actions">
                  <button aria-label="Экспортировать карьеру" onClick={() => void handleExport(career.id)}>
                    <Icon name="download" size={18} />
                  </button>
                  <button aria-label="Удалить карьеру" onClick={() => void handleDelete(career.id)}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="foundation-grid" aria-label="Технический фундамент">
        <article>
          <Icon name="shield" />
          <strong>Безопасные сохранения</strong>
          <span>IndexedDB, checksum и пять резервных автоснимков.</span>
        </article>
        <article>
          <Icon name="spark" />
          <strong>Детерминированный мир</strong>
          <span>Каждая карьера получает постоянный seed.</span>
        </article>
      </section>
    </ScreenShell>
  );
}
