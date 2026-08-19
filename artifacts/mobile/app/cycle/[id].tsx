import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { api, type CycleWithRule } from '@/services/api';
import { cancelCycleNotifications, scheduleCycleNotifications } from '@/services/notifications';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Ongoing';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function weekOfCycle(startDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function statusColor(status: string, colors: any) {
  if (status === 'active') return colors.success;
  if (status === 'paused') return colors.warning;
  if (status === 'archived') return colors.mutedForeground;
  return colors.mutedForeground;
}

function freqLabel(cycle: CycleWithRule): string {
  const rule = cycle.scheduleRule;
  if (!rule) return '—';
  if (rule.frequencyType === 'daily') return 'Every day';
  if (rule.frequencyType === 'specific_days') return (rule.daysOfWeek ?? []).join(', ');
  if (rule.frequencyType === 'times_per_week') return `${rule.injectionsPerWeek}x per week`;
  if (rule.frequencyType === 'every_x_days') return `Every ${rule.intervalDays} days`;
  return rule.frequencyType;
}

export default function CycleDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const topPad = Platform.OS === 'web' ? 20 : insets.top;

  const [cycle, setCycle] = useState<CycleWithRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.cycles.get(id)
      .then(({ cycle }) => setCycle(cycle))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleAction = (action: 'pause' | 'resume' | 'archive' | 'delete') => {
    const labels = {
      pause: { title: 'Pause Cycle', msg: 'Pause this cycle? You can resume it later.', btn: 'Pause', danger: false },
      resume: { title: 'Resume Cycle', msg: 'Resume this cycle?', btn: 'Resume', danger: false },
      archive: { title: 'Archive Cycle', msg: 'Archive this cycle? Historical records will be preserved.', btn: 'Archive', danger: false },
      delete: { title: 'Delete Cycle', msg: 'Permanently delete this cycle and all its injection records? This cannot be undone.', btn: 'Delete', danger: true },
    }[action];

    Alert.alert(labels.title, labels.msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: labels.btn, style: labels.danger ? 'destructive' : 'default',
        onPress: async () => {
          setIsActing(true);
          try {
            if (action === 'pause') {
              await api.cycles.pause(id!);
              await cancelCycleNotifications(id!);
            } else if (action === 'resume') {
              await api.cycles.resume(id!);
              // Reschedule notifications for resumed cycle
              try {
                const now = new Date();
                const monthOut = new Date(now);
                monthOut.setDate(monthOut.getDate() + 60);
                const { events } = await api.injectionEvents.list({
                  cycleId: id!,
                  from: now.toISOString(),
                  to: monthOut.toISOString(),
                });
                const name = cycle?.cycleName || cycle?.customCompoundName || 'Cycle';
                await scheduleCycleNotifications(id!, name, events);
              } catch { /* best-effort */ }
            } else if (action === 'archive') {
              await api.cycles.archive(id!);
              await cancelCycleNotifications(id!);
            } else {
              await api.cycles.delete(id!);
              await cancelCycleNotifications(id!);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (action === 'delete' || action === 'archive') {
              router.back();
            } else {
              const { cycle } = await api.cycles.get(id!);
              setCycle(cycle);
            }
          } catch {
            Alert.alert('Error', `Failed to ${action} cycle.`);
          } finally { setIsActing(false); }
        }
      }
    ]);
  };

  const s = makeStyles(colors);

  if (isLoading) {
    return (
      <View style={[s.container, { paddingTop: topPad, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!cycle) {
    return (
      <View style={[s.container, { paddingTop: topPad, alignItems: 'center', justifyContent: 'center' }]}>
        <Feather name="alert-circle" size={48} color={colors.border} />
        <Text style={[s.name, { marginTop: 16, textAlign: 'center' }]}>Cycle not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name = cycle.cycleName || cycle.customCompoundName || 'Cycle';
  const currentWeek = cycle.status === 'active' ? weekOfCycle(cycle.startDate) : null;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{name}</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/add-cycle', params: { editId: cycle.id } })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="edit-2" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={[s.statusBadge, { backgroundColor: statusColor(cycle.status, colors) + '20' }]}>
              <View style={[s.statusDot, { backgroundColor: statusColor(cycle.status, colors) }]} />
              <Text style={[s.statusText, { color: statusColor(cycle.status, colors) }]}>
                {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
              </Text>
            </View>
            {currentWeek && (
              <View style={[s.statusBadge, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[s.statusText, { color: colors.primary }]}>Week {currentWeek}{cycle.durationWeeks ? ` of ${cycle.durationWeeks}` : ''}</Text>
              </View>
            )}
          </View>
          <Text style={s.dose}>{cycle.desiredDose} {cycle.doseUnit}</Text>
          <Text style={s.doseLabel}>per injection · {parseFloat(cycle.calculatedSyringeUnits).toFixed(1)} units</Text>
        </View>

        {/* Info Grid */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Cycle Details</Text>
          <View style={s.card}>
            <InfoRow label="Start Date" value={formatDate(cycle.startDate)} colors={colors} />
            <InfoRow label="End Date" value={formatDate(cycle.endDate)} colors={colors} />
            <InfoRow label="Duration" value={cycle.ongoing ? 'Ongoing' : cycle.durationWeeks ? `${cycle.durationWeeks} weeks` : '—'} colors={colors} />
            <InfoRow label="Schedule" value={freqLabel(cycle)} colors={colors} last />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Vial Information</Text>
          <View style={s.card}>
            <InfoRow label="Vial Strength" value={`${cycle.vialAmount} ${cycle.vialUnit}`} colors={colors} />
            <InfoRow label="BAC Water" value={`${cycle.bacWaterMl} mL`} colors={colors} />
            <InfoRow label="Volume" value={`${parseFloat(cycle.calculatedVolumeMl).toFixed(3)} mL`} colors={colors} />
            <InfoRow label="Syringe" value={`${parseFloat(cycle.syringeCapacityMl) === 0.5 ? '0.5' : '1.0'} mL U-100`} colors={colors} last />
          </View>
        </View>

        {/* Actions */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Actions</Text>
          <View style={s.card}>
            {cycle.status === 'active' && (
              <ActionRow icon="pause-circle" label="Pause Cycle" onPress={() => handleAction('pause')} colors={colors} />
            )}
            {cycle.status === 'paused' && (
              <ActionRow icon="play-circle" label="Resume Cycle" onPress={() => handleAction('resume')} colors={colors} />
            )}
            {cycle.status !== 'archived' && (
              <ActionRow icon="archive" label="Archive Cycle" onPress={() => handleAction('archive')} colors={colors} />
            )}
            <ActionRow icon="trash-2" label="Delete Cycle" onPress={() => handleAction('delete')} colors={colors} danger last />
          </View>
        </View>

        {isActing && (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, colors, last }: { label: string; value: string; colors: any; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{label}</Text>
      <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, maxWidth: '55%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function ActionRow({ icon, label, onPress, colors, danger = false, last = false }: any) {
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Feather name={icon} size={18} color={danger ? colors.destructive : colors.foreground} />
      <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: danger ? colors.destructive : colors.foreground }}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.foreground, flex: 1, textAlign: 'center', marginHorizontal: 12 },
    hero: { padding: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
    dose: { fontSize: 40, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: -1, marginTop: 8 },
    doseLabel: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 4 },
    section: { paddingHorizontal: 20, marginTop: 24 },
    sectionTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    name: { fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: -0.3 },
  });
}
