import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { Cycle, CycleStatus, getCycleStatus, useJournal } from '@/contexts/JournalContext';

function formatDateRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const start = new Date(startDate + 'T00:00:00').toLocaleDateString(undefined, opts);
  const end = new Date(endDate + 'T00:00:00').toLocaleDateString(undefined, { ...opts, year: 'numeric' });
  return `${start} – ${end}`;
}

function calcProgress(startDate: string, endDate: string): number {
  const now = new Date().getTime();
  const start = new Date(startDate + 'T00:00:00').getTime();
  const end = new Date(endDate + 'T23:59:59').getTime();
  if (now <= start) return 0;
  if (now >= end) return 1;
  return (now - start) / (end - start);
}

function calcTotalWeeks(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00').getTime();
  const end = new Date(endDate + 'T23:59:59').getTime();
  return Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000));
}

function StatusBadge({ status }: { status: CycleStatus }) {
  const colors = useColors();
  const config = {
    active: { label: 'Active', bg: colors.success + '20', fg: colors.success },
    upcoming: { label: 'Upcoming', bg: colors.warning + '20', fg: colors.warning },
    completed: { label: 'Completed', bg: colors.muted, fg: colors.mutedForeground },
  }[status];

  return (
    <View style={[badgeStyles.badge, { backgroundColor: config.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: config.fg }]} />
      <Text style={[badgeStyles.label, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});

function CycleCard({
  cycle,
  onPress,
  onDelete,
  colors,
}: {
  cycle: Cycle;
  onPress: () => void;
  onDelete: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const status = getCycleStatus(cycle.startDate, cycle.endDate);
  const progress = calcProgress(cycle.startDate, cycle.endDate);
  const totalWeeks = calcTotalWeeks(cycle.startDate, cycle.endDate);
  const styles = cardStyles(colors);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.peptideName}>{cycle.peptideName}</Text>
          <Text style={styles.dateRange}>{formatDateRange(cycle.startDate, cycle.endDate)}</Text>
        </View>
        <View style={styles.cardRight}>
          <StatusBadge status={status} />
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteBtn}
          >
            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="needle" size={14} color={colors.mutedForeground} />
          <Text style={styles.metaText}>{cycle.dosage}</Text>
        </View>
        <View style={styles.metaDot} />
        <View style={styles.metaItem}>
          <Feather name="clock" size={13} color={colors.mutedForeground} />
          <Text style={styles.metaText}>{cycle.frequency}</Text>
        </View>
        <View style={styles.metaDot} />
        <View style={styles.metaItem}>
          <Feather name="calendar" size={13} color={colors.mutedForeground} />
          <Text style={styles.metaText}>{totalWeeks} weeks</Text>
        </View>
      </View>

      {status === 'active' && (
        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
          </View>
          <Text style={styles.progressLabel}>{Math.round(progress * 100)}% complete</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function cardStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    cardInfo: { flex: 1, marginRight: 12 },
    peptideName: {
      fontSize: 17,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    dateRange: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      marginTop: 2,
    },
    cardRight: { alignItems: 'flex-end', gap: 8 },
    deleteBtn: { padding: 2 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.border },
    progressSection: { marginTop: 12 },
    progressTrack: {
      height: 4,
      backgroundColor: colors.muted,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.success,
      borderRadius: 2,
    },
    progressLabel: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      marginTop: 4,
      textAlign: 'right',
    },
  });
}

export default function JournalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cycles, deleteCycle } = useJournal();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 120 : 100;

  const confirmDelete = (cycle: Cycle) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Cycle',
      `Remove "${cycle.peptideName}" cycle from your journal?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCycle(cycle.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Cycle Journal</Text>
          <Text style={styles.headerSubtitle}>
            {cycles.length === 0 ? 'No cycles logged yet' : `${cycles.length} cycle${cycles.length !== 1 ? 's' : ''} logged`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/add-cycle');
          }}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={22} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={cycles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CycleCard
            cycle={item}
            colors={colors}
            onPress={() => router.push(`/cycle/${item.id}`)}
            onDelete={() => confirmDelete(item)}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={cycles.length > 0}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="book-open" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>No cycles yet</Text>
            <Text style={styles.emptyText}>
              Tap the + button to log your first peptide cycle
            </Text>
          </View>
        }
      />
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
      paddingTop: 8,
      paddingBottom: 16,
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
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: { paddingHorizontal: 20 },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: 'Inter_600SemiBold',
      color: colors.foreground,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 20,
    },
  });
}
