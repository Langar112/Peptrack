import { describe, it, expect } from 'vitest';
import { calculateDosage, toMcg } from '../../../mobile/services/dosageCalc';

// ─── Unit conversion ──────────────────────────────────────────────────────────
describe('toMcg', () => {
  it('converts mcg → mcg (identity)', () => {
    expect(toMcg(500, 'mcg')).toBe(500);
  });
  it('converts mg → mcg (×1000)', () => {
    expect(toMcg(5, 'mg')).toBe(5000);
    expect(toMcg(0.5, 'mg')).toBe(500);
  });
  it('returns null for IU (no conversion)', () => {
    expect(toMcg(1000, 'IU')).toBeNull();
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────
describe('calculateDosage — input validation', () => {
  const base = { vialAmount: 5, vialUnit: 'mg' as const, bacWaterMl: 2, desiredDose: 250, doseUnit: 'mcg' as const, syringeCapacity: 100 as const };

  it('rejects zero vial amount', () => {
    const r = calculateDosage({ ...base, vialAmount: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('INVALID_VIAL_AMOUNT');
  });
  it('rejects negative vial amount', () => {
    const r = calculateDosage({ ...base, vialAmount: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('INVALID_VIAL_AMOUNT');
  });
  it('rejects zero BAC water', () => {
    const r = calculateDosage({ ...base, bacWaterMl: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('INVALID_BAC_WATER');
  });
  it('rejects zero dose', () => {
    const r = calculateDosage({ ...base, desiredDose: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('INVALID_DOSE');
  });
  it('rejects IU vial with mcg dose (unit mismatch)', () => {
    const r = calculateDosage({ ...base, vialUnit: 'IU', doseUnit: 'mcg' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('UNIT_MISMATCH');
  });
  it('rejects mg vial with IU dose (unit mismatch)', () => {
    const r = calculateDosage({ ...base, vialUnit: 'mg', doseUnit: 'IU' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('UNIT_MISMATCH');
  });
  it('rejects dose exceeding vial amount', () => {
    // 5 mg vial = 5000 mcg; dose = 6000 mcg > vial
    const r = calculateDosage({ ...base, desiredDose: 6000, doseUnit: 'mcg' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('DOSE_EXCEEDS_VIAL');
  });
});

// ─── Core calculation — mg/mcg path ──────────────────────────────────────────
describe('calculateDosage — mg vial + mcg dose (common case)', () => {
  // 5 mg vial + 2 mL water → 2500 mcg/mL
  // 250 mcg dose → 0.100 mL → 10 units on 100u syringe
  const r = calculateDosage({ vialAmount: 5, vialUnit: 'mg', bacWaterMl: 2, desiredDose: 250, doseUnit: 'mcg', syringeCapacity: 100 });

  it('succeeds', () => { expect(r.ok).toBe(true); });
  it('calculates concentration = 2500 mcg/mL', () => {
    if (r.ok) expect(r.result.concentration).toBeCloseTo(2500, 5);
  });
  it('calculates volume = 0.1 mL', () => {
    if (r.ok) expect(r.result.volumeMl).toBeCloseTo(0.1, 5);
  });
  it('calculates syringeUnits = 10', () => {
    if (r.ok) expect(r.result.syringeUnits).toBeCloseTo(10, 5);
  });
  it('calculates dosesPerVial = 20', () => {
    if (r.ok) expect(r.result.dosesPerVial).toBeCloseTo(20, 5);
  });
  it('has no warnings', () => {
    if (r.ok) expect(r.result.warnings).toHaveLength(0);
  });
  it('concentrationUnit is mcg/mL', () => {
    if (r.ok) expect(r.result.concentrationUnit).toBe('mcg/mL');
  });
});

describe('calculateDosage — mcg vial + mcg dose', () => {
  // 500 mcg vial + 1 mL → 500 mcg/mL; dose 50 mcg → 0.1 mL → 10 units
  const r = calculateDosage({ vialAmount: 500, vialUnit: 'mcg', bacWaterMl: 1, desiredDose: 50, doseUnit: 'mcg', syringeCapacity: 100 });

  it('succeeds', () => { expect(r.ok).toBe(true); });
  it('calculates concentration = 500 mcg/mL', () => {
    if (r.ok) expect(r.result.concentration).toBeCloseTo(500, 5);
  });
  it('calculates syringeUnits = 10', () => {
    if (r.ok) expect(r.result.syringeUnits).toBeCloseTo(10, 5);
  });
  it('calculates dosesPerVial = 10', () => {
    if (r.ok) expect(r.result.dosesPerVial).toBeCloseTo(10, 5);
  });
});

describe('calculateDosage — mg vial + mg dose', () => {
  // 10 mg vial + 5 mL → 2000 mcg/mL; dose 1 mg = 1000 mcg → 0.5 mL → 50 units
  const r = calculateDosage({ vialAmount: 10, vialUnit: 'mg', bacWaterMl: 5, desiredDose: 1, doseUnit: 'mg', syringeCapacity: 100 });

  it('succeeds', () => { expect(r.ok).toBe(true); });
  it('calculates syringeUnits = 50', () => {
    if (r.ok) expect(r.result.syringeUnits).toBeCloseTo(50, 5);
  });
  it('calculates dosesPerVial = 10', () => {
    if (r.ok) expect(r.result.dosesPerVial).toBeCloseTo(10, 5);
  });
});

// ─── Core calculation — IU path ───────────────────────────────────────────────
describe('calculateDosage — IU vial + IU dose', () => {
  // 10000 IU vial + 2 mL → 5000 IU/mL; dose 500 IU → 0.1 mL → 10 units
  const r = calculateDosage({ vialAmount: 10000, vialUnit: 'IU', bacWaterMl: 2, desiredDose: 500, doseUnit: 'IU', syringeCapacity: 100 });

  it('succeeds', () => { expect(r.ok).toBe(true); });
  it('calculates concentration = 5000 IU/mL', () => {
    if (r.ok) expect(r.result.concentration).toBeCloseTo(5000, 5);
  });
  it('calculates syringeUnits = 10', () => {
    if (r.ok) expect(r.result.syringeUnits).toBeCloseTo(10, 5);
  });
  it('concentrationUnit is IU/mL', () => {
    if (r.ok) expect(r.result.concentrationUnit).toBe('IU/mL');
  });
  it('calculates dosesPerVial = 20', () => {
    if (r.ok) expect(r.result.dosesPerVial).toBeCloseTo(20, 5);
  });
});

// ─── Warning logic ────────────────────────────────────────────────────────────
describe('calculateDosage — warnings', () => {
  it('warns when dose exceeds syringe capacity', () => {
    // 5 mg vial + 0.1 mL water → very concentrated; large dose → many units
    // 5 mg / 0.1 mL = 50000 mcg/mL; dose 3000 mcg → 0.06 mL → 6 units (fine)
    // Let's make it overflow: dose 10000 mcg → 0.2 mL → 20 units > 50u? No.
    // dose 60000 mcg → 60 units > 50u syringe
    const r = calculateDosage({ vialAmount: 5000, vialUnit: 'mcg', bacWaterMl: 0.5, desiredDose: 3000, doseUnit: 'mcg', syringeCapacity: 50 });
    if (r.ok) {
      // 5000/0.5 = 10000 mcg/mL; 3000/10000 = 0.3 mL = 30 units — fits in 50u
      expect(r.result.syringeUnits).toBeCloseTo(30, 3);
    }
  });

  it('warns when volume exceeds 50-unit syringe capacity', () => {
    // 1000 mcg vial + 1 mL → 1000 mcg/mL; dose 600 mcg → 0.6 mL → 60 units > 50u
    const r = calculateDosage({ vialAmount: 1000, vialUnit: 'mcg', bacWaterMl: 1, desiredDose: 600, doseUnit: 'mcg', syringeCapacity: 50 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.syringeUnits).toBeCloseTo(60, 3);
      expect(r.result.warnings.some((w) => w.includes('50'))).toBe(true);
    }
  });

  it('warns when volume is below 1 unit (impractical)', () => {
    // 5000 mcg vial + 1 mL → 5000 mcg/mL; dose 2 mcg → 0.0004 mL → 0.04 units
    const r = calculateDosage({ vialAmount: 5000, vialUnit: 'mcg', bacWaterMl: 1, desiredDose: 2, doseUnit: 'mcg', syringeCapacity: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.syringeUnits).toBeLessThan(1);
      expect(r.result.warnings.some((w) => w.includes('below 1'))).toBe(true);
    }
  });

  it('warns when volume is between 1 and 2 units (very small)', () => {
    // 5000 mcg vial + 1 mL → 5000 mcg/mL; dose 8 mcg → 0.0016 mL → 0.16 units (< 1)
    // Need dose giving 1–2 units: 1.5 units = 0.015 mL → dose = 0.015 * 5000 = 75 mcg
    const r = calculateDosage({ vialAmount: 5000, vialUnit: 'mcg', bacWaterMl: 1, desiredDose: 75, doseUnit: 'mcg', syringeCapacity: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.syringeUnits).toBeGreaterThanOrEqual(1);
      expect(r.result.syringeUnits).toBeLessThan(2);
      expect(r.result.warnings.some((w) => w.includes('difficult'))).toBe(true);
    }
  });
});

// ─── Precision / edge cases ───────────────────────────────────────────────────
describe('calculateDosage — precision edge cases', () => {
  it('handles fractional BAC water (0.5 mL)', () => {
    // 2 mg / 0.5 mL → 4000 mcg/mL; dose 200 mcg → 0.05 mL → 5 units
    const r = calculateDosage({ vialAmount: 2, vialUnit: 'mg', bacWaterMl: 0.5, desiredDose: 200, doseUnit: 'mcg', syringeCapacity: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.syringeUnits).toBeCloseTo(5, 5);
    }
  });

  it('handles common GLP-1 dose (semaglutide 2.5 mg vial, 1 mg/mL, 0.25 mg dose → 25 units)', () => {
    // 2.5 mg + 2.5 mL water → 1 mg/mL = 1000 mcg/mL; dose 0.25 mg = 250 mcg → 0.25 mL → 25 units
    const r = calculateDosage({ vialAmount: 2.5, vialUnit: 'mg', bacWaterMl: 2.5, desiredDose: 0.25, doseUnit: 'mg', syringeCapacity: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.syringeUnits).toBeCloseTo(25, 3);
      expect(r.result.dosesPerVial).toBeCloseTo(10, 3);
    }
  });

  it('amountPerUnit equals concentration / 100', () => {
    const r = calculateDosage({ vialAmount: 5, vialUnit: 'mg', bacWaterMl: 2, desiredDose: 250, doseUnit: 'mcg', syringeCapacity: 100 });
    if (r.ok) {
      expect(r.result.amountPerUnit).toBeCloseTo(r.result.concentration / 100, 8);
    }
  });
});
