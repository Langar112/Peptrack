import { describe, it, expect } from 'vitest';
import { generateInjectionEvents } from './schedule';
import type { Cycle, ScheduleRule } from '@workspace/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeCycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    id: 'cycle-1',
    userId: 'user-1',
    cycleName: 'Test Cycle',
    customCompoundName: null,
    catalogPeptideId: null,
    vialAmount: '5',
    vialUnit: 'mg',
    bacWaterMl: '2',
    desiredDose: '250',
    doseUnit: 'mcg',
    calculatedVolumeMl: '0.1',
    calculatedSyringeUnits: '10',
    syringeCapacityMl: '1.0',
    startDate: '2026-01-01',
    endDate: null,
    durationWeeks: 4,
    ongoing: false,
    status: 'active',
    notes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    archivedAt: null,
    ...overrides,
  } as unknown as Cycle;
}

function makeRule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'rule-1',
    cycleId: 'cycle-1',
    frequencyType: 'daily',
    daysOfWeek: null,
    intervalDays: null,
    injectionsPerWeek: null,
    injectionTimes: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as unknown as ScheduleRule;
}

// ─── Daily frequency ──────────────────────────────────────────────────────────
describe('generateInjectionEvents — daily frequency', () => {
  it('generates one event per day for a 1-week cycle', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', durationWeeks: 1, endDate: null });
    const rule = makeRule({ frequencyType: 'daily' });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    // durationWeeks=1 → endDate = Jan 1 + 7 = Jan 8 (inclusive) → 8 events
    expect(events).toHaveLength(8); // Jan 1–8
    events.forEach((e) => expect(e.status).toBe('scheduled'));
  });

  it('generates events up to endDate (inclusive)', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', endDate: '2026-01-03', durationWeeks: null });
    const rule = makeRule({ frequencyType: 'daily' });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    expect(events).toHaveLength(3); // Jan 1, 2, 3
  });

  it('creates events with correct userId and cycleId', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', durationWeeks: 1 });
    const rule = makeRule({ frequencyType: 'daily' });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-42' });

    events.forEach((e) => {
      expect(e.userId).toBe('user-42');
      expect(e.cycleId).toBe('cycle-1');
    });
  });

  it('copies planned dose and volume from cycle', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', durationWeeks: 1, desiredDose: '300', doseUnit: 'mcg', calculatedVolumeMl: '0.12', calculatedSyringeUnits: '12' });
    const rule = makeRule({ frequencyType: 'daily' });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    expect(events[0]!.plannedDose).toBe('300');
    expect(events[0]!.plannedDoseUnit).toBe('mcg');
    expect(events[0]!.plannedVolumeMl).toBe('0.12');
    expect(events[0]!.plannedSyringeUnits).toBe('12');
  });

  it('respects fromDate — skips events before fromDate', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', durationWeeks: 2 });
    const rule = makeRule({ frequencyType: 'daily' });
    const fromDate = new Date('2026-01-08T00:00:00');
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1', fromDate });

    // durationWeeks=2 → endDate = Jan 15; daily from Jan 8 → Jan 15 = 8 events
    expect(events).toHaveLength(8);
    expect(events[0]!.scheduledAt.toISOString().startsWith('2026-01-08')).toBe(true);
  });
});

