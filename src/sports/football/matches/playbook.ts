import type { FootballPosition } from "../career/types";
import type { MatchHeroInvolvement, MatchPlayCall, MatchUnit } from "./types";
import { SeededRandom } from "../../../core/random/SeededRandom";

interface PlayDescriptor {
  formation: string;
  personnel: string;
  concept: string;
  playType: MatchPlayCall["playType"];
  strength: MatchPlayCall["strength"];
}

const offenseCalls: readonly PlayDescriptor[] = [
  { formation: "Gun Trips", personnel: "11", concept: "Inside Zone", playType: "run", strength: "right" },
  { formation: "Gun Doubles", personnel: "11", concept: "Mesh", playType: "pass", strength: "middle" },
  { formation: "Singleback Ace", personnel: "12", concept: "Duo", playType: "run", strength: "middle" },
  { formation: "Pistol Strong", personnel: "21", concept: "Power Read", playType: "run", strength: "left" },
  { formation: "Gun Trips", personnel: "11", concept: "Flood", playType: "pass", strength: "right" },
  { formation: "Singleback Ace", personnel: "12", concept: "Boot Cross", playType: "play-action", strength: "left" },
  { formation: "Empty", personnel: "10", concept: "Spacing", playType: "pass", strength: "middle" },
  { formation: "Gun Doubles", personnel: "11", concept: "Tunnel Screen", playType: "screen", strength: "right" },
  { formation: "Goal Line", personnel: "23", concept: "Power O", playType: "run", strength: "left" },
];

const defenseCalls: readonly PlayDescriptor[] = [
  { formation: "4–3 Over", personnel: "Base", concept: "Cover 3 Buzz", playType: "coverage", strength: "right" },
  { formation: "4–3 Under", personnel: "Base", concept: "Sam Fire", playType: "blitz", strength: "left" },
  { formation: "Nickel 4–2–5", personnel: "Nickel", concept: "Quarters Match", playType: "coverage", strength: "middle" },
  { formation: "Nickel 4–2–5", personnel: "Nickel", concept: "Double A Mug", playType: "blitz", strength: "middle" },
  { formation: "3–4 Odd", personnel: "Base", concept: "Fire Zone", playType: "blitz", strength: "right" },
  { formation: "Dime", personnel: "Dime", concept: "Cover 2 Man", playType: "coverage", strength: "middle" },
  { formation: "Bear Front", personnel: "Heavy", concept: "Cover 1 Robber", playType: "coverage", strength: "left" },
  { formation: "Goal Line", personnel: "Heavy", concept: "Zero Pressure", playType: "blitz", strength: "middle" },
];

export function callPlay(seed: string, unit: MatchUnit, down: number, distance: number, fieldPosition: number, canCheck: boolean): MatchPlayCall {
  const random = new SeededRandom(seed);
  const catalog = unit === "offense" ? offenseCalls : defenseCalls;
  let candidates = [...catalog];
  if (unit === "offense") {
    if (distance >= 8) candidates = candidates.filter((play) => play.playType !== "run" || play.formation === "Empty");
    if (distance <= 3) candidates = candidates.filter((play) => play.playType === "run" || play.playType === "play-action");
    if (fieldPosition >= 88) candidates = candidates.filter((play) => play.formation === "Goal Line" || play.personnel === "12");
  } else {
    if (distance >= 8) candidates = candidates.filter((play) => play.formation.includes("Nickel") || play.formation === "Dime");
    if (distance <= 2 || fieldPosition >= 92) candidates = candidates.filter((play) => play.formation === "Bear Front" || play.formation === "Goal Line" || play.formation.includes("4–3"));
    if (down === 3 && distance >= 5) candidates = candidates.filter((play) => play.playType === "blitz" || play.formation === "Dime");
  }
  const selected = random.pick(candidates.length > 0 ? candidates : [...catalog]);
  return {
    ...selected,
    calledBy: unit === "offense" ? "offensive-coordinator" : "defensive-coordinator",
    canCheck,
  };
}

export function heroAssignment(position: FootballPosition, play: MatchPlayCall, seed: string): { involvement: MatchHeroInvolvement; role: string } {
  const random = new SeededRandom(seed);
  if (position === "QB") {
    return { involvement: "primary", role: play.playType === "run" ? "Передать мяч, прочитать backside и держать boot threat" : "Пройти progression и управлять карманом" };
  }
  if (position === "RB") {
    if (play.playType === "run") {
      const isPrimaryCarrier = random.chance(.82);
      return { involvement: isPrimaryCarrier ? "primary" : "secondary", role: isPrimaryCarrier ? "Основной вынос" : "Фальшивый mesh и блок backside" };
    }
    if (play.playType === "screen") return { involvement: random.chance(.7) ? "primary" : "secondary", role: "Задержать rush и выйти за блоками" };
    return random.chance(.28)
      ? { involvement: "secondary", role: "Checkdown-маршрут после проверки blitz" }
      : { involvement: "assignment-only", role: "Pass protection и подбор свободного rusher" };
  }
  if (position === "WR") {
    if (play.playType === "run") return { involvement: "assignment-only", role: "Периметровый блок и удержание cornerback" };
    const roll = random.integer(1, 100);
    if (roll <= 32) return { involvement: "primary", role: "Первое окно progression и возможный target" };
    if (roll <= 72) return { involvement: "secondary", role: "Маршрут растягивает coverage и остаётся вторым чтением" };
    return { involvement: "assignment-only", role: "Clear-out маршрут или stalk block без ожидаемого паса" };
  }
  if (position === "LB") {
    if (play.playType === "blitz") return random.chance(.45) ? { involvement: "primary", role: "Основной blitz через назначенный gap" } : { involvement: "secondary", role: "Contain и закрытие escape lane" };
    return random.chance(.38)
      ? { involvement: "primary", role: "Run fit или зона рядом с точкой атаки" }
      : random.chance(.5)
        ? { involvement: "secondary", role: "Hook/curl и pursuit к мячу" }
        : { involvement: "assignment-only", role: "Закрыть backside и не разрушить структуру" };
  }
  if (play.playType === "blitz") return { involvement: "assignment-only", role: "Man coverage без помощи safety" };
  const roll = random.integer(1, 100);
  if (roll <= 30) return { involvement: "primary", role: "Пас идёт в твою зону или на твоего ресивера" };
  if (roll <= 75) return { involvement: "secondary", role: "Сохранить leverage и закрыть второе окно" };
  return { involvement: "assignment-only", role: "Coverage away from ball и pursuit после приёма" };
}
