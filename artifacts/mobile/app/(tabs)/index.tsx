import React, { useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

const PEPTIDES = [
  { name: 'BPC-157', unit: 'mcg', defaultDose: 250, vialSize: 5 },
  { name: 'TB-500', unit: 'mcg', defaultDose: 2000, vialSize: 5 },
  { name: 'CJC-1295', unit: 'mcg', defaultDose: 200, vialSize: 2 },
  { name: 'Ipamorelin', unit: 'mcg', defaultDose: 200, vialSize: 2 },
  { name: 'Sermorelin', unit: 'mcg', defaultDose: 300, vialSize: 3 },
  { name: 'PT-141', unit: 'mcg', defaultDose: 1000, vialSize: 10 },
  { name: 'AOD-9604', unit: 'mcg', defaultDose: 300, vialSize: 5 },
  { name: 'HGH Frag 176-191', unit: 'mcg', defaultDose: 500, vialSize: 5 },
  { name: 'Semaglutide', unit: 'mcg', defaultDose: 250, vialSize: 3 },
  { name: 'Tirzepatide', unit: 'mcg', defaultDose: 2500, vialSize: 15 },
  { name: 'Selank', unit: 'mcg', defaultDose: 250, vialSize: 5 },
  { name: 'Semax', unit: 'mcg', defaultDose: 100, vialSize: 3 },
  { name: 'GHK-Cu', unit: 'mcg', defaultDose: 1000, vialSize: 5 },
  { name: 'Epithalon', unit: 'mcg', defaultDose: 10000, vialSize: 10 },
  { name: 'DSIP', unit: 'mcg', defaultDose: 300, vialSize: 2 },
  { name: 'Thymosin Alpha-1', unit: 'mcg', defaultDose: 1600, vialSize: 5 },
  { name: 'Custom', unit: 'mcg', defaultDose: 0, vialSize: 0 },
];

const DOSE_UNITS = ['mcg', 'mg', 'IU', 'mL'];

// Conversion factor to mcg for the internal calculation
const UNIT_TO_MCG: Record<string, number> = {
  mcg: 1,
  mg: 1000,
  IU: 1,   // IU is substance-specific; passed through as-is
  mL: 1,   // mL dose passed through as-is
};

interface Result {
  concentrationMcgPerMl: number;
  volumeMl: number;
  syringeUnits: number;
  doseUnit: string;
}

function formatNum(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace(/\.?0+$/, '');
}

export default function CalculatorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedPeptide, setSelectedPeptide] = useState<string>('BPC-157');
  const [vialSizeMg, setVialSizeMg] = useState<string>('5');
  const [bacWaterMl, setBacWaterMl] = useState<string>('2');
  const [desiredDoseMcg, setDesiredDoseMcg] = useState<string>('250');
  const [doseUnit, setDoseUnit] = useState<string>('mcg');
  const [syringeSize, setSyringeSize] = useState<100 | 50>(100);
  const [result, setResult] = useState<Result | null>(null);
  const [peptideModalVisible, setPeptideModalVisible] = useState(false);
  const [unitModalVisible, setUnitModalVisible] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const calculate = () => {
    const vial = parseFloat(vialSizeMg);
    const water = parseFloat(bacWaterMl);
    const dose = parseFloat(desiredDoseMcg);

    if (isNaN(vial) || vial <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid vial size.');
      return;
    }
    if (isNaN(water) || water <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid BAC water amount.');
      return;
    }
    if (isNaN(dose) || dose <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid desired dose.');
      return;
    }

    // Convert dose to mcg equivalent for calculation
    const doseMcg = dose * (UNIT_TO_MCG[doseUnit] ?? 1);

    // vialSizeMg is in mg → convert to mcg for concentration
    const concentrationMcgPerMl = (vial * 1000) / water;
    const volumeMl = doseMcg / concentrationMcgPerMl;
    const syringeUnits = volumeMl * 100;

    setResult({ concentrationMcgPerMl, volumeMl, syringeUnits, doseUnit });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const reset = () => {
    setResult(null);
    setVialSizeMg('');
    setBacWaterMl('');
    setDesiredDoseMcg('');
    setSelectedPeptide('BPC-157');
  };

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dosage Calculator</Text>
          <Text style={styles.headerSubtitle}>Peptide reconstitution guide</Text>
        </View>

        {/* Peptide Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Peptide</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setPeptideModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectorText}>{selectedPeptide}</Text>
            <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Inputs */}
        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { marginRight: 8 }]}>
            <Text style={styles.inputLabel}>Vial Size (mg)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={vialSizeMg}
                onChangeText={setVialSizeMg}
                placeholder="e.g. 5"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputUnit}>mg</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>BAC Water (mL)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={bacWaterMl}
                onChangeText={setBacWaterMl}
                placeholder="e.g. 2"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputUnit}>mL</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.inputLabel}>Desired Dose</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={desiredDoseMcg}
              onChangeText={setDesiredDoseMcg}
              placeholder="e.g. 250"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.unitButton}
              onPress={() => {
                setUnitModalVisible(true);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.unitButtonText}>{doseUnit}</Text>
              <Feather name="chevron-down" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* How to use info */}
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.primary} />
          <Text style={styles.infoText}>
            Add BAC water to your vial to reconstitute the peptide. This calculator tells you how many units to draw.
          </Text>
        </View>

        {/* Calculate Button */}
        <TouchableOpacity style={styles.calcButton} onPress={calculate} activeOpacity={0.8}>
          <MaterialCommunityIcons name="calculator-variant" size={20} color={colors.primaryForeground} />
          <Text style={styles.calcButtonText}>Calculate</Text>
        </TouchableOpacity>

        {/* Results */}
        {result && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Results</Text>
              <TouchableOpacity onPress={reset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Syringe size toggle */}
            <View style={[styles.syringeToggle, { backgroundColor: colors.muted }]}>
              <Text style={[styles.syringeToggleLabel, { color: colors.mutedForeground }]}>Syringe:</Text>
              {([100, 50] as const).map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.syringeToggleBtn,
                    syringeSize === size && { backgroundColor: colors.card },
                  ]}
                  onPress={() => {
                    setSyringeSize(size);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.syringeToggleBtnText,
                      { color: syringeSize === size ? colors.foreground : colors.mutedForeground },
                      syringeSize === size && { fontFamily: 'Inter_600SemiBold' },
                    ]}
                  >
                    {size}u
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.metricsGrid}>
              <View style={[styles.metricBox, { backgroundColor: colors.muted }]}>
                <Text style={styles.metricValue}>
                  {formatNum(result.concentrationMcgPerMl)}
                </Text>
                <Text style={styles.metricLabel}>mcg / mL</Text>
                <Text style={styles.metricDesc}>Concentration</Text>
              </View>

              <View style={[styles.metricBox, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.metricValue, { color: colors.primary }]}>
                  {formatNum(result.volumeMl, 3)}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.primary }]}>mL to draw</Text>
                <Text style={styles.metricDesc}>Volume</Text>
              </View>

              <View style={[styles.metricBox, { backgroundColor: colors.success + '18' }]}>
                <Text style={[styles.metricValue, { color: colors.success }]}>
                  {formatNum(result.volumeMl * syringeSize, 1)}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.success }]}>{syringeSize}u syringe</Text>
                <Text style={styles.metricDesc}>Draw to</Text>
              </View>
            </View>

            <View style={styles.resultNote}>
              <MaterialCommunityIcons name="needle" size={14} color={colors.mutedForeground} />
              <Text style={styles.resultNoteText}>
                Draw to <Text style={styles.bold}>{formatNum(result.volumeMl * syringeSize, 1)} units</Text> on a {syringeSize}-unit insulin syringe for your{' '}
                <Text style={styles.bold}>{formatNum(result.volumeMl, 3)} mL</Text> dose.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: Platform.OS === 'web' ? 120 : 100 }} />
      </ScrollView>

      {/* Dose Unit Picker Modal */}
      <Modal
        visible={unitModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUnitModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Dose Unit</Text>
            <TouchableOpacity onPress={() => setUnitModalVisible(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={DOSE_UNITS}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.peptideRow,
                  doseUnit === item && { backgroundColor: colors.primary + '18' },
                ]}
                onPress={() => {
                  setDoseUnit(item);
                  setResult(null);
                  setUnitModalVisible(false);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.peptideName,
                    doseUnit === item && { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
                  ]}
                >
                  {item}
                </Text>
                {doseUnit === item && (
                  <Feather name="check" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </Modal>

      {/* Peptide Picker Modal */}
      <Modal
        visible={peptideModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPeptideModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Peptide</Text>
            <TouchableOpacity onPress={() => setPeptideModalVisible(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={PEPTIDES}
            keyExtractor={(item) => item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.peptideRow,
                  selectedPeptide === item.name && { backgroundColor: colors.primary + '18' },
                ]}
                onPress={() => {
                  setSelectedPeptide(item.name);
                  if (item.vialSize > 0) setVialSizeMg(String(item.vialSize));
                  if (item.defaultDose > 0) setDesiredDoseMcg(String(item.defaultDose));
                  setPeptideModalVisible(false);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.peptideName,
                    selectedPeptide === item.name && { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
                  ]}
                >
                  {item.name}
                </Text>
                {selectedPeptide === item.name && (
                  <Feather name="check" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    header: {
      marginBottom: 24,
      marginTop: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      marginTop: 2,
    },
    section: {
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    selectorText: {
      fontSize: 16,
      fontFamily: 'Inter_500Medium',
      color: colors.foreground,
    },
    inputRow: {
      flexDirection: 'row',
      marginBottom: 16,
    },
    inputGroup: {
      flex: 1,
    },
    inputLabel: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 2,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontFamily: 'Inter_500Medium',
      color: colors.foreground,
      paddingVertical: 12,
    },
    inputUnit: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      marginLeft: 8,
    },
    unitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingLeft: 10,
      paddingRight: 2,
      paddingVertical: 4,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
      marginLeft: 4,
    },
    unitButtonText: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: colors.primary,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.primary + '12',
      borderRadius: colors.radius,
      padding: 12,
      marginBottom: 20,
      gap: 8,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      lineHeight: 19,
    },
    calcButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 16,
      gap: 8,
      marginBottom: 20,
    },
    calcButtonText: {
      fontSize: 16,
      fontFamily: 'Inter_700Bold',
      color: colors.primaryForeground,
    },
    resultCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginBottom: 16,
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    syringeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: colors.radius - 4,
      padding: 4,
      marginBottom: 16,
      gap: 4,
    },
    syringeToggleLabel: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      marginLeft: 4,
      marginRight: 4,
    },
    syringeToggleBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 7,
      borderRadius: colors.radius - 6,
    },
    syringeToggleBtnText: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
    },
    resultTitle: {
      fontSize: 18,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
    },
    metricsGrid: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    metricBox: {
      flex: 1,
      borderRadius: colors.radius - 4,
      padding: 12,
      alignItems: 'center',
    },
    metricValue: {
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    metricLabel: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: colors.mutedForeground,
      marginTop: 2,
    },
    metricDesc: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      marginTop: 4,
    },
    resultNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.muted,
      borderRadius: colors.radius - 4,
      padding: 12,
      gap: 8,
    },
    resultNoteText: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      lineHeight: 19,
    },
    bold: {
      fontFamily: 'Inter_600SemiBold',
      color: colors.foreground,
    },
    // Modal
    modalContainer: {
      flex: 1,
      paddingTop: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
    },
    peptideRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    peptideName: {
      fontSize: 16,
      fontFamily: 'Inter_400Regular',
      color: colors.foreground,
    },
  });
}
