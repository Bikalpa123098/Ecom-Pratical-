import { describe, expect, it } from "vitest";
import {
  DISTRICT_SUGGESTIONS,
  isInsideKathmanduValley,
  isValidProvince,
  KATHMANDU_VALLEY_DISTRICTS,
  MUNICIPALITY_SUGGESTIONS,
  NEPAL_PROVINCES,
} from "@/lib/geo";

describe("provinces", () => {
  it("contains exactly Nepal's seven provinces", () => {
    expect(NEPAL_PROVINCES).toHaveLength(7);
    expect([...NEPAL_PROVINCES]).toEqual([
      "Koshi",
      "Madhesh",
      "Bagmati",
      "Gandaki",
      "Lumbini",
      "Karnali",
      "Sudurpashchim",
    ]);
  });

  it("has no duplicate provinces", () => {
    expect(new Set(NEPAL_PROVINCES).size).toBe(NEPAL_PROVINCES.length);
  });

  it("validates province names", () => {
    expect(isValidProvince("Bagmati")).toBe(true);
    expect(isValidProvince("Bagmati Province")).toBe(false);
    expect(isValidProvince("")).toBe(false);
  });
});

describe("delivery zone", () => {
  it("treats only the three Valley districts as inside", () => {
    expect(KATHMANDU_VALLEY_DISTRICTS).toEqual(["Kathmandu", "Lalitpur", "Bhaktapur"]);
    expect(isInsideKathmanduValley("Kathmandu")).toBe(true);
    expect(isInsideKathmanduValley("Lalitpur")).toBe(true);
    expect(isInsideKathmanduValley("Bhaktapur")).toBe(true);
  });

  it("does not treat Rupandehi as inside the valley", () => {
    // Operator's home district — Butwal and Bhairahawa are outside the Valley.
    expect(isInsideKathmanduValley("Rupandehi")).toBe(false);
    expect(isInsideKathmanduValley("rupandehi")).toBe(false);
    expect(isInsideKathmanduValley("Rupandehi ")).toBe(false);
  });

  it("charges the outside rate for other major cities", () => {
    for (const d of ["Morang", "Kaski", "Banke", "Sunsari", "Chitwan"]) {
      expect(isInsideKathmanduValley(d), d).toBe(false);
    }
  });
});

describe("suggestion lists", () => {
  it("has no duplicate district suggestions", () => {
    const dupes = DISTRICT_SUGGESTIONS.filter(
      (d, i) => DISTRICT_SUGGESTIONS.indexOf(d) !== i
    );
    expect(dupes).toEqual([]);
  });

  it("has no duplicate municipality suggestions", () => {
    const dupes = MUNICIPALITY_SUGGESTIONS.filter(
      (m, i) => MUNICIPALITY_SUGGESTIONS.indexOf(m) !== i
    );
    expect(dupes).toEqual([]);
  });

  it("offers both Rupandehi cities", () => {
    expect(MUNICIPALITY_SUGGESTIONS).toContain("Butwal Sub-Metropolitan City");
    expect(MUNICIPALITY_SUGGESTIONS).toContain("Bhairahawa Municipality");
  });

  it("keeps every Valley district suggestion in sync with the delivery zone", () => {
    for (const d of KATHMANDU_VALLEY_DISTRICTS) {
      expect(DISTRICT_SUGGESTIONS, d).toContain(d);
    }
  });
});
