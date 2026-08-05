import type { RecruitingProgram } from "../../recruiting/types";
import type { EcosystemCoach, EcosystemPlayer, EcosystemStory, EcosystemTeam, FootballEcosystemState } from "../types";
import { availableNilCapacity, availableRecruitingBudget, resourceRecruitingPower } from "../resources";
import type { EcosystemCareerState } from "./EcosystemCareerState";
import { clamp } from "./story";

export function updateHeroPrograms(
  programs: RecruitingProgram[],
  teams: EcosystemTeam[],
  players: EcosystemPlayer[],
  save: EcosystemCareerState,
): RecruitingProgram[] {
  return programs.map((program) => {
    const team = teams.find((item) => item.id === program.id);
    if (!team) return program;
    const competingCommits = players.filter(
      (player) => player.committedTeamId === program.id && player.position === save.football.position,
    ).length;
    const headCoach = save.world.coaches.find((coach) => coach.teamId === program.id && coach.role === "head-coach");
    const positionNeed = clamp(team.positionNeeds[save.football.position]);
    const depthCompetition = clamp(100 - positionNeed * 0.55 + team.rating * 0.22 + competingCommits * 8);
    const recruitingPower = resourceRecruitingPower(team.resources);
    const culture = save.world.social.teamCultures.find((item) => item.teamId === team.id);
    const staffTrust = clamp(
      22
        + (headCoach?.reputation ?? 50) * 0.32
        + (headCoach?.jobSecurity ?? 55) * 0.24
        + team.resources.boardPatience * 0.1
        + (culture?.coachTrust ?? 50) * 0.12
        - team.resources.financialPressure * 0.12
        - (headCoach?.status === "hot-seat" ? 12 : 0),
    );
    const roleClarity = clamp(
      18
        + positionNeed * 0.31
        + (100 - depthCompetition) * 0.18
        + recruitingPower * 0.08
        + (culture?.stability ?? 50) * 0.08
        - team.resources.financialPressure * 0.08
        - (headCoach?.status === "hot-seat" ? 8 : 0),
    );
    let lastUpdate = program.lastUpdate;
    if (competingCommits > 0) {
      lastUpdate = `В наборе уже ${competingCommits} игрок(а) на позицию ${save.football.position}; свободное место стало уже.`;
    }
    if (headCoach?.status === "hot-seat") {
      lastUpdate = `${headCoach.name} находится под давлением; стабильность обещаний снизилась.`;
    }
    if (team.resources.financialPressure >= 68) {
      lastUpdate = `${team.shortName} работает в режиме экономии; ресурсы на набор, NIL и удержание штаба ограничены.`;
    }
    return { ...program, positionNeed, depthCompetition, staffTrust, roleClarity, lastUpdate };
  });
}

export function market(players: EcosystemPlayer[], coaches: EcosystemCoach[], teams: EcosystemTeam[], talentPipeline: FootballEcosystemState["talentPipeline"], movementMarket: FootballEcosystemState["movementMarket"]) {
  const seniors = players.filter((player) => player.level === "high-school" && player.classYear === "Senior");
  const committedPlayers = seniors.filter((player) => player.recruitingStage === "committed").length;
  const collegeTeams = teams.filter((team) => team.level === "college");
  return {
    openScholarships: collegeTeams.reduce((sum, team) => sum + Math.max(0, team.compliance.fundedScholarships - team.compliance.scholarshipsUsed), 0),
    activeRecruitments: seniors.filter((player) => player.recruitingStage === "tracked" || player.recruitingStage === "offered").length,
    committedPlayers,
    coachingHotSeats: coaches.filter((coach) => coach.status === "hot-seat").length,
    portalPlayers: players.filter((player) => player.transferStatus === "portal").length,
    coachOpenings: 0,
    totalRecruitingBudget: Math.round(collegeTeams.reduce((sum, team) => sum + availableRecruitingBudget(team.resources), 0) * 100) / 100,
    totalNilCapacity: Math.round(collegeTeams.reduce((sum, team) => sum + availableNilCapacity(team.resources), 0) * 100) / 100,
    programsUnderFinancialPressure: collegeTeams.filter((team) => team.resources.financialPressure >= 65).length,
    annualProspects: players.filter((player) => player.level === "high-school" && player.talent.graduationYear >= talentPipeline.generationYear).length,
    jucoProspects: talentPipeline.independentProspects.filter((prospect) => prospect.route === "juco").length,
    walkOnProspects: talentPipeline.independentProspects.filter((prospect) => prospect.route === "walk-on").length,
    nationallyExposedProspects: players.filter((player) => player.level === "high-school" && player.talent.exposure === "national").length,
    plannedClassSpots: collegeTeams.reduce((sum, team) => sum + team.rosterPlan.targetClassSize, 0),
    developmentalPlayers: players.filter((player) => player.usagePlan === "developmental" || player.usagePlan === "redshirt").length,
    plannedPositionChanges: collegeTeams.reduce((sum, team) => sum + team.rosterPlan.positionChanges.filter((change) => !change.applied).length, 0),
    activeNegotiations: movementMarket.negotiations.filter((negotiation) => negotiation.status === "offered").length,
    withdrawnOffers: movementMarket.withdrawnOffers,
    transferCandidates: players.filter((player) => player.level === "college" && (player.transferStatus === "portal" || player.depthRank >= 3) && player.eligibilityYears > 1).length,
    lowSchemeFitPlayers: players.filter((player) => player.level === "college" && player.tactical.schemeFit < 55).length,
    programsInstallingNewSystems: collegeTeams.filter((team) => team.tactical.installation < 58 || team.tactical.continuity < 48).length,
  };
}

export function buildDigest(stories: EcosystemStory[], world: FootballEcosystemState): string[] {
  const recent = stories
    .slice(-18)
    .sort((left, right) => Number(right.relatedToHero) - Number(left.relatedToHero) || right.importance - left.importance)
    .slice(0, 4)
    .map((item) => item.detail);
  if (recent.length > 0) return recent;
  return [
    `${world.market.activeRecruitments} выпускников остаются в активном рекрутинге.`,
    `${world.market.coachingHotSeats} тренерских штабов работают под угрозой перемен.`,
    `${world.market.activeNegotiations} предложений остаются активными на едином рынке движения.`,
  ];
}

