import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { ScreenShell } from "../components/layout/ScreenShell";
import { Icon } from "../components/ui/Icon";
import { useCareerLibrary } from "../state/CareerLibraryProvider";
import { downloadBlob } from "../utils/downloadBlob";

const potentialLabels = {
  "role-player": "Role player",
  starter: "Starter ceiling",
  "high-upside": "High upside",
  "national-ceiling": "National ceiling",
} as const;

const phaseLabels = {
  "high-school-preseason": "Senior season",
  "college-orientation": "College arrival",
  "college-season": "Freshman season",
} as const;

export default function CareerLibraryScreen() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const { careers, loading, error, removeCareer, importCareer, exportCareer } = useCareerLibrary();
  const [busyCareer, setBusyCareer] = useState<string>();
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string }>();
  const [query, setQuery] = useState("");
  const filteredCareers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return careers;
    return careers.filter((career) => `${career.displayName} ${career.schoolName} ${career.position} ${career.stateCode}`.toLowerCase().includes(normalized));
  }, [careers, query]);

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
      setMessage({ kind: "success", text: "Карьера экспортирована." });
    } catch {
      setMessage({ kind: "error", text: "Экспорт не удался." });
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
      setMessage({ kind: "error", text: "Файл не является совместимым сохранением PROSPECT." });
    } finally {
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  }

  return (
    <ScreenShell header={<AppHeader context="Career library" />} className="library-experience">
      <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void handleImport(event.target.files?.[0])} />

      <section className="library-intro">
        <div className="library-intro__copy">
          <span className="eyebrow">AMERICAN FOOTBALL CAREER SIMULATOR</span>
          <h1>Твоя футбольная карьера.</h1>
          <p>Продолжи сохранение или создай нового игрока. Мир, команды и история развиваются внутри каждой карьеры.</p>
        </div>
        <div className="library-intro__actions">
          <Link className="button button--primary" to="/new">Новая карьера <Icon name="arrow-right" /></Link>
          <button className="button button--ghost" onClick={() => fileInput.current?.click()}><Icon name="upload" /> Импорт</button>
        </div>
        <div className="library-intro__signal">
          <span><i /> Offline-ready</span>
          <strong>BUILD 0.24</strong>
        </div>
      </section>

      <section className="library-section">
        <header className="library-toolbar">
          <div><span className="eyebrow">ЛОКАЛЬНЫЕ СОХРАНЕНИЯ</span><h2>Карьеры</h2></div>
          <label className="library-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, школа, позиция" aria-label="Поиск карьер" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Очистить"><Icon name="close" size={14} /></button>}</label>
          <span className="library-count"><strong>{String(filteredCareers.length).padStart(2, "0")}</strong><small>карьер</small></span>
        </header>

        {message && <div className={`inline-message inline-message--${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</div>}
        {error && <div className="inline-message inline-message--error" role="alert">{error}</div>}

        {loading ? (
          <div className="career-gallery career-gallery--loading" aria-busy="true">
            {[0, 1, 2].map((item) => <div className="career-file-skeleton" key={item}><i /><span /><span /></div>)}
          </div>
        ) : careers.length === 0 ? (
          <div className="empty-career">
            <div className="empty-career__mark"><Icon name="football" size={30} /></div>
            <div><small>Пока пусто</small><h3>Создай первого игрока</h3><p>Происхождение, позиция, характер и футбольный мир сформируются в одном сохранении.</p></div>
            <Link className="button button--primary" to="/new">Начать <Icon name="arrow-right" /></Link>
          </div>
        ) : filteredCareers.length === 0 ? (
          <div className="empty-career empty-career--compact"><div className="empty-career__mark"><Icon name="search" /></div><div><small>Нет совпадений</small><h3>Карьера не найдена</h3><p>Измени запрос или очисти поиск.</p></div><button className="button button--ghost" onClick={() => setQuery("")}>Очистить</button></div>
        ) : (
          <div className="career-gallery">
            {filteredCareers.map((career, index) => (
              <article className="career-file" key={career.id}>
                <button className="career-file__open" onClick={() => navigate(`/career/${career.id}`)} disabled={busyCareer === career.id}>
                  <div className="career-file__visual" aria-hidden="true">
                    <span>{career.position}</span>
                    <strong>{String(career.jerseyNumber).padStart(2, "0")}</strong>
                    <small>{career.stateCode}</small>
                  </div>
                  <div className="career-file__body">
                    <div className="career-file__top"><span>PRSPCT-{String(index + 1).padStart(3, "0")}</span><em>{phaseLabels[career.phase]}</em></div>
                    <h3>{career.displayName}</h3>
                    <p>{career.schoolName}</p>
                    <div className="career-file__metric"><strong>{career.overall}</strong><span>OVR</span></div>
                    <div className="career-file__meta"><span>{potentialLabels[career.potentialBand]}</span><span>{career.position} · #{career.jerseyNumber}</span></div>
                    <div className="career-file__resume">Продолжить <Icon name="arrow-right" /></div>
                  </div>
                </button>
                <div className="career-file__actions">
                  <button aria-label="Экспортировать карьеру" disabled={busyCareer === career.id} onClick={() => void handleExport(career.id)}><Icon name="download" size={18} /></button>
                  <button aria-label="Удалить карьеру" disabled={busyCareer === career.id} onClick={() => void handleDelete(career.id)}><Icon name="trash" size={18} /></button>
                </div>
              </article>
            ))}
            <Link className="career-add" to="/new"><span><Icon name="spark" /></span><strong>Новая карьера</strong><small>Другой игрок. Другой мир.</small></Link>
          </div>
        )}
      </section>

      <section className="system-deck" aria-label="Возможности сохранений">
        <article><Icon name="database" /><div><strong>Локально</strong><p>Сохранения, импорт и резервные снимки.</p></div></article>
        <article><Icon name="spark" /><div><strong>Постоянный мир</strong><p>Один seed сохраняет историю между сессиями.</p></div></article>
        <article><Icon name="shield" /><div><strong>Без аккаунта</strong><p>Все данные остаются на устройстве.</p></div></article>
      </section>
    </ScreenShell>
  );
}
