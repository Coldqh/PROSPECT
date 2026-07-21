import { useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { ScreenShell } from "../components/layout/ScreenShell";
import { LoadingScreen } from "../components/feedback/LoadingScreen";
import { Icon, type IconName } from "../components/ui/Icon";
import { MetricBar } from "../components/ui/MetricBar";
import { formatGameDate } from "../core/calendar/types";
import {
  familyIncomeLabels,
  familyStructureLabels,
  familySupportLabels,
  mindsetLabels,
} from "../sports/football/career/catalog";
import { useCareerSave } from "../hooks/useCareerSave";

const tabs = [
  { id: "today", label: "Сегодня", icon: "home" },
  { id: "career", label: "Карьера", icon: "chart" },
  { id: "team", label: "Команда", icon: "team" },
  { id: "profile", label: "Персонаж", icon: "user" },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

type TabId = (typeof tabs)[number]["id"];

function heightLabel(inches: number): string {
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

function potentialLabel(value: "role-player" | "starter" | "high-upside" | "national-ceiling"): string {
  return {
    "role-player": "Ролевой уровень",
    starter: "Потенциальный стартер",
    "high-upside": "Высокий потолок",
    "national-ceiling": "Национальный потенциал",
  }[value];
}

function roleLabel(value: "starter" | "rotation" | "special-teams" | "developmental"): string {
  return {
    starter: "Projected Starter",
    rotation: "Rotation",
    "special-teams": "Special Teams",
    developmental: "Developmental",
  }[value];
}

function StatTile({ label, value, meta, icon }: { label: string; value: string | number; meta: string; icon: IconName }) {
  return (
    <article className="stat-tile">
      <span className="stat-tile__icon"><Icon name={icon} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <p>{meta}</p>
    </article>
  );
}

export default function CareerOverviewScreen() {
  const navigate = useNavigate();
  const { careerId } = useParams();
  const { save, loading, error } = useCareerSave(careerId);
  const [activeTab, setActiveTab] = useState<TabId>("today");

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

  const { character, football } = save;
  const teamStyle = { "--team-accent": football.school.primaryColor, "--team-dark": football.school.secondaryColor } as CSSProperties;
  const initials = `${character.identity.firstName[0] ?? "P"}${character.identity.lastName[0] ?? "R"}`;

  return (
    <ScreenShell
      header={
        <AppHeader
          compact
          action={
            <button className="icon-button" aria-label="К списку карьер" onClick={() => navigate("/")}>
              <Icon name="menu" />
            </button>
          }
        />
      }
      footer={
        <nav className="career-nav" aria-label="Разделы карьеры">
          {tabs.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? "is-active" : ""} onClick={() => setActiveTab(tab.id)}>
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      }
    >
      <div className="career-layout">
        <aside className="career-sidebar">
          <div className="career-sidebar__logo"><span>{football.position}</span><strong>#{String(football.jerseyNumber).padStart(2, "0")}</strong></div>
          <nav>
            {tabs.map((tab) => (
              <button key={tab.id} className={activeTab === tab.id ? "is-active" : ""} onClick={() => setActiveTab(tab.id)}>
                <Icon name={tab.icon} /><span>{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="career-sidebar__season">
            <small>SENIOR SEASON</small>
            <strong>W{football.season.week} · {football.season.wins}–{football.season.losses}</strong>
            <span>{football.school.shortName} {football.school.mascot}</span>
          </div>
        </aside>

        <div className="career-main">
          <section className="player-banner" style={teamStyle}>
            <div className="player-banner__grid" />
            <div className="player-banner__topline">
              <span>PROSPECT // HIGH SCHOOL</span>
              <div><i /> PRESEASON</div>
            </div>
            <div className="player-banner__body">
              <div className="player-banner__portrait"><span>{initials}</span><small>{football.position}</small></div>
              <div className="player-banner__identity">
                <small>{football.archetypeName} · {character.origin.city}, {character.origin.stateCode}</small>
                <h1>{character.identity.firstName}<br />{character.identity.lastName}</h1>
                <div className="player-banner__tags">
                  <span>#{football.jerseyNumber}</span>
                  <span>{heightLabel(character.physical.heightInches)} · {character.physical.weightLbs} LB</span>
                  <span>{character.identity.age} YEARS</span>
                </div>
              </div>
              <div className="overall-dial">
                <small>OVR</small>
                <strong>{football.ratings.overall}</strong>
                <span>{potentialLabel(football.ratings.potentialBand)}</span>
              </div>
            </div>
          </section>

          {activeTab === "today" && (
            <div className="dashboard-stack">
              <header className="dashboard-heading">
                <div><span className="eyebrow">MONDAY // 17 AUG 2026</span><h2>Первый день сезона</h2></div>
                <span className="dashboard-heading__date">{formatGameDate(save.meta.currentDate)}</span>
              </header>

              <div className="stat-grid">
                <StatTile label="ENERGY" value={character.condition.energy} meta={`${character.condition.sleepHours} h sleep`} icon="bolt" />
                <StatTile label="HEALTH" value={`${character.condition.health}%`} meta="No restrictions" icon="pulse" />
                <StatTile label="CONFIDENCE" value={character.condition.confidence} meta={mindsetLabels[character.personality.preset].name} icon="flame" />
                <StatTile label="COACH TRUST" value={football.depthChart.coachTrust} meta={roleLabel(football.depthChart.projectedRole)} icon="shield" />
              </div>

              <div className="dashboard-grid dashboard-grid--today">
                <section className="panel panel--schedule">
                  <header className="panel__header"><div><small>TODAY</small><h3>Team check-in</h3></div><span className="panel-index">01</span></header>
                  <div className="day-timeline">
                    <article><time>08:00</time><i /><div><strong>Senior orientation</strong><span>Auditorium · mandatory</span></div><em>45 min</em></article>
                    <article><time>11:30</time><i /><div><strong>Equipment issue</strong><span>Locker room · jersey #{football.jerseyNumber}</span></div><em>30 min</em></article>
                    <article className="is-key"><time>15:15</time><i /><div><strong>Baseline testing</strong><span>Speed, movement, conditioning</span></div><em>90 min</em></article>
                    <article><time>18:00</time><i /><div><strong>Position meeting</strong><span>Depth chart briefing</span></div><em>60 min</em></article>
                  </div>
                </section>

                <section className="panel panel--decision">
                  <header className="panel__header"><div><small>STATUS</small><h3>Role projection</h3></div><Icon name="target" /></header>
                  <div className="role-rank"><span>#{football.depthChart.rank}</span><div><small>{football.position} DEPTH CHART</small><strong>{roleLabel(football.depthChart.projectedRole)}</strong></div></div>
                  <p>Прямой конкурент: <strong>{football.depthChart.directRival.name}</strong>. {football.depthChart.directRival.year}, общий уровень {football.depthChart.directRival.overall}.</p>
                  <div className="decision-footer"><span>{football.depthChart.playersAtPosition} игроков на позиции</span><strong>{football.depthChart.directRival.style}</strong></div>
                </section>

                <section className="panel panel--opponent">
                  <header className="panel__header"><div><small>NEXT GAME</small><h3>Week 1</h3></div><span className="panel-index">08.28</span></header>
                  <div className="matchup">
                    <div><span>{football.school.shortName.slice(0, 2).toUpperCase()}</span><strong>{football.school.shortName}</strong><small>HOME</small></div>
                    <em>VS</em>
                    <div><span>OP</span><strong>{football.season.nextOpponent.name}</strong><small>0–0</small></div>
                  </div>
                  <p>Главная угроза: {football.season.nextOpponent.threat}.</p>
                </section>

                <section className="panel panel--coach">
                  <header className="panel__header"><div><small>COACH NOTE</small><h3>Первое впечатление</h3></div><Icon name="book" /></header>
                  <blockquote>«Рейтинг сейчас ничего не решает. Хочу увидеть, кто держит технику, когда ноги уже тяжёлые.»</blockquote>
                  <footer><span>Position Coach</span><strong>Evaluation begins today</strong></footer>
                </section>
              </div>
            </div>
          )}

          {activeTab === "career" && (
            <div className="dashboard-stack">
              <header className="dashboard-heading"><div><span className="eyebrow">CAREER PATH</span><h2>История только начинается</h2></div></header>
              <div className="career-path">
                <article className="is-active"><span>01</span><div><small>AUG 2026</small><strong>Последний школьный сезон</strong><p>Борьба за роль, первые матчи и выход на рынок рекрутинга.</p></div><em>ACTIVE</em></article>
                <article><span>02</span><div><small>WINTER 2026</small><strong>Recruiting window</strong><p>Интерес программ, визиты, предложения и академические требования.</p></div><em>LOCKED</em></article>
                <article><span>03</span><div><small>2027</small><strong>College freshman</strong><p>Новая команда, общежитие, redshirt и борьба за место.</p></div><em>LOCKED</em></article>
              </div>
              <div className="dashboard-grid">
                <section className="panel panel--wide">
                  <header className="panel__header"><div><small>HISTORY</small><h3>Ключевые события</h3></div><Icon name="clock" /></header>
                  <div className="history-feed">
                    {save.history.map((entry) => (
                      <article key={entry.id}><i /><div><small>{new Date(entry.occurredAt).toLocaleDateString("ru-RU")}</small><strong>{entry.title}</strong><p>{entry.description}</p></div></article>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <header className="panel__header"><div><small>RECRUITING</small><h3>Visibility</h3></div><span className="panel-index">{football.recruitment.visibility}</span></header>
                  <MetricBar label="Regional visibility" value={football.recruitment.visibility} />
                  <div className="recruiting-zero"><strong>{football.recruitment.interestedPrograms}</strong><span>interested programs</span></div>
                  <p className="panel-copy">Статус: {football.recruitment.regionalRankLabel}. Первые оценки появятся после игровых эпизодов.</p>
                </section>
              </div>
            </div>
          )}

          {activeTab === "team" && (
            <div className="dashboard-stack">
              <header className="dashboard-heading"><div><span className="eyebrow">{football.school.city}, {football.school.stateCode}</span><h2>{football.school.name} {football.school.mascot}</h2></div><span className="team-color-dot" style={{ background: football.school.primaryColor }} /></header>
              <section className="team-identity" style={teamStyle}>
                <div className="team-identity__mark">{football.school.shortName.slice(0, 2).toUpperCase()}</div>
                <div><small>PROGRAM IDENTITY</small><h3>{football.school.philosophy}</h3><p>Prestige {football.school.prestige} · Senior season 2026</p></div>
                <span>{football.school.mascot.toUpperCase()}</span>
              </section>
              <div className="dashboard-grid">
                <section className="panel">
                  <header className="panel__header"><div><small>PROGRAM</small><h3>Infrastructure</h3></div><Icon name="home" /></header>
                  <MetricBar label="Facilities" value={football.school.facilities} />
                  <MetricBar label="Coaching" value={football.school.coaching} />
                  <MetricBar label="Medicine" value={football.school.medicine} />
                  <MetricBar label="Youth trust" value={football.school.youthTrust} />
                </section>
                <section className="panel">
                  <header className="panel__header"><div><small>DEPTH CHART</small><h3>{football.position} room</h3></div><span className="panel-index">#{football.depthChart.rank}</span></header>
                  <div className="depth-list">
                    {football.depthChart.rank === 1 ? (
                      <>
                        <article className="is-player"><span>1</span><div><strong>{character.identity.fullName}</strong><small>{football.archetypeName}</small></div><em>{football.ratings.overall}</em></article>
                        <article><span>2</span><div><strong>{football.depthChart.directRival.name}</strong><small>{football.depthChart.directRival.style}</small></div><em>{football.depthChart.directRival.overall}</em></article>
                      </>
                    ) : (
                      <>
                        <article><span>1</span><div><strong>{football.depthChart.directRival.name}</strong><small>{football.depthChart.directRival.style}</small></div><em>{football.depthChart.directRival.overall}</em></article>
                        <article className="is-player"><span>2</span><div><strong>{character.identity.fullName}</strong><small>{football.archetypeName}</small></div><em>{football.ratings.overall}</em></article>
                      </>
                    )}
                  </div>
                  <p className="panel-copy">Coach trust: {football.depthChart.coachTrust}. Место не закреплено до завершения лагеря.</p>
                </section>
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="dashboard-stack">
              <header className="dashboard-heading"><div><span className="eyebrow">PLAYER PROFILE</span><h2>{character.identity.fullName}</h2></div></header>
              <div className="profile-grid">
                <section className="panel profile-card">
                  <header className="panel__header"><div><small>ATHLETE</small><h3>Physical profile</h3></div><Icon name="bolt" /></header>
                  <div className="body-readout">
                    <span><small>HEIGHT</small><strong>{heightLabel(character.physical.heightInches)}</strong></span>
                    <span><small>WEIGHT</small><strong>{character.physical.weightLbs}</strong><em>LB</em></span>
                    <span><small>FRAME</small><strong>{character.physical.frame}</strong></span>
                  </div>
                  <MetricBar label="Speed" value={character.physical.speed} />
                  <MetricBar label="Strength" value={character.physical.strength} />
                  <MetricBar label="Agility" value={character.physical.agility} />
                  <MetricBar label="Explosiveness" value={character.physical.explosiveness} />
                  <MetricBar label="Stamina" value={character.physical.stamina} />
                </section>
                <section className="panel profile-card">
                  <header className="panel__header"><div><small>MINDSET</small><h3>{mindsetLabels[character.personality.preset].name}</h3></div><Icon name="brain" /></header>
                  <MetricBar label="Discipline" value={character.personality.discipline} />
                  <MetricBar label="Ambition" value={character.personality.ambition} />
                  <MetricBar label="Composure" value={character.personality.composure} />
                  <MetricBar label="Coachability" value={character.personality.coachability} />
                  <MetricBar label="Adaptability" value={character.personality.adaptability} />
                  <MetricBar label="Risk tolerance" value={character.personality.riskTolerance} />
                </section>
                <section className="panel profile-card">
                  <header className="panel__header"><div><small>ORIGIN</small><h3>{character.origin.city}, {character.origin.stateCode}</h3></div><Icon name="map" /></header>
                  <div className="info-list">
                    <span><small>REGION</small><strong>{character.origin.region}</strong></span>
                    <span><small>FAMILY FINANCES</small><strong>{familyIncomeLabels[character.origin.familyIncome]}</strong></span>
                    <span><small>HOUSEHOLD</small><strong>{familyStructureLabels[character.origin.familyStructure]}</strong></span>
                    <span><small>SPORT SUPPORT</small><strong>{familySupportLabels[character.origin.familySupport]}</strong></span>
                  </div>
                  <MetricBar label="Training access" value={character.origin.trainingAccess} />
                  <MetricBar label="Medical access" value={character.origin.medicalAccess} />
                  <MetricBar label="Football culture" value={character.origin.footballCulture} />
                </section>
                <section className="panel profile-card">
                  <header className="panel__header"><div><small>ACADEMICS</small><h3>Eligibility</h3></div><Icon name="book" /></header>
                  <div className="gpa-display"><small>GPA</small><strong>{character.education.gpa.toFixed(2)}</strong><span>{character.education.eligibilityStatus.toUpperCase()}</span></div>
                  <MetricBar label="Academic ability" value={character.education.academicAbility} />
                  <MetricBar label="Attendance" value={character.education.attendance} />
                  <p className="panel-copy">Академические требования будут влиять на доступные предложения колледжей.</p>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </ScreenShell>
  );
}
