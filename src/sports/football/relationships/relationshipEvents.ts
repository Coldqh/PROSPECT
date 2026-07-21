import { toGameDateKey, type GameDate } from "../../../core/calendar/types";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type {
  QueuedRelationshipEvent,
  RelationshipEvent,
  RelationshipEventOption,
  RelationshipEventType,
  RelationshipNpc,
  RelationshipState,
} from "../../../core/relationships/types";
import type { CareerSave } from "../../../storage/saves/schema";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function clampRelationship(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

function findNpc(state: RelationshipState, role: RelationshipNpc["role"]): RelationshipNpc {
  const npc = state.npcs.find((item) => item.role === role);
  if (!npc) throw new Error(`Missing relationship NPC: ${role}`);
  return npc;
}

function eventId(save: CareerSave, type: RelationshipEventType): string {
  return `relationship-event-${type}-${save.life.completedDays}-${toGameDateKey(save.meta.currentDate)}`;
}

function option(
  id: string,
  label: string,
  detail: string,
  tone: RelationshipEventOption["tone"],
  effects: RelationshipEventOption["effects"],
  memory: string,
  outcome: string,
  followUp?: RelationshipEventOption["followUp"],
): RelationshipEventOption {
  return { id, label, detail, tone, effects, memory, outcome, ...(followUp ? { followUp } : {}) };
}

function coachAccountability(save: CareerSave, coach: RelationshipNpc): RelationshipEvent {
  return {
    id: eventId(save, "coach-accountability"),
    type: "coach-accountability",
    createdOn: save.meta.currentDate,
    title: "После тренировки",
    scene: `${coach.name} задерживает тебя у выхода с поля. Остальные уже ушли в раздевалку. Он открывает планшет с сегодняшними повторениями и показывает два эпизода, где ты сорвал назначение.`,
    context: [
      `Доверие штаба: ${Math.round(save.football.depthChart.coachTrust)}.`,
      `Последний день: ${save.life.lastOutcome?.grade ?? "без оценки"}.`,
      `Текущее место в depth chart: #${save.football.depthChart.rank}.`,
    ],
    participantIds: [coach.id],
    primaryNpcId: coach.id,
    options: [
      option(
        "own-mistakes",
        "Признать ошибки",
        "Коротко подтвердить, что назначения были прочитаны неправильно.",
        "open",
        { relationship: 8, coachTrust: 3, confidence: -1, stress: -2 },
        "Ты не стал спорить с видео и признал собственные ошибки.",
        "Тренер принимает ответ и требует исправить детали на следующей тренировке.",
      ),
      option(
        "ask-plan",
        "Попросить конкретный план",
        "Уточнить, какие два элемента нужно исправить прежде всего.",
        "calm",
        { relationship: 12, coachTrust: 4, stress: 1, energy: -2 },
        "Ты попросил конкретный план работы вместо общих обещаний.",
        "Тренер назначает тебе короткий индивидуальный блок и обещает пересмотреть повторения через несколько дней.",
        { type: "coach-plan-review", delayDays: 3 },
      ),
      option(
        "push-back",
        "Оспорить оценку",
        "Сказать, что часть ошибок возникла из-за вызова розыгрыша и действий партнёров.",
        "defensive",
        { relationship: -13, coachTrust: -6, confidence: 2, stress: 5 },
        "Ты оспорил разбор и переложил часть ответственности на схему и партнёров.",
        "Разговор заканчивается быстро. Тренер убирает планшет и говорит, что следующий depth chart всё покажет.",
      ),
    ],
  };
}

function coachPlanReview(save: CareerSave, coach: RelationshipNpc): RelationshipEvent {
  const trainingGrade = save.football.training.lastSession?.grade ?? "C";
  return {
    id: eventId(save, "coach-plan-review"),
    type: "coach-plan-review",
    createdOn: save.meta.currentDate,
    title: "Повторный просмотр",
    scene: `${coach.name} снова вызывает тебя к планшету. На этот раз он сравнивает старые повторения с последней тренировкой.`,
    context: [
      `Последняя тренировка: ${trainingGrade}.`,
      `Тренировочный акцент: ${save.football.training.lastSession?.focusName ?? "не завершён"}.`,
      `Доверие штаба: ${Math.round(save.football.depthChart.coachTrust)}.`,
    ],
    participantIds: [coach.id],
    primaryNpcId: coach.id,
    options: [
      option("review-detail", "Разобрать всё до конца", "Остаться после встречи и пройти каждый спорный эпизод.", "open", { relationship: 10, coachTrust: 4, energy: -4 }, "Ты остался на полный разбор повторений.", "Тренер отмечает прогресс и даёт тебе больше ответственности в следующем install-блоке."),
      option("take-summary", "Взять короткие выводы", "Записать два исправления и уйти восстанавливаться.", "calm", { relationship: 3, coachTrust: 1, energy: 2, stress: -1 }, "Ты взял короткий список исправлений и не перегрузил день.", "Тренер не возражает. Он ждёт, что изменения появятся на поле."),
      option("say-fixed", "Сказать, что всё уже исправлено", "Закрыть разговор уверенно и не оставаться на дополнительный разбор.", "firm", { relationship: -5, coachTrust: -2, confidence: 2 }, "Ты заявил, что уже понял проблему и не нуждаешься в дополнительном разборе.", "Тренер ничего не доказывает. Следующая тренировка станет проверкой твоих слов."),
    ],
  };
}

function rivalPressure(save: CareerSave, rival: RelationshipNpc): RelationshipEvent {
  return {
    id: eventId(save, "rival-pressure"),
    type: "rival-pressure",
    createdOn: save.meta.currentDate,
    title: "Повторения первой группы",
    scene: `${rival.name} остаётся рядом после объявления тренировочных групп. Он говорит тихо, чтобы тренеры не слышали: место ещё ничего не значит, пока не начались настоящие матчи.`,
    context: [
      `Ты находишься на месте #${save.football.depthChart.rank}.`,
      `Разница в оценке штаба: ${save.football.depthChart.evaluation.gap.toFixed(1)}.`,
      `${rival.name}: ${save.football.depthChart.directRival.overall} OVR.`,
    ],
    participantIds: [rival.id],
    primaryNpcId: rival.id,
    options: [
      option("respect-competition", "Принять конкуренцию", "Ответить, что место решат тренировки и матчи.", "calm", { relationship: 7, confidence: 1, stress: -1 }, "Ты признал конкуренцию и не стал превращать её в личный конфликт.", "Он коротко кивает. Напряжение остаётся, но разговор не переходит грань."),
      option("keep-distance", "Не продолжать разговор", "Уйти в раздевалку без ответа.", "firm", { relationship: -2, stress: 1 }, "Ты не стал отвечать на выпад и ушёл.", "Ривал считает это холодным ответом и продолжает следить за каждым твоим повторением."),
      option("claim-spot", "Сказать, что место уже твоё", "Жёстко обозначить, что он опоздал с борьбой.", "defensive", { relationship: -15, confidence: 3, stress: 3, teamMorale: -2 }, "Ты заявил, что борьба за место уже закончена.", "Разговор становится личным. Несколько игроков слышат последние слова."),
    ],
  };
}

function familyAcademics(save: CareerSave, guardian: RelationshipNpc): RelationshipEvent {
  return {
    id: eventId(save, "family-academics"),
    type: "family-academics",
    createdOn: save.meta.currentDate,
    title: "Разговор дома",
    scene: `${guardian.name} кладёт на стол письмо из школы. Там отмечены пропуски и риск по одному из предметов. Разговор начинается до того, как ты успеваешь переодеться после тренировки.`,
    context: [
      `GPA: ${save.character.education.gpa.toFixed(2)}.`,
      `Посещаемость: ${Math.round(save.character.education.attendance)}%.`,
      `Статус eligibility: ${save.character.education.eligibilityStatus}.`,
    ],
    participantIds: [guardian.id],
    primaryNpcId: guardian.id,
    options: [
      option("promise-study", "Взять обязательство", "Пообещать два учебных блока до конца недели.", "open", { relationship: 10, stress: 2, energy: -2, gpa: 0.03 }, "Ты взял конкретное обязательство по учёбе.", "Дома принимают обещание, но предупредили, что будут проверять результат.", { type: "family-check-in", delayDays: 5 }),
      option("explain-load", "Показать расписание", "Объяснить, где возникла перегрузка, и вместе убрать один необязательный блок.", "calm", { relationship: 6, stress: -3, energy: 2, gpa: 0.01 }, "Ты объяснил нагрузку и согласовал более реалистичный режим.", "Разговор заканчивается спокойно. От тебя ждут не слов, а устойчивой посещаемости."),
      option("dismiss", "Отмахнуться", "Сказать, что футбол сейчас важнее одного школьного письма.", "defensive", { relationship: -16, stress: 5, confidence: 1, gpa: -0.02 }, "Ты отмахнулся от школьного предупреждения.", "Разговор обрывается. Дома решают связаться со школьным консультантом без тебя."),
    ],
  };
}

function familyCheckIn(save: CareerSave, guardian: RelationshipNpc): RelationshipEvent {
  return {
    id: eventId(save, "family-check-in"),
    type: "family-check-in",
    createdOn: save.meta.currentDate,
    title: "Проверка обещания",
    scene: `${guardian.name} спрашивает, что изменилось после прошлого разговора. На столе лежит открытый школьный портал с обновлённой посещаемостью.`,
    context: [
      `Текущий GPA: ${save.character.education.gpa.toFixed(2)}.`,
      `Посещаемость: ${Math.round(save.character.education.attendance)}%.`,
      `Режим недели: ${save.life.weeklyPlan.templateId}.`,
    ],
    participantIds: [guardian.id],
    primaryNpcId: guardian.id,
    options: [
      option("show-progress", "Показать сделанное", "Открыть задания и спокойно пройти по результатам.", "open", { relationship: 9, stress: -3, gpa: 0.02 }, "Ты показал конкретный прогресс после обещания.", "Дома снимают часть давления и дают тебе самому держать режим."),
      option("admit-missed", "Признать, что не успел", "Не придумывать оправдания и предложить новый срок.", "calm", { relationship: 2, stress: 2, gpa: 0.01 }, "Ты признал, что не выполнил обещание полностью.", "Разочарование остаётся, но честность не даёт разговору перейти в ссору."),
      option("avoid", "Уйти от разговора", "Сослаться на усталость и закрыться в комнате.", "defensive", { relationship: -12, stress: 4 }, "Ты ушёл от проверки обещания.", "Дома перестают верить устным обещаниям и требуют разговора со школой."),
    ],
  };
}

function teammateFilm(save: CareerSave, teammate: RelationshipNpc): RelationshipEvent {
  return {
    id: eventId(save, "teammate-film"),
    type: "teammate-film",
    createdOn: save.meta.currentDate,
    title: "Пустая видеокомната",
    scene: `${teammate.name} ловит тебя после ужина и предлагает на сорок минут открыть плёнку следующего соперника. Тренеров рядом нет.`,
    context: [
      `Следующий соперник: ${save.football.season.nextOpponent.name}.`,
      `Знание схемы команды: ${Math.round(save.football.teamDynamics.schemeMastery)}.`,
      `Твоя энергия: ${Math.round(save.character.condition.energy)}.`,
    ],
    participantIds: [teammate.id],
    primaryNpcId: teammate.id,
    options: [
      option("join-film", "Остаться на просмотр", "Разобрать основные тенденции соперника вместе.", "open", { relationship: 9, energy: -4, stress: -1, teamMorale: 1 }, "Ты остался разбирать плёнку вместе с партнёром.", "Вы находите несколько полезных деталей и договариваетесь проверить их на тренировке."),
      option("share-notes", "Обменяться заметками", "Передать свои наблюдения и уйти восстанавливаться.", "calm", { relationship: 4, energy: 1 }, "Ты поделился заметками, но выбрал восстановление вместо полного просмотра.", "Партнёр принимает решение и обещает прислать короткую выжимку."),
      option("refuse", "Отказаться", "Сказать, что вне командного времени каждый отвечает за себя.", "firm", { relationship: -7, energy: 3, teamMorale: -1 }, "Ты отказался от совместной подготовки.", "Партнёр больше не предлагает помощь и уходит смотреть плёнку один."),
    ],
  };
}

function counselorWarning(save: CareerSave, counselor: RelationshipNpc): RelationshipEvent {
  return {
    id: eventId(save, "counselor-warning"),
    type: "counselor-warning",
    createdOn: save.meta.currentDate,
    title: "Вызов к консультанту",
    scene: `${counselor.name} закрывает дверь кабинета и показывает календарь академических дедлайнов. До первой серьёзной проверки eligibility осталось меньше времени, чем кажется.`,
    context: [
      `GPA: ${save.character.education.gpa.toFixed(2)}.`,
      `Посещаемость: ${Math.round(save.character.education.attendance)}%.`,
      `Интерес колледжей: ${save.football.recruitment.interestedPrograms}.`,
    ],
    participantIds: [counselor.id],
    primaryNpcId: counselor.id,
    options: [
      option("accept-tutoring", "Принять помощь", "Согласиться на два контролируемых учебных блока.", "open", { relationship: 10, energy: -3, stress: 1, gpa: 0.04 }, "Ты согласился на дополнительную учебную поддержку.", "Консультант ставит встречи в расписание и предупреждает преподавателей."),
      option("self-plan", "Предложить свой план", "Показать, как ты сам закроешь долги до дедлайна.", "firm", { relationship: 4, stress: 2, gpa: 0.02 }, "Ты предложил собственный план закрытия академических долгов.", "Консультант даёт неделю и просит принести подтверждение выполнения."),
      option("minimize", "Сказать, что всё под контролем", "Не принимать помощь и вернуться к футбольному расписанию.", "defensive", { relationship: -9, stress: 3, gpa: -0.01 }, "Ты отказался признавать серьёзность академического риска.", "Консультант фиксирует отказ и готовит разговор с семьёй и тренерским штабом."),
    ],
  };
}

function reporterSpotlight(save: CareerSave, reporter: RelationshipNpc): RelationshipEvent {
  return {
    id: eventId(save, "reporter-spotlight"),
    type: "reporter-spotlight",
    createdOn: save.meta.currentDate,
    title: "Вопрос у выхода со стадиона",
    scene: `${reporter.name} ждёт за ограждением после матча. Он называет твою статистику и спрашивает, считаешь ли ты себя главным игроком этой команды.`,
    context: [
      `Медийная видимость: ${Math.round(save.football.recruitment.visibility)}.`,
      `Последний результат: ${save.football.match.finalResult?.grade ?? "без оценки"}.`,
      `Рекорд команды: ${save.football.season.wins}-${save.football.season.losses}.`,
    ],
    participantIds: [reporter.id],
    primaryNpcId: reporter.id,
    options: [
      option("credit-team", "Говорить о команде", "Отдать заслугу линии, партнёрам и штабу.", "calm", { relationship: 5, visibility: 2, teamMorale: 2 }, "Ты публично отдал заслугу команде.", "Материал выходит спокойным. В раздевалке замечают, что ты не потянул внимание на себя."),
      option("own-performance", "Взять ответственность", "Сказать, что хочешь быть игроком, решающим большие эпизоды.", "firm", { relationship: 8, visibility: 5, confidence: 2, teamMorale: -1 }, "Ты открыто заявил о своих больших амбициях.", "Цитату подхватывают местные спортивные страницы. В команде реакция смешанная."),
      option("walk-away", "Не отвечать", "Пройти мимо и не давать комментарий без согласования со школой.", "calm", { relationship: -4, visibility: -1 }, "Ты отказался говорить после матча.", "Репортёр публикует короткую заметку без твоих слов и продолжает искать другой угол истории."),
    ],
  };
}

function buildEvent(save: CareerSave, type: RelationshipEventType, primaryNpcId?: string): RelationshipEvent {
  const state = save.relationships;
  switch (type) {
    case "coach-accountability": return coachAccountability(save, findNpc(state, "position-coach"));
    case "coach-plan-review": return coachPlanReview(save, state.npcs.find((npc) => npc.id === primaryNpcId) ?? findNpc(state, "position-coach"));
    case "rival-pressure": return rivalPressure(save, findNpc(state, "rival"));
    case "family-academics": return familyAcademics(save, findNpc(state, "guardian"));
    case "family-check-in": return familyCheckIn(save, state.npcs.find((npc) => npc.id === primaryNpcId) ?? findNpc(state, "guardian"));
    case "teammate-film": return teammateFilm(save, findNpc(state, "teammate"));
    case "counselor-warning": return counselorWarning(save, findNpc(state, "counselor"));
    case "reporter-spotlight": return reporterSpotlight(save, findNpc(state, "reporter"));
  }
}

function recentlyResolved(save: CareerSave, type: RelationshipEventType, cooldownDays = 4): boolean {
  const latest = [...save.relationships.resolvedEvents].reverse().find((event) => event.type === type);
  return Boolean(latest && save.life.completedDays - latest.resolvedAtCompletedDay < cooldownDays);
}

function chooseNewEvent(save: CareerSave): RelationshipEventType | undefined {
  const random = new SeededRandom(`${save.meta.worldSeed}:relationship-day:${save.life.completedDays}`);
  const lastGrade = save.life.lastOutcome?.grade;
  const lastDepth = save.football.depthChart.lastDecision.type;

  if (save.character.education.eligibilityStatus === "at-risk" && !recentlyResolved(save, "counselor-warning", 6)) return "counselor-warning";
  if ((save.character.education.gpa < 2.6 || save.character.education.attendance < 80) && !recentlyResolved(save, "family-academics", 6)) return "family-academics";
  if ((save.football.depthChart.coachTrust < 48 || lastGrade === "D" || lastDepth === "demoted") && !recentlyResolved(save, "coach-accountability", 4)) return "coach-accountability";
  if (save.football.match.status === "complete" && save.football.match.finalResult && save.football.recruitment.visibility >= 45 && !recentlyResolved(save, "reporter-spotlight", 5) && random.chance(0.5)) return "reporter-spotlight";
  if (save.life.completedDays >= 2 && (save.football.depthChart.rank === 1 || save.football.depthChart.evaluation.gap < 5) && !recentlyResolved(save, "rival-pressure", 4) && random.chance(0.48)) return "rival-pressure";
  if (save.life.dayIndex >= 2 && save.life.dayIndex <= 4 && !recentlyResolved(save, "teammate-film", 4) && random.chance(0.46)) return "teammate-film";
  if (save.life.completedDays === 1) return "teammate-film";
  return undefined;
}

function updateNpcSituations(save: CareerSave): RelationshipNpc[] {
  return save.relationships.npcs.map((npc) => {
    if (npc.role === "rival") {
      return {
        ...npc,
        status: save.football.depthChart.rank === 1 ? "frustrated" : "focused",
        currentSituation: save.football.depthChart.rank === 1
          ? "Тренируется с ощущением, что место первой группы уходит из рук."
          : "Продолжает получать часть важных повторений и не считает борьбу законченной.",
      };
    }
    if (npc.role === "guardian" && save.character.education.eligibilityStatus !== "clear") {
      return { ...npc, status: "concerned", currentSituation: "Следит за школьными уведомлениями и готов вмешаться в твой режим." };
    }
    if (npc.role === "reporter" && save.football.recruitment.visibility >= 55) {
      return { ...npc, status: "hopeful", currentSituation: "Запрашивает комментарии после матчей и собирает материал о твоём сезоне." };
    }
    if (npc.role === "head-coach") {
      return { ...npc, status: save.football.season.losses > save.football.season.wins ? "under-pressure" : "focused" };
    }
    return npc;
  });
}

export function advanceRelationshipWorld(save: CareerSave): RelationshipState {
  const base: RelationshipState = {
    ...save.relationships,
    npcs: updateNpcSituations(save),
  };
  if (base.pendingEvent || base.lastGeneratedCompletedDay === save.life.completedDays) return base;

  const due = [...base.queuedEvents]
    .filter((event) => event.dueCompletedDay <= save.life.completedDays)
    .sort((left, right) => left.dueCompletedDay - right.dueCompletedDay)[0];
  if (due) {
    return {
      ...base,
      pendingEvent: buildEvent({ ...save, relationships: base }, due.type, due.primaryNpcId),
      queuedEvents: base.queuedEvents.filter((event) => event.id !== due.id),
      lastGeneratedCompletedDay: save.life.completedDays,
    };
  }

  const type = chooseNewEvent({ ...save, relationships: base });
  return {
    ...base,
    ...(type ? { pendingEvent: buildEvent({ ...save, relationships: base }, type) } : {}),
    lastGeneratedCompletedDay: save.life.completedDays,
  };
}

function applyNpcMemory(npc: RelationshipNpc, save: CareerSave, event: RelationshipEvent, selected: RelationshipEventOption): RelationshipNpc {
  const nextRelationship = clampRelationship(npc.relationship + selected.effects.relationship);
  const memory = {
    id: `memory-${event.id}-${selected.id}`,
    date: save.meta.currentDate,
    summary: selected.memory,
    impact: selected.effects.relationship,
    importance: Math.min(5, Math.max(1, Math.ceil(Math.abs(selected.effects.relationship) / 4))) as 1 | 2 | 3 | 4 | 5,
  };
  return {
    ...npc,
    relationship: nextRelationship,
    currentSituation: selected.outcome,
    status: selected.effects.relationship <= -10 ? "frustrated" : selected.effects.relationship >= 8 ? "hopeful" : npc.status,
    memories: [...npc.memories, memory].slice(-12),
  };
}

export function resolveRelationshipEvent(save: CareerSave, optionId: string): CareerSave {
  const event = save.relationships.pendingEvent;
  if (!event) throw new Error("No pending relationship event");
  const selected = event.options.find((item) => item.id === optionId);
  if (!selected) throw new Error(`Unknown relationship event option: ${optionId}`);

  const effects = selected.effects;
  const nextNpcs = save.relationships.npcs.map((npc) => (
    npc.id === event.primaryNpcId ? applyNpcMemory(npc, save, event, selected) : npc
  ));
  const followUps: QueuedRelationshipEvent[] = selected.followUp
    ? [{
        id: `queued-${event.id}-${selected.followUp.type}`,
        type: selected.followUp.type,
        dueCompletedDay: save.life.completedDays + selected.followUp.delayDays,
        primaryNpcId: event.primaryNpcId,
      }]
    : [];

  const nextCoachTrust = clamp(save.football.depthChart.coachTrust + (effects.coachTrust ?? 0));
  const nextGpa = Math.max(0, Math.min(4, Math.round((save.character.education.gpa + (effects.gpa ?? 0)) * 100) / 100));
  const nextRelationshipState: RelationshipState = {
    ...save.relationships,
    npcs: nextNpcs,
    pendingEvent: undefined,
    queuedEvents: [...save.relationships.queuedEvents, ...followUps],
    resolvedEvents: [
      ...save.relationships.resolvedEvents,
      {
        id: event.id,
        type: event.type,
        title: event.title,
        resolvedOn: save.meta.currentDate,
        resolvedAtCompletedDay: save.life.completedDays,
        primaryNpcId: event.primaryNpcId,
        optionId: selected.id,
        outcome: selected.outcome,
        relationshipDelta: effects.relationship,
      },
    ].slice(-30),
  };

  return {
    ...save,
    character: {
      ...save.character,
      condition: {
        ...save.character.condition,
        confidence: clamp(save.character.condition.confidence + (effects.confidence ?? 0)),
        stress: clamp(save.character.condition.stress + (effects.stress ?? 0)),
        energy: clamp(save.character.condition.energy + (effects.energy ?? 0)),
      },
      education: {
        ...save.character.education,
        gpa: nextGpa,
        eligibilityStatus: nextGpa >= 2.5 ? "clear" : nextGpa >= 2.1 ? "watch" : "at-risk",
      },
    },
    football: {
      ...save.football,
      depthChart: {
        ...save.football.depthChart,
        coachTrust: nextCoachTrust,
      },
      teamDynamics: {
        ...save.football.teamDynamics,
        morale: clamp(save.football.teamDynamics.morale + (effects.teamMorale ?? 0)),
      },
      recruitment: {
        ...save.football.recruitment,
        visibility: clamp(save.football.recruitment.visibility + (effects.visibility ?? 0)),
      },
    },
    relationships: nextRelationshipState,
    history: [
      ...save.history,
      {
        id: `history-${event.id}-${selected.id}`,
        occurredAt: save.meta.updatedAt,
        type: "relationship-event-resolved",
        title: event.title,
        description: selected.outcome,
      },
    ],
  };
}
