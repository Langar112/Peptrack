import { toMcg } from "@workspace/dosage-calc";

type CycleVialInput = {
  vialAmount: string | number | null;
  vialUnit: string | null;
  desiredDose: string | number | null;
  doseUnit: string | null;
};

type CompletedInjectionInput = {
  actualDose: string | number | null;
  actualDoseUnit: string | null;
  plannedDose: string | number;
  plannedDoseUnit: string;
};

export type VialTracking = {
  totalDoses: number;
  usedDoses: number;
  remainingDoses: number;
  remainingAmount: number;
  remainingAmountUnit: string;
};

function comparableAmount(amount: number, unit: string): number | null {
  if (unit === "IU") return amount;
  if (unit === "mg" || unit === "mcg") return toMcg(amount, unit);
  return null;
}

function amountFromComparable(amount: number, unit: string): number {
  return unit === "mg" ? amount / 1000 : amount;
}

export function calculateVialTracking(
  cycle: CycleVialInput,
  completedInjections: CompletedInjectionInput[],
): VialTracking | null {
  const vialAmount = Number(cycle.vialAmount);
  const desiredDose = Number(cycle.desiredDose);
  const vialUnit = cycle.vialUnit ?? "";
  const doseUnit = cycle.doseUnit ?? "";

  if (!Number.isFinite(vialAmount) || vialAmount <= 0 || !Number.isFinite(desiredDose) || desiredDose <= 0) {
    return null;
  }
  if ((vialUnit === "IU") !== (doseUnit === "IU")) return null;

  const totalAmount = comparableAmount(vialAmount, vialUnit);
  const doseAmount = comparableAmount(desiredDose, doseUnit);
  if (totalAmount === null || doseAmount === null) return null;

  const usedAmount = completedInjections.reduce((sum, injection) => {
    const amount = Number(injection.actualDose ?? injection.plannedDose);
    const unit = injection.actualDoseUnit ?? injection.plannedDoseUnit;
    if (!Number.isFinite(amount) || amount <= 0) return sum;

    const comparable = comparableAmount(amount, unit);
    return comparable === null ? sum : sum + comparable;
  }, 0);

  const remainingAmount = Math.max(0, totalAmount - usedAmount);
  const totalDoses = totalAmount / doseAmount;
  const usedDoses = usedAmount / doseAmount;
  const remainingDoses = Math.max(0, Math.floor(remainingAmount / doseAmount + 1e-9));

  return {
    totalDoses,
    usedDoses,
    remainingDoses,
    remainingAmount: amountFromComparable(remainingAmount, vialUnit),
    remainingAmountUnit: vialUnit,
  };
}