import { describe, it, expect } from "vitest";
import { RELAXATIONS } from "./searchRelaxations";
import type { ParsedQuery } from "./ai";

function query(): ParsedQuery {
  return {
    budget_max: 500,
    location: "Hackney",
    event_date: null,
    semantic_query: "nut-free birthday catering",
    categories: ["Pizza"],
    attributes: { dietary: ["nut-free"], certifications: ["DBS checked"] },
  };
}

describe("search relaxation ladder", () => {
  it("relaxes budget, then area, then category — in that order", () => {
    expect(RELAXATIONS.map((r) => r.label)).toEqual(["budget", "area", "service type"]);
  });

  it("NEVER relaxes attributes — dietary/certifications are hard requirements", () => {
    const p = query();
    const before = JSON.stringify(p.attributes);
    // Apply every relaxation step; attributes must survive all of them.
    for (const step of RELAXATIONS) step.relax(p);
    expect(JSON.stringify(p.attributes)).toBe(before);
    expect(p.attributes).toEqual({ dietary: ["nut-free"], certifications: ["DBS checked"] });
  });

  it("each step actually clears its own constraint", () => {
    const p = query();
    RELAXATIONS.find((r) => r.label === "budget")!.relax(p);
    expect(p.budget_max).toBeNull();
    RELAXATIONS.find((r) => r.label === "service type")!.relax(p);
    expect(p.categories).toEqual([]);
  });

  it("only reports a step as constraining when it can bite", () => {
    const budget = RELAXATIONS.find((r) => r.label === "budget")!;
    expect(budget.constraining({ ...query(), budget_max: null }, null)).toBe(false);
    expect(budget.constraining(query(), null)).toBe(true);
    const area = RELAXATIONS.find((r) => r.label === "area")!;
    expect(area.constraining(query(), null)).toBe(false);
    expect(area.constraining(query(), { lat: 51, lng: 0 })).toBe(true);
  });
});
