/**
 * dosage-calc — Pure dosage calculation logic for peptide reconstitution.
 * No React or platform dependencies; safe to import in tests and server code.
 */

export type VialUnit = 'mg' | 'mcg' | 'IU';
export type DoseUnit = 'mcg' | 'mg' | 'IU';

export interface DosageInput {
  vialAmount: number;    // numeric amount on the vial
  vialUnit: VialUnit;
  bacWaterMl: number;    // mL of BAC water added
  desiredDose: number;   // desired dose per injection
  doseUnit: DoseUnit;
  syringeCapacity: 50 | 100; // total syringe units (50u = 0.5 mL, 100u = 1.0 mL)
}

export interface DosageResult {
  syringeUnits: number;       // units to draw on the selected syringe
  volumeMl: number;           // mL to draw
  concentration: number;      // peptide per mL (mcg/mL or IU/mL)
  concentrationUnit: string;  // 'mcg/mL' or 'IU/mL'
  amountPerUnit: number;      // peptide per 1 syringe unit
  dosesPerVial: number;       // how many injections the vial provides
  warnings: string[];
}

export type DosageError =
  | 'INVALID_VIAL_AMOUNT'
  | 'INVALID_BAC_WATER'
  | 'INVALID_DOSE'
  | 'UNIT_MISMATCH'
  | 'DOSE_EXCEEDS_VIAL'
  | 'CALCULATION_ERROR';

export interface DosageCalcResult {
  ok: true;
  result: DosageResult;
}
export interface DosageCalcError {
  ok: false;
  error: DosageError;
  message: string;
}

/** Convert amount in mg or mcg to mcg. Returns null for IU (no conversion). */
export function toMcg(amount: number, unit: VialUnit | DoseUnit): number | null {
  if (unit === 'mcg') return amount;
  if (unit === 'mg') return amount * 1000;
  return null; // IU — cannot convert to mcg
}

/**
 * Calculate reconstituted peptide dosage from inputs.
 * Returns either a result object or a typed error.
 */
export function calculateDosage(
  input: DosageInput
): DosageCalcResult | DosageCalcError {
  const { vialAmount, vialUnit, bacWaterMl, desiredDose, doseUnit, syringeCapacity } = input;

  if (!isFinite(vialAmount) || vialAmount <= 0) {
    return { ok: false, error: 'INVALID_VIAL_AMOUNT', message: 'Enter a valid vial amount.' };
  }
  if (!isFinite(bacWaterMl) || bacWaterMl <= 0) {
    return { ok: false, error: 'INVALID_BAC_WATER', message: 'Enter a valid BAC water amount.' };
  }
  if (!isFinite(desiredDose) || desiredDose <= 0) {
    return { ok: false, error: 'INVALID_DOSE', message: 'Enter a valid desired dose.' };
  }

  const vialIsIU = vialUnit === 'IU';
  const doseIsIU = doseUnit === 'IU';

  if (vialIsIU !== doseIsIU) {
    return {
      ok: false, error: 'UNIT_MISMATCH',
      message: 'Vial and dose units are incompatible. Both must use IU, or both must use mg/mcg.',
    };
  }

  let concentration: number;
  let volumeMl: number;
  let concUnit: string;
  let amountPerUnit: number;
  let effectiveVialAmount: number;
  let effectiveDose: number;

  if (vialIsIU) {
    // IU path: straight IU/mL
    concentration = vialAmount / bacWaterMl;
    volumeMl = desiredDose / concentration;
    concUnit = 'IU/mL';
    amountPerUnit = concentration / 100;
    effectiveVialAmount = vialAmount;
    effectiveDose = desiredDose;
  } else {
    // mg / mcg path — normalize both to mcg
    const vialMcg = toMcg(vialAmount, vialUnit)!;
    const doseMcg = toMcg(desiredDose, doseUnit)!;
    concentration = vialMcg / bacWaterMl;
    volumeMl = doseMcg / concentration;
    concUnit = 'mcg/mL';
    amountPerUnit = concentration / 100;
    effectiveVialAmount = vialMcg;
    effectiveDose = doseMcg;
  }

  if (!isFinite(volumeMl) || isNaN(volumeMl)) {
    return { ok: false, error: 'CALCULATION_ERROR', message: 'Calculation resulted in an invalid number.' };
  }

  if (effectiveDose > effectiveVialAmount) {
    return { ok: false, error: 'DOSE_EXCEEDS_VIAL', message: 'Desired dose exceeds the total amount in the vial.' };
  }

  const syringeUnits = volumeMl * 100;
  const dosesPerVial = effectiveVialAmount / effectiveDose;

  const warnings: string[] = [];
  if (syringeUnits > syringeCapacity) {
    warnings.push(
      `This volume (${syringeUnits.toFixed(1)} units) exceeds the selected ${syringeCapacity}-unit syringe capacity.`
    );
  }
  if (syringeUnits < 1) {
    warnings.push('This amount is below 1 syringe unit and may be difficult to measure accurately.');
  } else if (syringeUnits < 2) {
    warnings.push('This small amount may be difficult to measure accurately using the selected syringe.');
  }
  if (dosesPerVial < 1) {
    warnings.push('The desired dose exceeds what one vial can provide in a single injection.');
  }

  return {
    ok: true,
    result: { syringeUnits, volumeMl, concentration, concentrationUnit: concUnit, amountPerUnit, dosesPerVial, warnings },
  };
}
