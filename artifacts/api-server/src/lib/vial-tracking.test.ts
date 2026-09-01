import { describe, expect, it } from "vitest";
import { calculateVialTracking } from "./vial-tracking.js";

describe("calculateVialTracking", () => {
  it("subtracts completed injections from the full-vial dose count", () => {
    const tracking = calculateVialTracking(
      { vialAmount: "5", vialUnit: "mg", desiredDose: "250", doseUnit: "mcg" },
      [
        { actualDose: "250", actualDoseUnit: "mcg", plannedDose: "250", plannedDoseUnit: "mcg" },
        { actualDose: null, actualDoseUnit: null, plannedDose: "250", plannedDoseUnit: "mcg" },
      ],
    );

    expect(tracking?.totalDoses).toBeCloseTo(20);
    expect(tracking?.usedDoses).toBeCloseTo(2);
    expect(tracking?.remainingDoses).toBe(18);
    expect(tracking?.remainingAmount).toBeCloseTo(4.5);
    expect(tracking?.remainingAmountUnit).toBe("mg");
  });

  it("converts a changed actual dose before calculating what remains", () => {
    const tracking = calculateVialTracking(
      { vialAmount: "10000", vialUnit: "IU", desiredDose: "500", doseUnit: "IU" },
      [
        { actualDose: "1000", actualDoseUnit: "IU", plannedDose: "500", plannedDoseUnit: "IU" },
      ],
    );

    expect(tracking?.remainingDoses).toBe(18);
    expect(tracking?.remainingAmount).toBeCloseTo(9000);
  });

  it("returns null when vial and dose units cannot be compared", () => {
    expect(calculateVialTracking(
      { vialAmount: "5", vialUnit: "mg", desiredDose: "500", doseUnit: "IU" },
      [],
    )).toBeNull();
  });
});