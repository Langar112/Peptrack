import React, { useState, useCallback, useEffect } from 'react';
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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { api, type JournalEntry, type CycleWithRule } from '@/services/api';

const ENTRY_TYPES = [
  { value: 'general_note', label: 'General Note', icon: 'file-text' },
  { value: 'dose_change', label: 'Dose Change', icon: 'trending-up' },
  { value: 'observation', label: 'Observation', icon: 'eye' },
];

const OBSERVATION_TAGS = ['Energy', 'Sleep', 'Appetite', 'Mood', 'Recovery', 'Pain', 'Digestion', 'Skin', 'Other'];

function entryTypeLabel(type: string): string {
  return ENTRY_TYPES.find((t) => t.value === type)?.label ?? type;
}

function entryIcon(type: string): string {
  return ENTRY_TYPES.find((t) => t.value === type)?.icon ?? 'file-text';
}

function entryColor(type: string, colors: any): string {
  if (type === 'dose_change') return colors.warning;
  if (type === 'observation') return colors.primary;
  return colors.success;
}

function formatEntryDate(d: string): string {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function JournalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [cycles, setCycles] = useState<CycleWithRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCycleId, setFilterCycleId] = useState('');
  const [newEntryModal, setNewEntryModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New entry form
  const [entryType, setEntryType] = useState('general_note');
  const [entryBody, setEntryBody] = useState('');
  const [linkedCycleId, setLinkedCycleId] = useState('');
  const [intensityRating, setIntensityRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [cyclePickerModal, setCyclePickerModal] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const params: any = {};
      if (filterType) params.type = filterType;
      if (filterCycleId) params.cycleId = filterCycleId;
      if (search) params.search = search;
      const { entries } = await api.journal.list(params);
      setEntries(entries);
    } catch { } finally { setIsLoading(false); }
  }, [isAuthenticated, filterType, filterCycleId, search]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEntries();
      api.cycles.list().then(({ cycles }) => setCycles(cycles)).catch(() => {});
    }
  }, [isAuthenticated, fetchEntries]);

  const resetForm = () => {
    setEntryType('general_note');
    setEntryBody('');
    setLinkedCycleId('');
    setIntensityRating(0);
    setSelectedTags([]);
  };

  const handleSaveEntry = async () => {
    if (!entryBody.trim() && entryType !== 'dose_change') {
      Alert.alert('Empty Entry', 'Please write something before saving.');
      return;
    }
    setIsSaving(true);
    try {
      await api.journal.create({
        entryType,
        entryDate: new Date().toISOString(),
        body: entryBody || undefined,
        cycleId: linkedCycleId || undefined,
        intensityRating: entryType === 'observation' && intensityRating > 0 ? intensityRating : undefined,
        tags: entryType === 'observation' && selectedTags.length > 0 ? selectedTags.map(t => t.toLowerCase()) : undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewEntryModal(false);
      resetForm();
      fetchEntries();
    } catch {
      Alert.alert('Error', 'Failed to save journal entry.');
    } finally { setIsSaving(false); }
  };

  const handleDeleteEntry = (entry: JournalEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Entry', 'Remove this journal entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.journal.delete(entry.id);
            fetchEntries();
          } catch {
            Alert.alert('Error', 'Failed to delete entry.');
          }
        }
      }
    ]);
  };

  const s = makeStyles(colors);

  if (!isAuthenticated) {
    return (
      <View style={[s.container, { paddingTop: topPad, alignItems: 'center', justifyContent: 'center' }]}>
        <Feather name="book-open" size={48} color={colors.border} />
        <Text style={[s.headerTitle, { marginTop: 16, marginBottom: 8, textAlign: 'center' }]}>Journal</Text>
        <Text style={[s.subtitle, { textAlign: 'center', paddingHorizontal: 40, marginBottom: 24 }]}>
          Create an account to record observations, dose changes, and notes.
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/auth/register')} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const linkedCycle = cycles.find((c) => c.id === linkedCycleId);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Journal</Text>
          <Text style={s.subtitle}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => { resetForm(); setNewEntryModal(true); }} activeOpacity={0.8}>
          <Feather name="plus" size={22} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {/* Search + Filters */}
      <View style={s.searchBar}>
        <View style={[s.searchBox, { flex: 1 }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground }]}
            value={search}
            onChangeText={(t) => { setSearch(t); }}
            onEndEditing={fetchEntries}
            placeholder="Search..."
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            onSubmitEditing={fetchEntries}
          />
          {search ? (
            <TouchableOpacity onPress={() => { setSearch(''); fetchEntries(); }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Type filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        <TouchableOpacity
          style={[s.filterChip, !filterType && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => { setFilterType(''); fetchEntries(); }}
        >
          <Text style={[s.filterChipText, !filterType && { color: colors.primaryForeground }]}>All</Text>
        </TouchableOpacity>
        {ENTRY_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[s.filterChip, filterType === t.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => { setFilterType(filterType === t.value ? '' : t.value); }}
          >
            <Text style={[s.filterChipText, filterType === t.value && { color: colors.primaryForeground }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.list, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const cycleLabel = item.cycleName || item.customCompoundName;
            const color = entryColor(item.entryType, colors);
            return (
              <View style={[s.entryCard, { borderLeftColor: color }]}>
                <View style={s.entryTop}>
                  <View style={s.entryMeta}>
                    <View style={[s.typeBadge, { backgroundColor: color + '20' }]}>
                      <Feather name={entryIcon(item.entryType) as any} size={12} color={color} />
                      <Text style={[s.typeBadgeText, { color }]}>{entryTypeLabel(item.entryType)}</Text>
                    </View>
                    {cycleLabel && (
                      <Text style={s.cycleLabel} numberOfLines={1}>{cycleLabel}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteEntry(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <Text style={s.entryDate}>{formatEntryDate(item.entryDate)}</Text>

                {item.body ? <Text style={s.entryBody} numberOfLines={3}>{item.body}</Text> : null}

                {item.entryType === 'dose_change' && item.previousDose && (
                  <View style={s.doseChangeRow}>
                    <Text style={s.doseChangeText}>{item.previousDose} {item.doseUnit}</Text>
                    <Feather name="arrow-right" size={13} color={colors.mutedForeground} />
                    <Text style={[s.doseChangeText, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>{item.newDose} {item.doseUnit}</Text>
                  </View>
                )}

                {item.entryType === 'observation' && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {item.intensityRating != null && (
                      <View style={[s.tag, { backgroundColor: colors.primary + '18' }]}>
                        <Text style={[s.tagText, { color: colors.primary }]}>Intensity: {item.intensityRating}/10</Text>
                      </View>
                    )}
                    {(item.tags ?? []).map((t) => (
                      <View key={t} style={s.tag}>
                        <Text style={s.tagText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="book-open" size={48} color={colors.border} />
              <Text style={s.emptyTitle}>No entries yet</Text>
              <Text style={s.emptyText}>Tap + to add a note, observation, or dose change</Text>
            </View>
          }
        />
      )}

      {/* New Entry Modal */}
      <Modal visible={newEntryModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setNewEntryModal(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setNewEntryModal(false)}>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>New Entry</Text>
            <TouchableOpacity onPress={handleSaveEntry} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color={colors.primary} /> : (
                <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
            {/* Entry type */}
            <Text style={s.fieldLabel}>Entry Type</Text>
            <View style={s.typeRow}>
              {ENTRY_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[s.typeChip, entryType === t.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => { setEntryType(t.value); Haptics.selectionAsync(); }}
                >
                  <Feather name={t.icon as any} size={14} color={entryType === t.value ? colors.primaryForeground : colors.foreground} />
                  <Text style={[s.typeChipText, entryType === t.value && { color: colors.primaryForeground }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Linked cycle */}
            <Text style={[s.fieldLabel, { marginTop: 16 }]}>Linked Cycle (optional)</Text>
            <TouchableOpacity style={s.selector} onPress={() => setCyclePickerModal(true)} activeOpacity={0.7}>
              <Text style={[s.selectorText, !linkedCycleId && { color: colors.mutedForeground }]}>
                {linkedCycle ? (linkedCycle.cycleName || linkedCycle.customCompoundName || 'Cycle') : 'Select cycle...'}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Notes / body */}
            <Text style={[s.fieldLabel, { marginTop: 16 }]}>
              {entryType === 'dose_change' ? 'Reason / Note' : 'Note'}
              {entryType !== 'dose_change' && <Text style={{ fontWeight: 'normal', color: colors.mutedForeground }}> *</Text>}
            </Text>
            <TextInput
              style={[s.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={entryBody}
              onChangeText={setEntryBody}
              placeholder={entryType === 'observation' ? 'Describe what you noticed...' : entryType === 'dose_change' ? 'Why was the dose changed?' : 'Write your note...'}
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            {/* Observation-specific fields */}
            {entryType === 'observation' && (
              <>
                <Text style={[s.fieldLabel, { marginTop: 16 }]}>Intensity (optional)</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[s.ratingBtn, intensityRating === n && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => setIntensityRating(intensityRating === n ? 0 : n)}
                    >
                      <Text style={[s.ratingBtnText, intensityRating === n && { color: colors.primaryForeground }]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.fieldLabel, { marginTop: 16 }]}>Tags (optional)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {OBSERVATION_TAGS.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[s.tagChip, selectedTags.includes(tag) && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
                    >
                      <Text style={[s.tagChipText, selectedTags.includes(tag) && { color: colors.primaryForeground }]}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Cycle Picker Modal */}
      <Modal visible={cyclePickerModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCyclePickerModal(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Cycle</Text>
            <TouchableOpacity onPress={() => setCyclePickerModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.listRow, !linkedCycleId && { backgroundColor: colors.primary + '18' }]}
            onPress={() => { setLinkedCycleId(''); setCyclePickerModal(false); }}
          >
            <Text style={[s.listRowText, { color: colors.mutedForeground }]}>None</Text>
          </TouchableOpacity>
          {cycles.map((c) => {
            const name = c.cycleName || c.customCompoundName || 'Cycle';
            return (
              <TouchableOpacity
                key={c.id}
                style={[s.listRow, linkedCycleId === c.id && { backgroundColor: colors.primary + '18' }]}
                onPress={() => { setLinkedCycleId(c.id); setCyclePickerModal(false); }}
              >
                <Text style={[s.listRowText, linkedCycleId === c.id && { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>{name}</Text>
                {linkedCycleId === c.id && <Feather name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
    headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    searchBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 8 },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.muted, borderRadius: colors.radius - 4, paddingHorizontal: 12, paddingVertical: 9 },
    searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
    filterRow: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    filterChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    list: { paddingHorizontal: 20 },
    entryCard: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, padding: 14, marginBottom: 10 },
    entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    typeBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
    cycleLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, flex: 1 },
    entryDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 6 },
    entryBody: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground, lineHeight: 20 },
    doseChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    doseChangeText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.muted },
    tagText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
    emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
    // Modal
    modal: { flex: 1, paddingTop: 20 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground },
    fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
    typeChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14 },
    selectorText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.foreground },
    textArea: { borderWidth: 1, borderRadius: colors.radius, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 15, fontFamily: 'Inter_400Regular', minHeight: 120, textAlignVertical: 'top' },
    ratingBtn: { width: 38, height: 38, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
    ratingBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    tagChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    listRowText: { fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.foreground },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: colors.radius, paddingVertical: 14 },
    primaryBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.primaryForeground },
  });
}
