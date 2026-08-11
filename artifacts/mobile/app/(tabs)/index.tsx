import React, { useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';

// ─── Catalog ────────────────────────────────────────────────────────────────
const PEPTIDES = [
  'BPC-157', 'TB-500', 'CJC-1295 without DAC', 'CJC-1295 with DAC',
  'Ipamorelin', 'Sermorelin', 'Tesamorelin', 'GHK-Cu', 'PT-141',
  'Kisspeptin', 'AOD-9604', 'MOTS-c', 'Epitalon', 'Semaglutide',
  'Tirzepatide', 'Retatrutide', 'Custom',
];

const VIAL_UNITS = ['mg', 'mcg', 'IU'];
const DOSE_UNITS = ['mcg', 'mg', 'IU'];

// ─── Types ───────────────────────────────────────────────────────────────────
interface CalcResult {
  syringeUnits: number;   // units on selected syringe
  volumeMl: number;
  concentration: number;
  concentrationUnit: string;
  amountPerUnit: number;
  dosesPerVial: number;
  warnings: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number, dec = 2): string {
  const s = n.toFixed(dec);
  return s.replace(/\.?0+$/, '');
}

function toMcg(amount: number, unit: string): number | null {
  if (unit === 'mcg') return amount;
  if (unit === 'mg') return amount * 1000;
  return null; // IU cannot be converted
}

// ─── Syringe Diagram ─────────────────────────────────────────────────────────
function SyringeDiagram({ units, max, colors }: { units: number; max: 50 | 100; colors: any }) {
  const pct = Math.min(Math.max(units / max, 0), 1);
  const ticks = max === 100 ? [0, 20, 40, 60, 80, 100] : [0, 10, 20, 30, 40, 50];
  return (
    <View style={{ marginTop: 16, marginBottom: 4 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        height: 36, backgroundColor: colors.card,
        borderRadius: 18, borderWidth: 1.5, borderColor: colors.border,
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Fill */}
        <View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct * 100}%`,
          backgroundColor: colors.primary + '30',
          borderRightWidth: 2,
          borderRightColor: colors.primary,
        }} />
        {/* Plunger marker */}
        <View style={{
          position: 'absolute',
          left: `${pct * 100}%` as any,
          top: 4, bottom: 4, width: 3,
          backgroundColor: colors.primary,
          borderRadius: 2,
          marginLeft: -1,
        }} />
        {/* Tick labels */}
        {ticks.map((t) => (
          <View key={t} style={{
            position: 'absolute',
            left: `${(t / max) * 100}%` as any,
            top: 0, bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <View style={{ width: 1, height: 10, backgroundColor: colors.border }} />
          </View>
        ))}
      </View>
      {/* Labels row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {ticks.map((t) => (
          <Text key={t} style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
            {t}
          </Text>
        ))}
      </View>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', marginTop: 2 }}>
        units (0–{max})
      </Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function CalculatorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  // Form state
  const [peptide, setPeptide] = useState('BPC-157');
  const [customName, setCustomName] = useState('');
  const [vialAmount, setVialAmount] = useState('');
  const [vialUnit, setVialUnit] = useState<'mg' | 'mcg' | 'IU'>('mg');
  const [bacWater, setBacWater] = useState('');
  const [desiredDose, setDesiredDose] = useState('');
  const [doseUnit, setDoseUnit] = useState<'mcg' | 'mg' | 'IU'>('mcg');
  const [syringeSize, setSyringeSize] = useState<50 | 100>(100);

  // Modal state
  const [peptideModal, setPeptideModal] = useState(false);
  const [peptideSearch, setPeptideSearch] = useState('');
  const [vialUnitModal, setVialUnitModal] = useState(false);
  const [doseUnitModal, setDoseUnitModal] = useState(false);

  // Result state
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState('');

  const calculate = useCallback(() => {
    setError('');
    setResult(null);

    const vial = parseFloat(vialAmount);
    const water = parseFloat(bacWater);
    const dose = parseFloat(desiredDose);

    if (!vialAmount || isNaN(vial) || vial <= 0) { setError('Enter a valid vial amount.'); return; }
    if (!bacWater || isNaN(water) || water <= 0) { setError('Enter a valid BAC water amount.'); return; }
    if (!desiredDose || isNaN(dose) || dose <= 0) { setError('Enter a valid desired dose.'); return; }
    if (peptide === 'Custom' && !customName.trim()) { setError('Enter the compound name.'); return; }

    // Unit compatibility check
    const vialIsIU = vialUnit === 'IU';
    const doseIsIU = doseUnit === 'IU';
    if (vialIsIU !== doseIsIU) {
      setError('Vial and dose units are incompatible. Both must use IU, or both must use mg/mcg.');
      return;
    }

    let concentration: number;
    let volumeMl: number;
    let concUnit: string;
    let amountPerUnit: number;

    if (vialIsIU && doseIsIU) {
      // IU path
      concentration = vial / water;  // IU/mL
      volumeMl = dose / concentration;
      concUnit = 'IU/mL';
      amountPerUnit = concentration / 100;  // IU per syringe unit
    } else {
      // mg/mcg path — normalize to mcg
      const vialMcg = toMcg(vial, vialUnit)!;
      const doseMcg = toMcg(dose, doseUnit)!;

      concentration = vialMcg / water;      // mcg/mL
      volumeMl = doseMcg / concentration;
      concUnit = 'mcg/mL';
      amountPerUnit = concentration / 100;  // mcg per syringe unit
    }

    if (isNaN(volumeMl) || !isFinite(volumeMl)) {
      setError('Calculation resulted in an invalid number. Check your inputs.');
      return;
    }

    // Check dose doesn't exceed vial
    let exceedsVial = false;
    if (vialIsIU) {
      exceedsVial = parseFloat(desiredDose) > vial;
    } else {
      const doseMcg = toMcg(dose, doseUnit)!;
      const vialMcg = toMcg(vial, vialUnit)!;
      exceedsVial = doseMcg > vialMcg;
    }
    if (exceedsVial) {
      setError('Desired dose exceeds the total amount in the vial.');
      return;
    }

    const syringeUnits = volumeMl * 100;
    const dosesPerVial = vialIsIU
      ? vial / parseFloat(desiredDose)
      : toMcg(vial, vialUnit)! / toMcg(dose, doseUnit)!;

    const warnings: string[] = [];
    if (syringeUnits > syringeSize) {
      warnings.push(`This volume (${fmt(syringeUnits, 1)} units) exceeds the selected ${syringeSize}-unit syringe capacity.`);
    }
    if (syringeUnits < 1) {
      warnings.push('This amount is below 1 syringe unit and may be difficult to measure accurately.');
    } else if (syringeUnits < 2) {
      warnings.push('This small amount may be difficult to measure accurately using the selected syringe.');
    }
    if (dosesPerVial < 1) {
      warnings.push('The desired dose exceeds what one vial can provide in a single injection.');
    }

    setResult({ syringeUnits, volumeMl, concentration, concentrationUnit: concUnit, amountPerUnit, dosesPerVial, warnings });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [vialAmount, vialUnit, bacWater, desiredDose, doseUnit, peptide, customName, syringeSize]);

  const handleStartCycle = () => {
    if (!result) return;
    if (!isAuthenticated) {
      router.push('/auth/register');
      return;
    }
    router.push({
      pathname: '/add-cycle',
      params: {
        prefillPeptide: peptide === 'Custom' ? customName : peptide,
        prefillVialAmount: vialAmount,
        prefillVialUnit: vialUnit,
        prefillBacWater: bacWater,
        prefillDose: desiredDose,
        prefillDoseUnit: doseUnit,
        prefillVolumeMl: String(result.volumeMl),
        prefillSyringeUnits: String(result.syringeUnits),
        prefillSyringeSize: String(syringeSize === 100 ? 1.0 : 0.5),
      },
    });
  };

  const filteredPeptides = peptideSearch
    ? PEPTIDES.filter((p) => p.toLowerCase().includes(peptideSearch.toLowerCase()))
    : PEPTIDES;

  const s = makeStyles(colors);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Dosage Calculator</Text>
          <Text style={s.headerSub}>Reconstitution & volume calculator</Text>
        </View>

        {/* Peptide */}
        <View style={s.field}>
          <Text style={s.label}>Peptide</Text>
          <TouchableOpacity
            style={s.selector}
            onPress={() => { setPeptideModal(true); setPeptideSearch(''); }}
            activeOpacity={0.7}
          >
            <Text style={s.selectorText}>{peptide}</Text>
            <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          {peptide === 'Custom' && (
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Compound name (required)"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
          )}
        </View>

        {/* Vial Strength */}
        <View style={s.field}>
          <Text style={s.label}>Vial Strength</Text>
          <Text style={s.helper}>Enter the total amount listed on the vial.</Text>
          <View style={s.inputRow}>
            <TextInput
              style={[s.input, { flex: 1, marginRight: 8 }]}
              value={vialAmount}
              onChangeText={(t) => { setVialAmount(t); setResult(null); setError(''); }}
              placeholder="e.g. 5"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={s.unitBtn}
              onPress={() => setVialUnitModal(true)}
              activeOpacity={0.7}
            >
              <Text style={s.unitBtnText}>{vialUnit}</Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* BAC Water */}
        <View style={s.field}>
          <Text style={s.label}>BAC Water Added</Text>
          <View style={s.inputWrapper}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={bacWater}
              onChangeText={(t) => { setBacWater(t); setResult(null); setError(''); }}
              placeholder="e.g. 2"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />
            <Text style={s.inlineUnit}>mL</Text>
          </View>
        </View>

        {/* Desired Dose */}
        <View style={s.field}>
          <Text style={s.label}>Desired Dose</Text>
          <View style={s.inputRow}>
            <TextInput
              style={[s.input, { flex: 1, marginRight: 8 }]}
              value={desiredDose}
              onChangeText={(t) => { setDesiredDose(t); setResult(null); setError(''); }}
              placeholder="e.g. 250"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={s.unitBtn}
              onPress={() => setDoseUnitModal(true)}
              activeOpacity={0.7}
            >
              <Text style={s.unitBtnText}>{doseUnit}</Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Syringe Size */}
        <View style={s.field}>
          <Text style={s.label}>Syringe Size</Text>
          <Text style={s.helper}>U-100: 100 units = 1 mL, 1 unit = 0.01 mL</Text>
          <View style={s.syringeRow}>
            {([
              { size: 100, label: '1.0 mL (100u)' },
              { size: 50, label: '0.5 mL (50u)' },
            ] as const).map(({ size, label }) => (
              <TouchableOpacity
                key={size}
                style={[
                  s.syringeChip,
                  syringeSize === size && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => { setSyringeSize(size); setResult(null); Haptics.selectionAsync(); }}
                activeOpacity={0.7}
              >
                <Text style={[s.syringeChipText, syringeSize === size && { color: colors.primaryForeground }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Error */}
        {error ? (
          <View style={s.errorBox}>
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Calculate Button */}
        <TouchableOpacity style={s.calcBtn} onPress={calculate} activeOpacity={0.8}>
          <MaterialCommunityIcons name="calculator-variant" size={20} color={colors.primaryForeground} />
          <Text style={s.calcBtnText}>Calculate</Text>
        </TouchableOpacity>

        {/* Result Card */}
        {result && (
          <View style={s.resultCard}>
            {/* Primary result */}
            <View style={s.primaryResult}>
              <Text style={s.drawLabel}>Draw to</Text>
              <Text style={s.drawValue}>{fmt(result.syringeUnits, 1)} units</Text>
              <Text style={s.drawSub}>on a {syringeSize}-unit U-100 insulin syringe</Text>
            </View>

            {/* Syringe diagram */}
            <SyringeDiagram units={result.syringeUnits} max={syringeSize} colors={colors} />

            <View style={s.divider} />

            {/* Metrics grid */}
            <View style={s.metricsGrid}>
              <View style={[s.metricBox, { backgroundColor: colors.muted }]}>
                <Text style={s.metricVal}>{fmt(result.volumeMl, 3)}</Text>
                <Text style={s.metricUnit}>mL</Text>
                <Text style={s.metricDesc}>Volume</Text>
              </View>
              <View style={[s.metricBox, { backgroundColor: colors.muted }]}>
                <Text style={s.metricVal}>{fmt(result.concentration)}</Text>
                <Text style={s.metricUnit}>{result.concentrationUnit}</Text>
                <Text style={s.metricDesc}>Concentration</Text>
              </View>
              <View style={[s.metricBox, { backgroundColor: colors.muted }]}>
                <Text style={s.metricVal}>{fmt(result.amountPerUnit)}</Text>
                <Text style={s.metricUnit}>{result.concentrationUnit.replace('/mL', '')}/unit</Text>
                <Text style={s.metricDesc}>Per syringe unit</Text>
              </View>
              <View style={[s.metricBox, { backgroundColor: colors.muted }]}>
                <Text style={s.metricVal}>{fmt(result.dosesPerVial, 1)}</Text>
                <Text style={s.metricUnit}>doses</Text>
                <Text style={s.metricDesc}>Per vial</Text>
              </View>
            </View>

            {/* Warnings */}
            {result.warnings.map((w, i) => (
              <View key={i} style={s.warningBox}>
                <Feather name="alert-triangle" size={14} color={colors.warning} />
                <Text style={s.warningText}>{w}</Text>
              </View>
            ))}

            {/* Start Cycle button */}
            <TouchableOpacity style={s.cycleBtnLarge} onPress={handleStartCycle} activeOpacity={0.8}>
              <Feather name="calendar" size={18} color={colors.primaryForeground} />
              <Text style={s.cycleBtnText}>Start Cycle in Calendar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Disclaimer */}
        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerText}>
            For informational tracking and mathematical calculation only. This app does not provide medical advice, recommend dosages, diagnose conditions, or replace a licensed healthcare professional. Always verify calculations, syringe type, concentration, and product labeling before use.
          </Text>
        </View>

        <View style={{ height: Platform.OS === 'web' ? 120 : 100 }} />
      </ScrollView>

      {/* Peptide Picker Modal */}
      <Modal visible={peptideModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPeptideModal(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Peptide</Text>
            <TouchableOpacity onPress={() => setPeptideModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={[s.searchBox, { backgroundColor: colors.muted }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[s.searchInput, { color: colors.foreground }]}
              value={peptideSearch}
              onChangeText={setPeptideSearch}
              placeholder="Search..."
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
            />
          </View>
          <FlatList
            data={filteredPeptides}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.listRow, peptide === item && { backgroundColor: colors.primary + '18' }]}
                onPress={() => { setPeptide(item); setResult(null); setPeptideModal(false); Haptics.selectionAsync(); }}
                activeOpacity={0.7}
              >
                <Text style={[s.listRowText, peptide === item && { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{item}</Text>
                {peptide === item && <Feather name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </Modal>

      {/* Vial Unit Modal */}
      <Modal visible={vialUnitModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVialUnitModal(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Vial Unit</Text>
            <TouchableOpacity onPress={() => setVialUnitModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {VIAL_UNITS.map((u) => (
            <TouchableOpacity
              key={u}
              style={[s.listRow, vialUnit === u && { backgroundColor: colors.primary + '18' }]}
              onPress={() => { setVialUnit(u as any); setResult(null); setVialUnitModal(false); Haptics.selectionAsync(); }}
              activeOpacity={0.7}
            >
              <Text style={[s.listRowText, vialUnit === u && { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{u}</Text>
              {vialUnit === u && <Feather name="check" size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* Dose Unit Modal */}
      <Modal visible={doseUnitModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDoseUnitModal(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Dose Unit</Text>
            <TouchableOpacity onPress={() => setDoseUnitModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {DOSE_UNITS.map((u) => (
            <TouchableOpacity
              key={u}
              style={[s.listRow, doseUnit === u && { backgroundColor: colors.primary + '18' }]}
              onPress={() => { setDoseUnit(u as any); setResult(null); setDoseUnitModal(false); Haptics.selectionAsync(); }}
              activeOpacity={0.7}
            >
              <Text style={[s.listRowText, doseUnit === u && { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{u}</Text>
              {doseUnit === u && <Feather name="check" size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
    header: { marginBottom: 24, marginTop: 8 },
    headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: -0.5 },
    headerSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    field: { marginBottom: 18 },
    label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    helper: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 8 },
    selector: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 14,
    },
    selectorText: { fontSize: 16, fontFamily: 'Inter_500Medium', color: colors.foreground },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, paddingHorizontal: 16, paddingVertical: 13,
      fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.foreground,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center' },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, paddingHorizontal: 16, paddingVertical: 2,
    },
    inlineUnit: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginLeft: 8 },
    unitBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 13, minWidth: 80,
    },
    unitBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.primary },
    syringeRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    syringeChip: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
      borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
    },
    syringeChipText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground },
    errorBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: colors.destructive + '18', borderRadius: colors.radius - 4,
      padding: 12, marginBottom: 12,
    },
    errorText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.destructive },
    calcBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primary, borderRadius: colors.radius,
      paddingVertical: 16, gap: 8, marginBottom: 20,
    },
    calcBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primaryForeground },
    // Result card
    resultCard: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 16,
    },
    primaryResult: { alignItems: 'center', paddingBottom: 4 },
    drawLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    drawValue: { fontSize: 52, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: -2, lineHeight: 60 },
    drawSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    metricBox: { borderRadius: colors.radius - 4, padding: 12, alignItems: 'center', minWidth: '45%', flex: 1 },
    metricVal: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: -0.5 },
    metricUnit: { fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.mutedForeground, marginTop: 2 },
    metricDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 3 },
    warningBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: colors.warning + '18', borderRadius: colors.radius - 4,
      padding: 10, marginBottom: 8,
    },
    warningText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.warning, lineHeight: 18 },
    cycleBtnLarge: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primary, borderRadius: colors.radius,
      paddingVertical: 14, gap: 8, marginTop: 12,
    },
    cycleBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.primaryForeground },
    disclaimerBox: {
      backgroundColor: colors.muted, borderRadius: colors.radius - 4,
      padding: 14, marginBottom: 8,
    },
    disclaimerText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, lineHeight: 16, textAlign: 'center' },
    // Modals
    modal: { flex: 1, paddingTop: 20 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 20, marginVertical: 12,
      borderRadius: colors.radius - 4, paddingHorizontal: 14, paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
    listRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    listRowText: { fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.foreground },
  });
}
