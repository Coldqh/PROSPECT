import { useMemo, useRef, useState } from "react";
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>();
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string }>();
  const [query, setQuery] = useState("");
  const filteredCareers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return careers;
    return careers.filter((career) => `${career.displayName} ${career.schoolName} ${career.position} ${career.stateCode} ${career.seasonLabel}`.toLowerCase().includes(normalized));
  }, [careers, query]);
  const latest = careers[0];

  async function handleDelete(careerId: string) {
    if (confirmDeleteId !== careerId) {
      setConfirmDeleteId(careerId);
      window.setTimeout(() => setConfirmDeleteId((current) => current === careerId ? undefined : current), 3500);
      return;
    }
    setBusyCareer(careerId);
    setMessage(undefined);
    try {
      await removeCareer(careerId);
      setConfirmDeleteId(undefined);
      setMessage({ kind: "success", text: "Карьера удалена" });
    } catch (caught) {
      console.error(caught);
      setMessage({ kind: "error", text: "Удаление не выполнено" });
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
      setMessage({ kind: "success", text: "Файл сохранён" });
    } catch {
      setMessage({ kind: "error", text: "Экспорт не выполнен" });
    } finally {
      setBusyCareer(undefined);
    }
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setMessage(undefined);
    try {
      const save = await importCareer(file);
      navigate(`/career/${save.meta.id}`);
    } catch (caught) {
      console.error(caught);
      setMessage({ kind: "error", text: "Некорректный файл" });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <ScreenShell header={<AppHeader context="Карьеры" />} className="game-library">
      <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void handleImport(event.target.files?.[0])} />

      <section className="game-library-hero">
        <div className="game-library-hero__copy">
          <small>PROSPECT</small>
          <h1>{latest ? latest.displayName : "Карьеры"}</h1>
          <p>{latest ? `${latest.position} · ${Math.round(latest.overall)} OVR · ${latest.schoolName}` : "American Football"}</p>
        </div>
        <div className="game-library-hero__actions">
          {latest && <button type="button" className="button button--ghost" onClick={() => navigate(`/career/${latest.id}`)}>Продолжить <Icon name="arrow-right" /></button>}
          <Link className="button button--primary" to="/new">Новая карьера <Icon name="arrow-right" /></Link>
        </div>
      </section>

      <section className="game-library-list">
        <header className="game-library-toolbar">
          <div><strong>Сохранения</strong><small>{careers.length}</small></div>
          <label><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" aria-label="Поиск карьер" /></label>
          <button type="button" onClick={() => fileInput.current?.click()}><Icon name="upload" size={17} /> Импорт</button>
        </header>

        {message && <div className={`inline-message inline-message--${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</div>}
        {error && <div className="inline-message inline-message--error" role="alert">{error}</div>}

        {loading ? (
          <div className="save-row-list" aria-busy="true">{[0, 1, 2].map((item) => <div className="save-row save-row--loading" key={item}><i /><i /><i /></div>)}</div>
        ) : filteredCareers.length === 0 ? (
          <div className="game-empty"><Icon name={query ? "search" : "football"} /><strong>{query ? "Нет совпадений" : "Нет сохранений"}</strong>{query && <button type="button" onClick={() => setQuery("")}>Очистить</button>}</div>
        ) : (
          <div className="save-row-list">
            {filteredCareers.map((career) => (
              <article className="save-row" key={career.id}>
                <button type="button" className="save-row__main" onClick={() => navigate(`/career/${career.id}`)} disabled={busyCareer === career.id}>
                  <span className="save-row__position">{career.position}<small>#{career.jerseyNumber}</small></span>
                  <div className="save-row__name"><strong>{career.displayName}</strong><small>{career.schoolName}</small></div>
                  <div className="save-row__season"><strong>{career.seasonLabel}</strong><small>{career.stateCode}</small></div>
                  <span className="save-row__ovr">{Math.round(career.overall)}<small>OVR</small></span>
                  <span className="save-row__continue">Продолжить <Icon name="arrow-right" size={16} /></span>
                </button>
                <div className="save-row__actions">
                  <button type="button" aria-label="Экспорт" disabled={busyCareer === career.id} onClick={() => void handleExport(career.id)}><Icon name="download" size={17} /></button>
                  <button type="button" className={confirmDeleteId === career.id ? "is-confirm" : ""} aria-label={confirmDeleteId === career.id ? "Подтвердить удаление" : "Удалить"} disabled={busyCareer === career.id} onClick={() => void handleDelete(career.id)}>{confirmDeleteId === career.id ? <span>Удалить?</span> : <Icon name="trash" size={17} />}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </ScreenShell>
  );
}
