import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleCycleNotifications, cancelCycleNotifications } from '@/services/notifications';
import { DisclaimerModal } from '@/components/DisclaimerModal';

const disclaimerKey = (userId: string) => `@peptidepro:disclaimer_accepted:${userId}`;

const DAY_OPTIONS = [
  { label: 'Mo', value: 'monday' },
  { label: 'Tu', value: 'tuesday' },
  { label: 'We', value: 'wednesday' },
  { label: 'Th', value: 'thursday' },
  { label: 'Fr', value: 'friday' },
  { label: 'Sa', value: 'saturday' },
  { label: 'Su', value: 'sunday' },
];

const EVENLY_SPACED: Record<number, string[]> = {
  1: ['monday'],
  2: ['monday', 'thursday'],
  3: ['monday', 'wednesday', 'friday'],
  4: ['monday', 'tuesday', 'thursday', 'saturday'],
  5: ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  7: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
};

type FrequencyType = 'daily' | 'specific_days' | 'times_per_week' | 'every_x_days';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export default function AddCycleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillPeptide?: string; prefillVialAmount?: string; prefillVialUnit?: string;
    prefillBacWater?: string; prefillDose?: string; prefillDoseUnit?: string;
    prefillVolumeMl?: string; prefillSyringeUnits?: string; prefillSyringeSize?: string;
    editId?: string;
  }>();
  const { user } = useAuth();
  const topPad = Platform.OS === 'web' ? 20 : insets.top;

  // Compound fields
  const [peptideName, setPeptideName] = useState(params.prefillPeptide ?? '');
  const [vialAmount, setVialAmount] = useState(params.prefillVialAmount ?? '');
  const [vialUnit, setVialUnit] = useState(params.prefillVialUnit ?? 'mg');
  const [bacWater, setBacWater] = useState(params.prefillBacWater ?? '');
  const [desiredDose, setDesiredDose] = useState(params.prefillDose ?? '');
  const [doseUnit, setDoseUnit] = useState(params.prefillDoseUnit ?? 'mcg');
  const [calculatedVolumeMl, setCalculatedVolumeMl] = useState(params.prefillVolumeMl ?? '');
  const [calculatedSyringeUnits, setCalculatedSyringeUnits] = useState(params.prefillSyringeUnits ?? '');
  const [syringeSize, setSyringeSize] = useState(params.prefillSyringeSize ?? '1.0');

  // Cycle info
  const [cycleName, setCycleName] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [durationType, setDurationType] = useState<'weeks' | 'date' | 'ongoing'>('weeks');
  const [durationWeeks, setDurationWeeks] = useState('8');
  const [endDate, setEndDate] = useState('');

  // Schedule
  const [freqType, setFreqType] = useState<FrequencyType>('daily');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [timesPerWeek, setTimesPerWeek] = useState('3');
  const [intervalDays, setIntervalDays] = useState('2');
  const [injectionTimes, setInjectionTimes] = useState<string[]>(['any']);

  const [isSaving, setIsSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [unitDropdown, setUnitDropdown] = useState<'vial' | 'dose' | null>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Ref always holds the authoritative current user ID so async callbacks
  // can read it after awaiting — closure-captured values go stale across account switches.
  const currentUserIdRef = useRef<string | undefined>(user?.id ?? undefined);
  useEffect(() => { currentUserIdRef.current = user?.id ?? undefined; }, [user?.id]);

  // Load persisted disclaimer acceptance keyed by user ID.
  // On every user change: reset acceptance AND dismiss any open disclaimer/summary
  // so a different account cannot reuse the previous session's modal state.
  useEffect(() => {
    setDisclaimerAccepted(false);
    setShowDisclaimer(false);
    setShowSummary(false);
    if (!user?.id) return;

    let active = true;
    AsyncStorage.getItem(disclaimerKey(user.id))
      .then((val) => { if (active && val === 'true') setDisclaimerAccepted(true); })
      .catch(() => { /* storage unavailable — disclaimer will show */ });

    return () => { active = false; };
  }, [user?.id]);

  // Compute end date for display
  const computedEndDate =
    durationType === 'weeks' && startDate && durationWeeks
      ? addWeeks(startDate, parseInt(durationWeeks) || 0)
      : durationType === 'date' ? endDate
      : null;

  const computedDurationWeeks = durationType === 'weeks' ? parseInt(durationWeeks) || null : null;

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleEvenlydistribute = () => {
    const n = freqType === 'times_per_week' ? parseInt(timesPerWeek) || 3 : selectedDays.length || 3;
    const clamped = Math.min(Math.max(n, 1), 7);
    setSelectedDays(EVENLY_SPACED[clamped] ?? EVENLY_SPACED[3]);
    Haptics.selectionAsync();
  };

  const validate = (): string | null => {
    if (!peptideName.trim()) return 'Enter the peptide or compound name.';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Missing Information', err); return; }

    setIsSaving(true);
    try {
      const scheduleRule = buildScheduleRule();
      const parseOptional = (v: string) => { const n = parseFloat(v); return isNaN(n) ? undefined : n; };
      const payload = {
        customCompoundName: peptideName.trim(),
        cycleName: cycleName.trim() || undefined,
        vialAmount: parseOptional(vialAmount),
        vialUnit,
        bacWaterMl: parseOptional(bacWater),
        desiredDose: parseOptional(desiredDose),
        doseUnit,
        calculatedVolumeMl: parseOptional(calculatedVolumeMl) ?? 0,
        calculatedSyringeUnits: parseOptional(calculatedSyringeUnits) ?? 0,
        syringeCapacityMl: parseOptional(syringeSize) ?? 1.0,
        startDate: startDate || undefined,
        endDate: computedEndDate || undefined,
        durationWeeks: computedDurationWeeks || undefined,
        ongoing: durationType === 'ongoing',
        scheduleRule,
      };

      let savedCycleId: string;
      let savedCycleName: string;
      if (params.editId) {
        const { cycle } = await api.cycles.update(params.editId, payload);
        savedCycleId = cycle.id;
        savedCycleName = cycle.cycleName || cycle.customCompoundName || peptideName;
        // Cancel old notifications before rescheduling below
        await cancelCycleNotifications(savedCycleId);
      } else {
        const { cycle } = await api.cycles.create(payload);
        savedCycleId = cycle.id;
        savedCycleName = cycle.cycleName || cycle.customCompoundName || peptideName;
      }

      // Schedule local notifications for upcoming injections (native only)
      try {
        const now = new Date();
        const monthOut = new Date(now);
        monthOut.setDate(monthOut.getDate() + 60);
        const { events } = await api.injectionEvents.list({
          cycleId: savedCycleId,
          from: now.toISOString(),
          to: monthOut.toISOString(),
        });
        await scheduleCycleNotifications(savedCycleId, savedCycleName, events);
      } catch {
        // Non-fatal — notifications are best-effort
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save cycle. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const buildScheduleRule = () => {
    const base = {
      timezone: user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      injectionTimes,
    };
    if (freqType === 'daily') return { ...base, frequencyType: 'daily' };
    if (freqType === 'specific_days') return { ...base, frequencyType: 'specific_days', daysOfWeek: selectedDays };
    if (freqType === 'times_per_week') return { ...base, frequencyType: 'times_per_week', injectionsPerWeek: parseInt(timesPerWeek), daysOfWeek: selectedDays };
    if (freqType === 'every_x_days') return { ...base, frequencyType: 'every_x_days', intervalDays: parseInt(intervalDays) };
    return { ...base, frequencyType: 'daily' };
  };

  const totalInjections = (): number | null => {
    if (durationType === 'ongoing' || !computedEndDate) return null;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(computedEndDate + 'T00:00:00');
    const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    if (freqType === 'daily') return days;
    if (freqType === 'specific_days') return Math.ceil(days / 7) * selectedDays.length;
    if (freqType === 'times_per_week') return Math.ceil(days / 7) * parseInt(timesPerWeek || '0');
    if (freqType === 'every_x_days') return Math.floor(days / parseInt(intervalDays || '1')) + 1;
    return null;
  };

  const s = makeStyles(colors);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[s.cancelBtn, { color: colors.mutedForeground }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>
          {params.editId ? 'Edit Cycle' : 'New Cycle'}
        </Text>
        <TouchableOpacity onPress={() => {
          const err = validate();
          if (err) { Alert.alert('Missing Information', err); return; }
          if (!disclaimerAccepted) { setShowDisclaimer(true); } else { setShowSummary(true); }
        }}>
          <Text style={[s.saveBtn, { color: colors.primary }]}>Save Cycle</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Compound Info ── */}
        <Text style={s.sectionHeader}>Compound</Text>

        <View style={s.field}>
          <Text style={s.label}>Peptide / Compound Name *</Text>
          <TextInput style={s.input} value={peptideName} onChangeText={setPeptideName} placeholder="e.g. BPC-157" placeholderTextColor={colors.mutedForeground} autoCapitalize="words" />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Vial Amount</Text>
          <View style={s.inputRow}>
            <TextInput style={[s.input, { flex: 1 }]} value={vialAmount} onChangeText={setVialAmount} placeholder="e.g. 5" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
            <TouchableOpacity style={s.unitPill} onPress={() => setUnitDropdown('vial')}>
              <Text style={s.unitPillText}>{vialUnit}</Text>
              <Feather name="chevron-down" size={12} color={colors.primary} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>BAC Water (mL)</Text>
          <TextInput style={s.input} value={bacWater} onChangeText={setBacWater} placeholder="e.g. 2" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Desired Dose</Text>
          <View style={s.inputRow}>
            <TextInput style={[s.input, { flex: 1 }]} value={desiredDose} onChangeText={setDesiredDose} placeholder="e.g. 250" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
            <TouchableOpacity style={s.unitPill} onPress={() => setUnitDropdown('dose')}>
              <Text style={s.unitPillText}>{doseUnit}</Text>
              <Feather name="chevron-down" size={12} color={colors.primary} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.row}>
          <View style={[s.field, { flex: 1, marginRight: 8 }]}>
            <Text style={s.label}>Volume (mL)</Text>
            <TextInput style={s.input} value={calculatedVolumeMl} onChangeText={setCalculatedVolumeMl} placeholder="Auto" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
          </View>
          <View style={[s.field, { flex: 1 }]}>
            <Text style={s.label}>Syringe Units</Text>
            <TextInput style={s.input} value={calculatedSyringeUnits} onChangeText={setCalculatedSyringeUnits} placeholder="Auto" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
          </View>
        </View>

        {/* ── Cycle Info ── */}
        <Text style={s.sectionHeader}>Cycle</Text>

        <View style={s.field}>
          <Text style={s.label}>Cycle Name (optional)</Text>
          <TextInput style={s.input} value={cycleName} onChangeText={setCycleName} placeholder="e.g. Spring Protocol" placeholderTextColor={colors.mutedForeground} />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Start Date</Text>
          <TextInput style={s.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} keyboardType="numbers-and-punctuation" />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Duration</Text>
          <View style={s.segmented}>
            {(['weeks', 'date', 'ongoing'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.segment, durationType === t && { backgroundColor: colors.primary }]}
                onPress={() => { setDurationType(t); Haptics.selectionAsync(); }}
              >
                <Text style={[s.segmentText, durationType === t && { color: colors.primaryForeground }]}>
                  {t === 'weeks' ? 'Weeks' : t === 'date' ? 'End Date' : 'Ongoing'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {durationType === 'weeks' && (
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              value={durationWeeks}
              onChangeText={setDurationWeeks}
              placeholder="Number of weeks"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
          )}
          {durationType === 'date' && (
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="End date (YYYY-MM-DD)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
            />
          )}
          {computedEndDate && (
            <Text style={s.helper}>Ends: {new Date(computedEndDate + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
          )}
        </View>

        {/* ── Frequency ── */}
        <Text style={s.sectionHeader}>Frequency</Text>

        <View style={s.field}>
          {([
            { value: 'daily', label: 'Every day' },
            { value: 'specific_days', label: 'Specific days of the week' },
            { value: 'times_per_week', label: 'X times per week' },
            { value: 'every_x_days', label: 'Every X days' },
          ] as const).map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[s.freqOption, freqType === opt.value && { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}
              onPress={() => { setFreqType(opt.value); Haptics.selectionAsync(); }}
              activeOpacity={0.7}
            >
              <View style={[s.freqRadio, freqType === opt.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {freqType === opt.value && <View style={s.freqRadioDot} />}
              </View>
              <Text style={[s.freqOptionText, freqType === opt.value && { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Day selectors */}
        {(freqType === 'specific_days' || freqType === 'times_per_week') && (
          <View style={s.field}>
            {freqType === 'times_per_week' && (
              <>
                <Text style={s.label}>Injections per week</Text>
                <TextInput
                  style={[s.input, { marginBottom: 12 }]}
                  value={timesPerWeek}
                  onChangeText={setTimesPerWeek}
                  placeholder="e.g. 3"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </>
            )}
            <Text style={s.label}>Select days</Text>
            <View style={s.dayRow}>
              {DAY_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[s.dayChip, selectedDays.includes(d.value) && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => { toggleDay(d.value); Haptics.selectionAsync(); }}
                >
                  <Text style={[s.dayChipText, selectedDays.includes(d.value) && { color: colors.primaryForeground }]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.distributeBtn} onPress={handleEvenlydistribute}>
              <Feather name="shuffle" size={14} color={colors.primary} />
              <Text style={s.distributeBtnText}>Evenly distribute</Text>
            </TouchableOpacity>
          </View>
        )}

        {freqType === 'every_x_days' && (
          <View style={s.field}>
            <Text style={s.label}>Interval (days)</Text>
            <TextInput
              style={s.input}
              value={intervalDays}
              onChangeText={setIntervalDays}
              placeholder="e.g. 2"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
            <Text style={s.helper}>{intervalDays ? `Every ${intervalDays} days` : 'Every ? days'}</Text>
          </View>
        )}

        {/* Time of day */}
        <Text style={s.sectionHeader}>Time of Day</Text>
        <View style={s.field}>
          <View style={s.timeRow}>
            {injectionTimes.map((t, i) => (
              <View key={i} style={s.timeChip}>
                <TextInput
                  style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground, minWidth: 60, textAlign: 'center' }}
                  value={t}
                  onChangeText={(v) => setInjectionTimes((prev) => prev.map((x, j) => j === i ? v : x))}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.mutedForeground}
                />
                {injectionTimes.length > 1 && (
                  <TouchableOpacity onPress={() => setInjectionTimes((prev) => prev.filter((_, j) => j !== i))}>
                    <Feather name="x" size={13} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={s.addTimeBtn} onPress={() => setInjectionTimes((prev) => [...prev, ''])}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary }}>Add time</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.helper}>Use "any" for no specific time, or enter times like "08:00".</Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[s.saveButton, { backgroundColor: colors.primary }, isSaving && { opacity: 0.7 }]}
          onPress={() => {
            const err = validate();
            if (err) { Alert.alert('Missing Information', err); return; }
            if (!disclaimerAccepted) { setShowDisclaimer(true); } else { setShowSummary(true); }
          }}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="check" size={18} color={colors.primaryForeground} />
              <Text style={s.saveButtonText}>{params.editId ? 'Update Cycle' : 'Save Cycle'}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: Platform.OS === 'web' ? 80 : 60 }} />
      </ScrollView>

      {/* Unit Dropdown Modal */}
      <Modal visible={unitDropdown !== null} transparent animationType="fade" onRequestClose={() => setUnitDropdown(null)}>
        <TouchableOpacity style={s.dropdownBackdrop} activeOpacity={1} onPress={() => setUnitDropdown(null)}>
          <View style={[s.dropdownSheet, { backgroundColor: colors.card }]}>
            <Text style={[s.dropdownTitle, { color: colors.mutedForeground }]}>
              {unitDropdown === 'vial' ? 'Vial Unit' : 'Dose Unit'}
            </Text>
            {(unitDropdown === 'vial' ? ['mg', 'mcg', 'IU'] : ['mcg', 'mg', 'IU']).map((unit) => {
              const selected = unitDropdown === 'vial' ? vialUnit === unit : doseUnit === unit;
              return (
                <TouchableOpacity
                  key={unit}
                  style={[s.dropdownOption, selected && { backgroundColor: colors.primary + '15' }]}
                  onPress={() => {
                    if (unitDropdown === 'vial') setVialUnit(unit);
                    else setDoseUnit(unit);
                    setUnitDropdown(null);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[s.dropdownOptionText, { color: selected ? colors.primary : colors.foreground }]}>{unit}</Text>
                  {selected && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Summary Modal */}
      <Modal visible={showSummary} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSummary(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowSummary(false)}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Back</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Cycle Summary</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            {[
              { label: 'Compound', value: peptideName },
              { label: 'Dose', value: `${desiredDose} ${doseUnit}` },
              { label: 'Syringe Units', value: calculatedSyringeUnits ? `${parseFloat(calculatedSyringeUnits).toFixed(1)} units` : '—' },
              { label: 'Vial', value: `${vialAmount} ${vialUnit} / ${bacWater} mL BAC water` },
              { label: 'Start Date', value: startDate },
              { label: 'End Date', value: durationType === 'ongoing' ? 'Ongoing' : computedEndDate ?? '—' },
              { label: 'Schedule', value: freqType === 'daily' ? 'Every day' : freqType === 'specific_days' ? selectedDays.join(', ') : freqType === 'times_per_week' ? `${timesPerWeek}x/week (${selectedDays.join(', ')})` : `Every ${intervalDays} days` },
              { label: 'Time', value: injectionTimes.join(', ') },
              ...(totalInjections() !== null ? [{ label: 'Total Injections', value: String(totalInjections()) }] : []),
            ].map(({ label, value }) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, flex: 1 }}>{label}</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, flex: 2, textAlign: 'right' }}>{value}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[s.saveButton, { backgroundColor: colors.primary, marginTop: 24 }, isSaving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <ActivityIndicator color={colors.primaryForeground} /> : (
                <>
                  <Feather name="calendar" size={18} color={colors.primaryForeground} />
                  <Text style={s.saveButtonText}>{params.editId ? 'Update Cycle' : 'Save Cycle'}</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Safety Disclaimer Modal — shown once per user on first save */}
      <DisclaimerModal
        visible={showDisclaimer}
        onAccept={async () => {
          // Capture the user ID at the moment the button is pressed
          const acceptingUserId = user?.id;
          if (acceptingUserId) {
            try {
              await AsyncStorage.setItem(disclaimerKey(acceptingUserId), 'true');
            } catch {
              Alert.alert(
                'Could Not Save Acceptance',
                'Your acceptance could not be stored. Please try again.',
              );
              return; // keep user at the disclaimer until persistence succeeds
            }
          }
          // After the async write, read the ref (not the stale closure) to check
          // whether the active account changed while we were awaiting the write.
          if (currentUserIdRef.current !== acceptingUserId) return;
          setDisclaimerAccepted(true);
          setShowDisclaimer(false);
          setShowSummary(true);
        }}
        onDecline={() => {
          setShowDisclaimer(false);
        }}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
    cancelBtn: { fontSize: 16, fontFamily: 'Inter_400Regular' },
    headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
    saveBtn: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
    sectionHeader: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 14, marginTop: 8, letterSpacing: -0.3 },
    field: { marginBottom: 16 },
    label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    helper: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 6 },
    input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.foreground },
    row: { flexDirection: 'row' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    unitPill: { backgroundColor: colors.primary + '18', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 13, borderWidth: 1, borderColor: colors.primary + '40' },
    unitPillText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.primary },
    segmented: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: colors.radius - 4, padding: 3 },
    segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: colors.radius - 6 },
    segmentText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    freqOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: colors.radius, borderWidth: 1.5, borderColor: colors.border, marginBottom: 8, backgroundColor: colors.card },
    freqRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    freqRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryForeground },
    freqOptionText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.foreground, flex: 1 },
    dayRow: { flexDirection: 'row', gap: 6 },
    dayChip: { width: 38, height: 38, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
    dayChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    distributeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    distributeBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary },
    timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    timeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.muted, borderRadius: colors.radius - 4, paddingHorizontal: 12, paddingVertical: 10 },
    addTimeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary + '18', borderRadius: colors.radius - 4, paddingHorizontal: 12, paddingVertical: 10 },
    saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 16, gap: 8, marginTop: 8, minHeight: 52 },
    saveButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primaryForeground },
    // Unit dropdown
    dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 40 },
    dropdownSheet: { borderRadius: 14, overflow: 'hidden', width: '100%', maxWidth: 280 },
    dropdownTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    dropdownOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    dropdownOptionText: { fontSize: 16, fontFamily: 'Inter_500Medium' },
    // Modal
    modal: { flex: 1, paddingTop: 20 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground },
  });
}
