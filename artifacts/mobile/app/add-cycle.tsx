import React, { useState } from 'react';
import {
  Alert,
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
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useJournal } from '@/contexts/JournalContext';

const FREQUENCIES = [
  'Daily',
  '2x / day',
  '3x / day',
  'Every other day',
  '3x / week',
  '2x / week',
  'Weekly',
];

function parseDate(input: string): Date | null {
  // Accept YYYY-MM-DD or MM/DD/YYYY
  const isoMatch = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const slashMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`);
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function AddCycleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addCycle } = useJournal();

  const [peptideName, setPeptideName] = useState('');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [notes, setNotes] = useState('');

  const topPad = Platform.OS === 'web' ? 20 : insets.top;

  const handleSave = () => {
    if (!peptideName.trim()) {
      Alert.alert('Missing Field', 'Please enter a peptide name.');
      return;
    }

    const start = parseDate(startDateStr);
    if (!start) {
      Alert.alert('Invalid Date', 'Enter start date as YYYY-MM-DD or MM/DD/YYYY.');
      return;
    }

    const end = parseDate(endDateStr);
    if (!end) {
      Alert.alert('Invalid Date', 'Enter end date as YYYY-MM-DD or MM/DD/YYYY.');
      return;
    }

    if (end <= start) {
      Alert.alert('Invalid Date Range', 'End date must be after start date.');
      return;
    }

    if (!dosage.trim()) {
      Alert.alert('Missing Field', 'Please enter a dosage (e.g. "250 mcg").');
      return;
    }

    addCycle({
      peptideName: peptideName.trim(),
      startDate: toISODate(start),
      endDate: toISODate(end),
      dosage: dosage.trim(),
      frequency,
      notes: notes.trim(),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.cancelBtn, { color: colors.mutedForeground }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Cycle</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveBtn, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Peptide Name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Peptide Name</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={peptideName}
            onChangeText={setPeptideName}
            placeholder="e.g. BPC-157"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Dates */}
        <View style={styles.rowGroup}>
          <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Start Date</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={startDateStr}
              onChangeText={setStartDateStr}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>End Date</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={endDateStr}
              onChangeText={setEndDateStr}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={[styles.hintBox, { backgroundColor: colors.muted }]}>
          <Feather name="info" size={13} color={colors.mutedForeground} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            Format: 2025-06-01 or 06/01/2025
          </Text>
        </View>

        {/* Dosage */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Dosage</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={dosage}
            onChangeText={setDosage}
            placeholder="e.g. 250 mcg"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
          />
        </View>

        {/* Frequency */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Frequency</Text>
          <View style={styles.frequencyGrid}>
            {FREQUENCIES.map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[
                  styles.freqChip,
                  {
                    backgroundColor: frequency === freq ? colors.primary : colors.card,
                    borderColor: frequency === freq ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setFrequency(freq);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.freqChipText,
                    { color: frequency === freq ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {freq}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes (optional)</Text>
          <TextInput
            style={[
              styles.textInput,
              styles.textArea,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes about this cycle..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSave} activeOpacity={0.8}>
          <Feather name="check" size={18} color={colors.primaryForeground} />
          <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>Save Cycle</Text>
        </TouchableOpacity>

        <View style={{ height: Platform.OS === 'web' ? 80 : 40 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    cancelBtn: { fontSize: 16, fontFamily: 'Inter_400Regular' },
    headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
    saveBtn: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 24 },
    fieldGroup: { marginBottom: 20 },
    fieldLabel: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    textInput: {
      borderRadius: colors.radius,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
    },
    textArea: {
      height: 100,
      paddingTop: 13,
    },
    rowGroup: { flexDirection: 'row', marginBottom: 0 },
    hintBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: colors.radius - 4,
      marginBottom: 20,
      marginTop: -4,
    },
    hintText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
    frequencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    freqChip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1,
    },
    freqChipText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: colors.radius,
      paddingVertical: 16,
      gap: 8,
      marginTop: 8,
    },
    saveButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  });
}
