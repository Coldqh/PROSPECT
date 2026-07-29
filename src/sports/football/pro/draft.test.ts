import { describe, expect, it } from "vitest";
import {
  completeProfessionalEvaluation,
  openProfessionalDraftProcess,
  resolveProfessionalDeclaration,
  runProfessionalDraft,
  selectProfessionalAgent,
} from "./draft";
import { draftEligibleCareer, lowStockCareer } from "./professionalTestFixtures";

describe("professional draft ecosystem", () => {
  it("creates an autonomous seven-round draft around the hero", () => {
    const opened = openProfessionalDraftProcess(draftEligibleCareer());
    expect(opened.meta.phase).toBe("professional-draft");
    expect(opened.football.professional.teams).toHaveLength(16);
    expect(opened.football.professional.draftOrder).toHaveLength(112);
    expect(opened.football.professional.prospects.some((prospect) => prospect.isHero)).toBe(true);
    const worldIds = new Set(opened.world.players.map((player) => player.id));
    expect(opened.football.professional.prospects.filter((prospect) => !prospect.isHero).every((prospect) => prospect.sourcePlayerId && worldIds.has(prospect.sourcePlayerId))).toBe(true);
    expect(opened.football.professional.status).toBe("decision");
  });

  it("runs declaration, representation, evaluation and the complete draft", () => {
    let save = openProfessionalDraftProcess(draftEligibleCareer("professional-full-draft"));
    save = resolveProfessionalDeclaration(save, "declare");
    expect(save.football.college.heroCareer?.eligibilityYears).toBe(0);
    expect(save.world.players.find((player) => player.isHero)?.eligibility.athleticallyEligible).toBe(false);
    save = selectProfessionalAgent(save, save.football.professional.agents[1]!.id);
    save = completeProfessionalEvaluation(save, "athletic");
    save = runProfessionalDraft(save);
    expect(save.football.professional.draftResults).toHaveLength(112);
    expect(["drafted", "undrafted"]).toContain(save.football.professional.status);
    expect(save.football.professional.campInvites.length).toBeGreaterThan(0);
    expect(new Set(save.football.professional.draftResults.map((pick) => pick.prospectId)).size).toBe(112);
    expect(save.football.professional.draftResults.every((pick) => Boolean(pick.sourcePlayerId))).toBe(true);
    expect(save.world.careerRegistry.records.some((record) => record.currentStage === "professional" && record.draftYear === save.football.professional.draftYear)).toBe(true);
  });

  it("updates club needs as the autonomous draft fills rosters", () => {
    let save = openProfessionalDraftProcess(draftEligibleCareer("professional-needs"));
    const needsBefore = Object.fromEntries(save.football.professional.teams.map((team) => [team.id, { ...team.needs }]));
    save = resolveProfessionalDeclaration(save, "declare");
    save = selectProfessionalAgent(save, save.football.professional.agents[0]!.id);
    save = completeProfessionalEvaluation(save, "technical");
    save = runProfessionalDraft(save);
    expect(save.football.professional.teams.some((team) =>
      Object.entries(team.needs).some(([position, need]) => need < needsBefore[team.id]![position as keyof typeof team.needs]),
    )).toBe(true);
  });

  it("keeps the undrafted route alive for a prospect below the draft line", () => {
    let save = openProfessionalDraftProcess(lowStockCareer());
    save = resolveProfessionalDeclaration(save, "declare");
    save = selectProfessionalAgent(save, save.football.professional.agents[2]!.id);
    save = completeProfessionalEvaluation(save, "interview");
    save = runProfessionalDraft(save);
    expect(save.football.professional.status).toBe("undrafted");
    expect(save.football.professional.heroSelection).toBeUndefined();
    expect(save.football.professional.campInvites).toHaveLength(5);
  });

  it("allows an eligible athlete to return to college before declaring", () => {
    const opened = openProfessionalDraftProcess(draftEligibleCareer("professional-return"));
    const returned = resolveProfessionalDeclaration(opened, "return-college");
    expect(returned.meta.phase).toBe("college-season");
    expect(returned.football.stage).toBe("college-season");
    expect(returned.football.professional.status).toBe("dormant");
    expect(returned.football.professional.declared).toBe(false);
  });

  it("is deterministic for the same world seed", () => {
    const run = () => {
      let save = openProfessionalDraftProcess(draftEligibleCareer("professional-deterministic"));
      save = resolveProfessionalDeclaration(save, "declare");
      save = selectProfessionalAgent(save, save.football.professional.agents[0]!.id);
      save = completeProfessionalEvaluation(save, "interview");
      return runProfessionalDraft(save).football.professional;
    };
    expect(run()).toEqual(run());
  });
});
