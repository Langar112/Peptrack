import { describe, expect, it } from 'vitest';
import { calculateDosage, toMcg } from './dosageCalc';

describe('toMcg', () => {
  it('keeps micrograms unchanged', () => {
    expect(toMcg(500, 'mcg')).toBe(500);
  });

  it('converts milligrams to micrograms', () => {
    expect(toMcg(5, 'mg')).toBe(5000);
    expect(toMcg(0.5, 'mg')).toBe(500);
  });

  it('does not convert IU because it is not mass-based', () => {
    expect(toMcg(1000, 'IU')).toBeNull();
  });
});

describe('calculateDosage', () => {
  it('calculates a standard mg vial and mcg dose', () => {
    const result = calculateDosage({
      vialAmount: 5,
      vialUnit: 'mg',
      bacWaterMl: 2,
      desiredDose: 250,
      doseUnit: 'mcg',
      syringeCapacity: 100,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toMatchObject({
        concentration: 2500,
        concentrationUnit: 'mcg/mL',
        volumeMl: 0.1,
        syringeUnits: 10,
        amountPerUnit: 25,
        dosesPerVial: 20,
        warnings: [],
      });
    }
  });

  it('supports a dose entered in mg using the same unit conversion', () => {
    const result = calculateDosage({
      vialAmount: 10,
      vialUnit: 'mg',
      bacWaterMl: 5,
      desiredDose: 1,
      doseUnit: 'mg',
      syringeCapacity: 100,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.concentration).toBe(2000);
      expect(result.result.volumeMl).toBe(0.5);
      expect(result.result.syringeUnits).toBe(50);
      expect(result.result.dosesPerVial).toBe(10);
    }
  });

  it('supports IU vial and dose calculations without mass conversion', () => {
    const result = calculateDosage({
      vialAmount: 10000,
      vialUnit: 'IU',
      bacWaterMl: 2,
      desiredDose: 500,
      doseUnit: 'IU',
      syringeCapacity: 100,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toMatchObject({
        concentration: 5000,
        concentrationUnit: 'IU/mL',
        volumeMl: 0.1,
        syringeUnits: 10,
        amountPerUnit: 50,
        dosesPerVial: 20,
        warnings: [],
      });
    }
  });

  it('rejects zero BAC water instead of allowing a divide-by-zero result', () => {
    const result = calculateDosage({
      vialAmount: 5,
      vialUnit: 'mg',
      bacWaterMl: 0,
      desiredDose: 250,
      doseUnit: 'mcg',
      syringeCapacity: 100,
    });

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_BAC_WATER',
      message: 'Enter a valid BAC water amount.',
    });
  });

  it('rejects negative and non-finite BAC water amounts', () => {
    const base = {
      vialAmount: 5,
      vialUnit: 'mg' as const,
      desiredDose: 250,
      doseUnit: 'mcg' as const,
      syringeCapacity: 100 as const,
    };

    expect(calculateDosage({ ...base, bacWaterMl: -0.1 })).toMatchObject({
      ok: false,
      error: 'INVALID_BAC_WATER',
    });
    expect(calculateDosage({ ...base, bacWaterMl: Number.NaN })).toMatchObject({
      ok: false,
      error: 'INVALID_BAC_WATER',
    });
  });

  it('calculates a maximum-concentration dose with fractional BAC water', () => {
    const result = calculateDosage({
      vialAmount: 2,
      vialUnit: 'mg',
      bacWaterMl: 0.1,
      desiredDose: 1,
      doseUnit: 'mcg',
      syringeCapacity: 100,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.concentration).toBe(20000);
      expect(result.result.volumeMl).toBe(0.00005);
      expect(result.result.syringeUnits).toBe(0.005);
      expect(result.result.dosesPerVial).toBe(2000);
      expect(result.result.warnings).toContain(
        'This amount is below 1 syringe unit and may be difficult to measure accurately.',
      );
    }
  });

  it('warns when the calculated volume exceeds the selected syringe capacity', () => {
    const result = calculateDosage({
      vialAmount: 1000,
      vialUnit: 'mcg',
      bacWaterMl: 1,
      desiredDose: 600,
      doseUnit: 'mcg',
      syringeCapacity: 50,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.syringeUnits).toBe(60);
      expect(result.result.warnings).toEqual([
        'This volume (60.0 units) exceeds the selected 50-unit syringe capacity.',
      ]);
    }
  });

  it('rejects incompatible IU and mass units', () => {
    const result = calculateDosage({
      vialAmount: 10000,
      vialUnit: 'IU',
      bacWaterMl: 2,
      desiredDose: 500,
      doseUnit: 'mcg',
      syringeCapacity: 100,
    });

    expect(result).toMatchObject({
      ok: false,
      error: 'UNIT_MISMATCH',
    });
  });

  it('rejects a dose larger than the total vial amount after conversion', () => {
    const result = calculateDosage({
      vialAmount: 5,
      vialUnit: 'mg',
      bacWaterMl: 2,
      desiredDose: 6000,
      doseUnit: 'mcg',
      syringeCapacity: 100,
    });

    expect(result).toMatchObject({
      ok: false,
      error: 'DOSE_EXCEEDS_VIAL',
    });
  });
});