// ─── Specific days frequency ───────────────────────────────────────────────────
describe('generateInjectionEvents — specific_days frequency', () => {
  it('generates only on specified days of week (Mon/Wed/Fri)', () => {
    // Jan 2026: 1=Thu, 2=Fri, 3=Sat, 4=Sun, 5=Mon, 6=Tue, 7=Wed ...
    const cycle = makeCycle({ startDate: '2026-01-01', durationWeeks: 1 });
    const rule = makeRule({ frequencyType: 'specific_days', daysOfWeek: ['monday', 'wednesday', 'friday'] });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    // Jan 1–7: Mon=5, Wed=7, Fri=2 → 3 events
    expect(events).toHaveLength(3);
    const days = events.map((e) => e.scheduledAt.toISOString().substring(0, 10));
    expect(days).toContain('2026-01-02'); // Friday
    expect(days).toContain('2026-01-05'); // Monday
    expect(days).toContain('2026-01-07'); // Wednesday
  });

  it('generates 0 events when no matching days in range', () => {
    // One-day range (Thursday Jan 1), asking for Saturday only
    const cycle = makeCycle({ startDate: '2026-01-01', endDate: '2026-01-01' });
    const rule = makeRule({ frequencyType: 'specific_days', daysOfWeek: ['saturday'] });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    expect(events).toHaveLength(0);
  });

  it('generates one event per matching day across a 2-week cycle', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', durationWeeks: 2 });
    const rule = makeRule({ frequencyType: 'specific_days', daysOfWeek: ['tuesday', 'thursday'] });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    // durationWeeks=2 → endDate = Jan 15 (Jan 1 + 14 days, inclusive)
    // Thu: Jan 1, 8, 15 = 3; Tue: Jan 6, 13 = 2 → 5 events
    expect(events).toHaveLength(5);
  });
});

// ─── Every X days frequency ────────────────────────────────────────────────────
describe('generateInjectionEvents — every_x_days frequency', () => {
  it('generates every 2 days for a 2-week cycle', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', durationWeeks: 2 });
    const rule = makeRule({ frequencyType: 'every_x_days', intervalDays: 2 });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    // durationWeeks=2 → endDate = Jan 15; step 2: Jan 1,3,5,7,9,11,13,15 → 8 events
    expect(events).toHaveLength(8);
  });

  it('generates every 3 days correctly', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', endDate: '2026-01-10' });
    const rule = makeRule({ frequencyType: 'every_x_days', intervalDays: 3 });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    // Jan 1, 4, 7, 10 → 4 events
    expect(events).toHaveLength(4);
  });

  it('defaults to interval 1 if intervalDays is null (same as daily)', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', durationWeeks: 1 });
    const rule = makeRule({ frequencyType: 'every_x_days', intervalDays: null });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    // durationWeeks=1 → endDate = Jan 8; daily (interval 1): Jan 1–8 = 8 events
    expect(events).toHaveLength(8);
  });
});

// ─── Multiple injection times ─────────────────────────────────────────────────
describe('generateInjectionEvents — multiple injection times', () => {
  it('creates one event per injection time per day', () => {
    // 2 times/day × 3 days = 6 events
    const cycle = makeCycle({ startDate: '2026-01-01', endDate: '2026-01-03' });
    const rule = makeRule({ frequencyType: 'daily', injectionTimes: ['08:00', '20:00'] });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    expect(events).toHaveLength(6);
  });

  it('sets correct hours for scheduled times', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', endDate: '2026-01-01' });
    const rule = makeRule({ frequencyType: 'daily', injectionTimes: ['08:30', '21:00'] });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    expect(events).toHaveLength(2);
    const hours = events.map((e) => e.scheduledAt.getHours());
    expect(hours).toContain(8);
    expect(hours).toContain(21);
  });

  it('single "any" time produces one event per day at midnight', () => {
    const cycle = makeCycle({ startDate: '2026-01-01', endDate: '2026-01-03' });
    const rule = makeRule({ frequencyType: 'daily', injectionTimes: ['any'] });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    expect(events).toHaveLength(3);
    events.forEach((e) => expect(e.scheduledAt.getHours()).toBe(0));
  });
});

// ─── Ongoing cycles ────────────────────────────────────────────────────────────
describe('generateInjectionEvents — ongoing cycles', () => {
  it('generates events for ~90 days when cycle is ongoing', () => {
    const cycle = makeCycle({ startDate: new Date().toISOString().substring(0, 10), durationWeeks: null, endDate: null, ongoing: true });
    const rule = makeRule({ frequencyType: 'daily' });
    const events = generateInjectionEvents({ cycle, scheduleRule: rule, userId: 'user-1' });

    // Should be roughly 90 days (allow ±1 for today/tomorrow boundary)
    expect(events.length).toBeGreaterThanOrEqual(89);
    expect(events.length).toBeLessThanOrEqual(91);
  });
});
