import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { getCycleStatus, getWeeks, useJournal, WeekEntry } from '@/contexts/JournalContext';

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Ongoing';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatWeekRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function calcProgress(startDate: string, endDate?: string): number {
  if (!endDate) return -1; // ongoing
  const now = new Date().getTime();
  const start = new Date(startDate + 'T00:00:00').getTime();
  const end = new Date(endDate + 'T23:59:59').getTime();
  if (now <= start) return 0;
  if (now >= end) return 1;
  return (now - start) / (end - start);
}

function WeekRow({ week, colors }: { week: WeekEntry; colors: ReturnType<typeof useColors> }) {
  const isCurrent = week.status === 'current';
  const isCompleted = week.status === 'completed';

  return (
    <View style={[
      weekRowStyles.row,
      isCurrent && { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' },
      !isCurrent && { borderColor: colors.border },
    ]}>
      {/* Timeline dot + line */}
      <View style={weekRowStyles.timeline}>
        <View style={[
          weekRowStyles.dot,
          isCurrent && { backgroundColor: colors.primary, borderColor: colors.primary },
          isCompleted && { backgroundColor: colors.success, borderColor: colors.success },
          week.status === 'upcoming' && { backgroundColor: colors.card, borderColor: colors.border },
        ]} />
      </View>

      {/* Content */}
      <View style={weekRowStyles.content}>
        <View style={weekRowStyles.topRow}>
          <Text style={[
            weekRowStyles.weekNum,
            { color: isCurrent ? colors.primary : colors.foreground },
          ]}>
            Week {week.weekNumber}
          </Text>
          {isCurrent && (
            <View style={[weekRowStyles.currentBadge, { backgroundColor: colors.primary }]}>
              <Text style={[weekRowStyles.currentBadgeText, { color: colors.primaryForeground }]}>
                Current
              </Text>
            </View>
          )}
          {isCompleted && (
            <Feather name="check-circle" size={16} color={colors.success} />
          )}
        </View>
        <Text style={[weekRowStyles.dateRange, { color: colors.mutedForeground }]}>
          {formatWeekRange(week.startDate, week.endDate)}
        </Text>
      </View>
    </View>
  );
}

const weekRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  timeline: {
    width: 28,
    alignItems: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  content: { flex: 1, marginLeft: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekNum: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  currentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  currentBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  dateRange: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
});

export default function CycleDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCycleById } = useJournal();

  const cycle = getCycleById(id ?? '');

  if (!cycle) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Feather name="alert-circle" size={40} color={colors.border} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Cycle not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const weeks = getWeeks(cycle.startDate, cycle.endDate);
  const status = getCycleStatus(cycle.startDate, cycle.endDate);
  const progress = calcProgress(cycle.startDate, cycle.endDate);
  const completedWeeks = weeks.filter((w) => w.status === 'completed').length;

  const statusConfig = {
    active: { label: 'Active', color: colors.success },
    upcoming: { label: 'Upcoming', color: colors.warning },
    completed: { label: 'Completed', color: colors.mutedForeground },
  }[status];

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom Header */}
      <View style={[styles.navBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]} numberOfLines={1}>
          {cycle.peptideName}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroTop}>
            <Text style={[styles.heroName, { color: colors.foreground }]}>{cycle.peptideName}</Text>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color + '20' }]}>
              <View style={[styles.statusDotInner, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>

          <View style={styles.heroMeta}>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Start</Text>
              <Text style={[styles.metaValue, { color: colors.foreground }]}>{formatDate(cycle.startDate)}</Text>
            </View>
            <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
            <View style={styles.metaItem}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>End</Text>
              <Text style={[styles.metaValue, { color: colors.foreground }]}>{formatDate(cycle.endDate)}</Text>
            </View>
          </View>

          <View style={[styles.pillsRow]}>
            <View style={[styles.pill, { backgroundColor: colors.muted }]}>
              <MaterialCommunityIcons name="needle" size={13} color={colors.mutedForeground} />
              <Text style={[styles.pillText, { color: colors.mutedForeground }]}>{cycle.dosage}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.muted }]}>
              <Feather name="clock" size={13} color={colors.mutedForeground} />
              <Text style={[styles.pillText, { color: colors.mutedForeground }]}>{cycle.frequency}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: colors.muted }]}>
              <Feather name="layers" size={13} color={colors.mutedForeground} />
              <Text style={[styles.pillText, { color: colors.mutedForeground }]}>{weeks.length} weeks</Text>
            </View>
          </View>

          {/* Progress */}
          {progress >= 0 ? (
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
                  Progress — {completedWeeks} of {weeks.length} weeks done
                </Text>
                <Text style={[styles.progressPct, { color: colors.primary }]}>
                  {Math.round(progress * 100)}%
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(progress * 100, 100)}%` as any, backgroundColor: status === 'completed' ? colors.success : colors.primary },
                  ]}
                />
              </View>
            </View>
          ) : (
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
                {completedWeeks} week{completedWeeks !== 1 ? 's' : ''} completed — ongoing
              </Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {cycle.notes ? (
          <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.notesHeader}>
              <Feather name="file-text" size={15} color={colors.mutedForeground} />
              <Text style={[styles.notesTitle, { color: colors.mutedForeground }]}>Notes</Text>
            </View>
            <Text style={[styles.notesText, { color: colors.foreground }]}>{cycle.notes}</Text>
          </View>
        ) : null}

        {/* Week Timeline */}
        <Text style={[styles.timelineTitle, { color: colors.foreground }]}>Week Timeline</Text>
        {weeks.map((week) => (
          <WeekRow key={week.weekNumber} week={week} colors={colors} />
        ))}

        <View style={{ height: Platform.OS === 'web' ? 120 : 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.3,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroName: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
    flex: 1,
    marginRight: 12,
  },
  statusDot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDotInner: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  heroMeta: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  metaItem: { flex: 1, gap: 3 },
  metaDivider: { width: 1, marginHorizontal: 12, height: '100%' },
  metaLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  pillsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  pillText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  progressSection: {},
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  progressPct: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  notesCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  notesTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  notesText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  timelineTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
});
