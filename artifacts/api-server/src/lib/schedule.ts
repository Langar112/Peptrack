import type { Cycle, ScheduleRule } from "@workspace/db";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

interface GenerateOptions {
  cycle: Cycle;
  scheduleRule: ScheduleRule;
  userId: string;
  fromDate?: Date;
}

interface InjectionEventInsert {
  userId: string;
  cycleId: string;
  scheduledAt: Date;
  plannedDose: string;
  plannedDoseUnit: string;
  plannedVolumeMl: string;
  plannedSyringeUnits: string;
  status: string;
}

export function generateInjectionEvents(opts: GenerateOptions): InjectionEventInsert[] {
  const { cycle, scheduleRule, userId, fromDate } = opts;

  const startDate = new Date(cycle.startDate + "T00:00:00");
  const effectiveStart = fromDate && fromDate > startDate ? fromDate : startDate;

  // End date: use explicit end, or start + durationWeeks, or 90 days for ongoing
  let endDate: Date;
  if (cycle.endDate) {
    endDate = new Date(cycle.endDate + "T23:59:59");
  } else if (cycle.durationWeeks) {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + cycle.durationWeeks * 7);
  } else {
    // Ongoing: generate 90 days
    endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);
  }

  const events: InjectionEventInsert[] = [];
  const times = (scheduleRule.injectionTimes as string[] | null) ?? ["any"];
  const { frequencyType, daysOfWeek, intervalDays, injectionsPerWeek } = scheduleRule;

  const scheduledDates: Date[] = [];

  if (frequencyType === "daily") {
    let cur = new Date(effectiveStart);
    cur.setHours(0, 0, 0, 0);
    while (cur <= endDate) {
      scheduledDates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
  } else if (frequencyType === "specific_days" || frequencyType === "times_per_week") {
    const selectedDays = (daysOfWeek as string[] | null) ?? [];
    const dayIndices = new Set(selectedDays.map((d) => DAY_NAMES.indexOf(d.toLowerCase())));
    let cur = new Date(effectiveStart);
    cur.setHours(0, 0, 0, 0);
    while (cur <= endDate) {
      if (dayIndices.has(cur.getDay())) {
        scheduledDates.push(new Date(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (frequencyType === "every_x_days") {
    const interval = intervalDays ?? 1;
    const effectiveDay = new Date(effectiveStart);
    effectiveDay.setHours(0, 0, 0, 0);
    let cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    if (cur < effectiveDay) {
      const daysSinceStart = Math.floor((effectiveDay.getTime() - cur.getTime()) / (24 * 60 * 60 * 1000));
      const intervalsToAdvance = Math.ceil(daysSinceStart / interval);
      cur.setDate(cur.getDate() + intervalsToAdvance * interval);
    }
    while (cur <= endDate) {
      scheduledDates.push(new Date(cur));
      cur.setDate(cur.getDate() + interval);
    }
  }

  // For each scheduled date, create one event per injection time
  for (const date of scheduledDates) {
    for (const time of times) {
      const scheduledAt = new Date(date);
      if (time !== "any") {
        const [h, m] = time.split(":").map(Number);
        scheduledAt.setHours(h ?? 0, m ?? 0, 0, 0);
      } else {
        scheduledAt.setHours(0, 0, 0, 0);
      }

      events.push({
        userId,
        cycleId: cycle.id,
        scheduledAt,
        plannedDose: String(cycle.desiredDose),
        plannedDoseUnit: cycle.doseUnit,
        plannedVolumeMl: String(cycle.calculatedVolumeMl),
        plannedSyringeUnits: String(cycle.calculatedSyringeUnits),
        status: "scheduled",
      });
    }
  }

  return events;
}
