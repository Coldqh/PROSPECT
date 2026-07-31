import { readFileSync } from "node:fs";

const recruiting = readFileSync(new URL("../src/components/career/RecruitingDashboard.tsx", import.meta.url), "utf8");
const market = readFileSync(new URL("../src/components/career/MarketDashboard.tsx", import.meta.url), "utf8");
const league = readFileSync(new URL("../src/components/career/LeagueDirectoryDashboard.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles/index.css", import.meta.url), "utf8");
const errors = [];

const required = [
  [recruiting, "МОЙ РЕКРУТИНГ", "recruiting summary is missing"],
  [recruiting, "ЧТО ПРОИСХОДИТ", "selected-program context is missing"],
  [recruiting, "СЛЕДУЮЩИЙ КОНТАКТ", "next recruiting action is missing"],
  [market, "Движение мира", "market weekly context is missing"],
  [market, "Что изменилось", "market digest is missing"],
  [market, "Кого ищут прямо сейчас", "team needs are missing"],
  [league, "ЦЕНТР СЕЗОНА", "league season center is missing"],
  [league, "Что происходит", "league overview navigation is missing"],
  [league, "ГЛАВНЫЙ МАТЧ НЕДЕЛИ", "featured game is missing"],
  [league, "Кто проходит сейчас", "professional playoff picture is missing"],
  [styles, '@import "./league.css";', "league stylesheet is not imported"],
];
for (const [source, token, message] of required) if (!source.includes(token)) errors.push(message);

const forbidden = [
  [recruiting, '"FIT ', "raw FIT code remains in recruiting"],
  [recruiting, '"NEED', "raw NEED code remains in recruiting"],
  [recruiting, '"DEPTH', "raw DEPTH code remains in recruiting"],
  [recruiting, "OverlayDialog", "recruiting still hides basic context in a modal"],
  [market, "transactionCode", "market still uses synthetic transaction codes"],
  [market, '"PORT"', "PORT code remains in market"],
  [market, '"OFFR"', "OFFR code remains in market"],
];
for (const [source, token, message] of forbidden) if (source.includes(token)) errors.push(message);

if (errors.length > 0) {
  console.error("Interface comprehension check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Interface comprehension OK: recruiting, market, college and PRO expose context before metrics.");
