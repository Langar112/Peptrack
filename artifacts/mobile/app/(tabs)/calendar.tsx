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
import { api, type InjectionEvent, type CycleWithRule } from '@/services/api';
import { cancelCycleNotifications } from '@/services/notifications';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d: Date, firstDay = 0) {
  const day = d.getDay();
  const diff = (day - firstDay + 7) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diff);
  s.setHours(0, 0, 0, 0);
  return s;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function weekOfCycle(scheduledAt: string, cycleStartDate: string): number {
  const ev = new Date(scheduledAt);
  const cy = new Date(cycleStartDate + 'T00:00:00');
  const diff = ev.getTime() - cy.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function statusColor(status: string, colors: any) {
  switch (status) {
    case 'completed': return colors.success;
    case 'skipped': return colors.mutedForeground;
    case 'missed': return colors.destructive;
    default: return colors.primary;
  }
}

function StatusDot({ status, colors }: { status: string; colors: any }) {
  return (
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor(status, colors), marginRight: 4 }} />
  );
}

function EventLabel({ event, colors }: { event: InjectionEvent; colors: any }) {
  const name = event.cycleName || event.customCompoundName || 'Unknown';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
      <StatusDot status={event.status} colors={colors} />
      <Text numberOfLines={1} style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: colors.foreground, flex: 1 }}>
        {name} {event.plannedDose}{event.plannedDoseUnit}
      </Text>
    </View>
  );
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<InjectionEvent[]>([]);
  const [cycles, setCycles] = useState<CycleWithRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<InjectionEvent | null>(null);
  const [eventModal, setEventModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeNote, setCompleteNote] = useState('');
  const [completeSite, setCompleteSite] = useState('');
  const [cyclesPanel, setCyclesPanel] = useState(false);
  const [deletingCycleId, setDeletingCycleId] = useState<string | null>(null);

  const handleDeleteCycle = (id: string, name: string) => {
    const doDelete = async () => {
      setDeletingCycleId(id);
      try {
        await api.cycles.delete(id);
        await cancelCycleNotifications(id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchData();
      } catch {
        Alert.alert('Error', 'Failed to delete cycle. Please try again.');
      } finally {
        setDeletingCycleId(null);
      }
    };

    if (Platform.OS === 'web') {
      // window.confirm works reliably on web; Alert.alert does not
      if ((globalThis as any).confirm(`Delete "${name}" and all its injection records? This cannot be undone.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Cycle',
        `Permanently delete "${name}" and all its injection records? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      let fromDate: Date, toDate: Date;
      if (viewMode === 'monthly') {
        fromDate = startOfMonth(currentDate);
        toDate = endOfMonth(currentDate);
      } else {
        fromDate = startOfWeek(currentDate);
        toDate = addDays(fromDate, 6);
      }
      // Fetch wider range for context
      const wider = new Date(fromDate);
      wider.setMonth(wider.getMonth() - 1);
      const widerTo = new Date(toDate);
      widerTo.setMonth(widerTo.getMonth() + 2);

      const [evRes, cyRes] = await Promise.all([
        api.injectionEvents.list({ from: fromDate.toISOString(), to: toDate.toISOString() }),
        api.cycles.list(),
      ]);
      setEvents(evRes.events);
      setCycles(cyRes.cycles.filter((c) => c.status === 'active' || c.status === 'paused'));
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentDate, viewMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const eventsOnDay = useCallback((date: Date) => {
    return events.filter((e) => isSameDay(new Date(e.scheduledAt), date));
  }, [events]);

  const handleMarkComplete = async () => {
    if (!selectedEvent) return;
    setCompleting(true);
    try {
      await api.injectionEvents.complete(selectedEvent.id, {
        injectionSite: completeSite || undefined,
        note: completeNote || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEventModal(false);
      setSelectedEvent(null);
      fetchData();
    } catch {
      Alert.alert('Error', 'Failed to mark as completed. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const handleMarkSkipped = async () => {
    if (!selectedEvent) return;
    try {
      await api.injectionEvents.skip(selectedEvent.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setEventModal(false);
      setSelectedEvent(null);
      fetchData();
    } catch {
      Alert.alert('Error', 'Failed to mark as skipped.');
    }
  };

  const s = makeStyles(colors);

  if (!isAuthenticated) {
    return (
      <View style={[s.container, { paddingTop: topPad, alignItems: 'center', justifyContent: 'center' }]}>
        <Feather name="calendar" size={48} color={colors.border} />
        <Text style={[s.headerTitle, { marginTop: 16, marginBottom: 8, textAlign: 'center' }]}>Calendar</Text>
        <Text style={[s.subtitle, { textAlign: 'center', paddingHorizontal: 40, marginBottom: 24 }]}>
          Create an account to schedule injection cycles and view your calendar.
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/auth/register')} activeOpacity={0.8}>
          <Text style={s.primaryBtnText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Monthly View ──────────────────────────────────────────────────────────
  const renderMonthlyView = () => {
    const monthStart = startOfMonth(currentDate);
    const firstDayOfGrid = startOfWeek(monthStart);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(firstDayOfGrid, i));

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Day headers */}
        <View style={{ flexDirection: 'row' }}>
          {DAY_ABBR.map((d) => (
            <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        {Array.from({ length: 6 }, (_, w) => (
          <View key={w} style={{ flexDirection: 'row' }}>
            {days.slice(w * 7, w * 7 + 7).map((d) => {
              const dayEvents = eventsOnDay(d);
              const hasEvents = dayEvents.length > 0;
              const isToday = isSameDay(d, today);
              const isSelected = selectedDate ? isSameDay(d, selectedDate) : false;
              const isCurrentMonth = d.getMonth() === currentDate.getMonth();

              // Determine dominant status colour for the day highlight
              const hasCompleted = dayEvents.some((e) => e.status === 'completed');
              const hasMissed = dayEvents.some((e) => e.status === 'missed');
              const hasScheduled = dayEvents.some((e) => e.status === 'scheduled');
              const dominantColor = hasCompleted
                ? colors.success
                : hasMissed
                ? colors.destructive
                : hasScheduled
                ? colors.primary
                : colors.mutedForeground;

              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  style={[
                    s.dayCell,
                    hasEvents && !isSelected && { backgroundColor: dominantColor + '12' },
                    isSelected && { backgroundColor: colors.primary + '22' },
                    isToday && { borderColor: colors.primary, borderWidth: 1.5 },
                  ]}
                  onPress={() => setSelectedDate(isSelected ? null : d)}
                  activeOpacity={0.7}
                >
                  {/* Day number — circled on injection days */}
                  <View style={[
                    s.dayNumWrap,
                    isToday && { backgroundColor: colors.primary },
                    hasEvents && !isToday && { backgroundColor: dominantColor + '25' },
                  ]}>
                    <Text style={[
                      s.dayNum,
                      !isCurrentMonth && { color: colors.border },
                      hasEvents && !isToday && { color: dominantColor, fontFamily: 'Inter_700Bold' },
                      isToday && { color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
                    ]}>
                      {d.getDate()}
                    </Text>
                  </View>

                  {/* Status dots — one per event (max 4) */}
                  {hasEvents && (
                    <View style={s.dotRow}>
                      {dayEvents.slice(0, 4).map((ev) => (
                        <View
                          key={ev.id}
                          style={[s.eventDot, { backgroundColor: statusColor(ev.status, colors) }]}
                        />
                      ))}
                      {dayEvents.length > 4 && (
                        <Text style={{ fontSize: 8, color: colors.mutedForeground, lineHeight: 8 }}>+{dayEvents.length - 4}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Selected day detail */}
        {selectedDate && (
          <View style={s.dayDetail}>
            <Text style={s.dayDetailTitle}>
              {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            {eventsOnDay(selectedDate).length === 0 ? (
              <Text style={s.emptyDayText}>No injections scheduled</Text>
            ) : (
              eventsOnDay(selectedDate).map((ev) => (
                <TouchableOpacity
                  key={ev.id}
                  style={s.eventCard}
                  onPress={() => { setSelectedEvent(ev); setEventModal(true); }}
                  activeOpacity={0.75}
                >
                  <EventDetailRow event={ev} colors={colors} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  // ── Weekly View ──────────────────────────────────────────────────────────
  const renderWeeklyView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {weekDays.map((d) => {
          const dayEvents = eventsOnDay(d);
          const isToday = isSameDay(d, today);
          return (
            <View key={d.toISOString()} style={[s.weekDayRow, isToday && { backgroundColor: colors.primary + '08' }]}>
              <View style={s.weekDayLabel}>
                <Text style={[s.weekDayAbbr, isToday && { color: colors.primary }]}>
                  {d.toLocaleDateString(undefined, { weekday: 'short' })}
                </Text>
                <View style={[s.weekDayNum, isToday && { backgroundColor: colors.primary }]}>
                  <Text style={[s.weekDayNumText, isToday && { color: colors.primaryForeground }]}>
                    {d.getDate()}
                  </Text>
                </View>
              </View>
              <View style={s.weekDayEvents}>
                {dayEvents.length === 0 ? (
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.border, paddingVertical: 12 }}>—</Text>
                ) : (
                  dayEvents.map((ev) => (
                    <TouchableOpacity
                      key={ev.id}
                      style={s.weekEventCard}
                      onPress={() => { setSelectedEvent(ev); setEventModal(true); }}
                      activeOpacity={0.75}
                    >
                      <EventDetailRow event={ev} colors={colors} compact />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => {
            if (viewMode === 'monthly') {
              const d = new Date(currentDate);
              d.setMonth(d.getMonth() - 1);
              setCurrentDate(d);
            } else {
              setCurrentDate(addDays(currentDate, -7));
            }
          }}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setCurrentDate(new Date())}>
            <Text style={s.headerMonth}>
              {viewMode === 'monthly'
                ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                : (() => {
                    const ws = startOfWeek(currentDate);
                    const we = addDays(ws, 6);
                    return `${ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
                  })()
              }
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => {
            if (viewMode === 'monthly') {
              const d = new Date(currentDate);
              d.setMonth(d.getMonth() + 1);
              setCurrentDate(d);
            } else {
              setCurrentDate(addDays(currentDate, 7));
            }
          }}>
            <Feather name="chevron-right" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={s.headerActions}>
          {/* View toggle */}
          <View style={[s.viewToggle, { backgroundColor: colors.muted }]}>
            {(['monthly', 'weekly'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.viewToggleBtn, viewMode === m && { backgroundColor: colors.card }]}
                onPress={() => { setViewMode(m); Haptics.selectionAsync(); }}
              >
                <Text style={[s.viewToggleTxt, viewMode === m && { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  {m === 'monthly' ? 'Month' : 'Week'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.iconBtn, { marginLeft: 8 }]}
            onPress={() => setCyclesPanel(true)}
          >
            <Feather name="layers" size={18} color={colors.foreground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.addBtn, { marginLeft: 8 }]}
            onPress={() => router.push('/add-cycle')}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text style={s.addBtnText}>Cycle</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : viewMode === 'monthly' ? renderMonthlyView() : renderWeeklyView()}

      {/* Event Detail Modal */}
      <Modal visible={eventModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEventModal(false)}>
        {selectedEvent && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Injection Details</Text>
              <TouchableOpacity onPress={() => { setEventModal(false); setCompleteNote(''); setCompleteSite(''); }}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              {/* Info rows */}
              <View style={s.infoGrid}>
                <InfoRow label="Compound" value={selectedEvent.cycleName || selectedEvent.customCompoundName || 'Unknown'} colors={colors} />
                <InfoRow label="Planned Dose" value={`${selectedEvent.plannedDose} ${selectedEvent.plannedDoseUnit}`} colors={colors} />
                <InfoRow label="Syringe Units" value={`${parseFloat(selectedEvent.plannedSyringeUnits).toFixed(1)} units`} colors={colors} />
                <InfoRow label="Scheduled" value={new Date(selectedEvent.scheduledAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: selectedEvent.scheduledAt.includes('T00:00:00') ? undefined : 'short' })} colors={colors} />
                {selectedEvent.cycleStartDate && (
                  <InfoRow label="Cycle Week" value={`Week ${weekOfCycle(selectedEvent.scheduledAt, selectedEvent.cycleStartDate)}`} colors={colors} />
                )}
                <InfoRow label="Status" value={selectedEvent.status.charAt(0).toUpperCase() + selectedEvent.status.slice(1)} colors={colors} valueColor={statusColor(selectedEvent.status, colors)} />
              </View>

              {selectedEvent.status === 'scheduled' || selectedEvent.status === 'missed' ? (
                <>
                  <View style={s.divider} />
                  <Text style={[s.label, { marginBottom: 12 }]}>Mark Completed</Text>

                  <Text style={[s.label, { marginBottom: 6, fontSize: 11 }]}>Injection Site (optional)</Text>
                  <View style={s.chipRow}>
                    {['Abdomen', 'Thigh', 'Arm', 'Glute', 'Other'].map((site) => (
                      <TouchableOpacity
                        key={site}
                        style={[s.siteChip, completeSite === site && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => setCompleteSite(completeSite === site ? '' : site)}
                      >
                        <Text style={[s.siteChipText, completeSite === site && { color: colors.primaryForeground }]}>{site}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[s.label, { marginBottom: 6, fontSize: 11, marginTop: 12 }]}>Note (optional)</Text>
                  <TextInput
                    style={[s.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                    value={completeNote}
                    onChangeText={setCompleteNote}
                    placeholder="Add a note..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={[s.primaryBtn, { marginTop: 16 }, completing && { opacity: 0.7 }]}
                    onPress={handleMarkComplete}
                    disabled={completing}
                  >
                    {completing ? <ActivityIndicator color={colors.primaryForeground} /> : (
                      <>
                        <Feather name="check" size={18} color={colors.primaryForeground} />
                        <Text style={s.primaryBtnText}>Mark Completed</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={[s.secondaryBtn, { marginTop: 10 }]} onPress={handleMarkSkipped}>
                    <Text style={s.secondaryBtnText}>Mark Skipped</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Active Cycles Panel */}
      <Modal visible={cyclesPanel} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCyclesPanel(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Active Cycles</Text>
            <TouchableOpacity onPress={() => setCyclesPanel(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            {cycles.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Feather name="layers" size={40} color={colors.border} />
                <Text style={[s.subtitle, { marginTop: 12, textAlign: 'center' }]}>No active cycles</Text>
                <TouchableOpacity style={[s.primaryBtn, { marginTop: 16 }]} onPress={() => { setCyclesPanel(false); router.push('/add-cycle'); }}>
                  <Text style={s.primaryBtnText}>Add Cycle</Text>
                </TouchableOpacity>
              </View>
            ) : cycles.map((c) => {
              const name = c.cycleName || c.customCompoundName || 'Cycle';
              const cycleStart = new Date(c.startDate + 'T00:00:00');
              const weekNum = Math.floor((today.getTime() - cycleStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
              return (
                <View key={c.id} style={[s.cycleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{name}</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
                      {c.desiredDose} {c.doseUnit} · {c.durationWeeks ? `Week ${weekNum} of ${c.durationWeeks}` : `Week ${Math.max(weekNum, 1)}`}
                    </Text>
                    <View style={[{ alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }, { backgroundColor: c.status === 'paused' ? colors.warning + '20' : colors.success + '20' }]}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.status === 'paused' ? colors.warning : colors.success }}>{c.status}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity
                      onPress={() => { setCyclesPanel(false); router.push({ pathname: '/add-cycle', params: { editId: c.id } }); }}
                      style={{ padding: 8 }}
                    >
                      <Feather name="edit-2" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteCycle(c.id, name)}
                      style={{ padding: 8 }}
                      disabled={deletingCycleId === c.id}
                    >
                      {deletingCycleId === c.id
                        ? <ActivityIndicator size="small" color={colors.destructive} />
                        : <Feather name="trash-2" size={16} color={colors.destructive} />
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value, colors, valueColor }: { label: string; value: string; colors: any; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{label}</Text>
      <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: valueColor ?? colors.foreground, maxWidth: '60%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function EventDetailRow({ event, colors, compact = false }: { event: InjectionEvent; colors: any; compact?: boolean }) {
  const name = event.cycleName || event.customCompoundName || 'Unknown';
  const c = statusColor(event.status, colors);
  const t = event.scheduledAt.includes('T00:00:00') ? null : new Date(event.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: c, alignSelf: 'stretch', minHeight: 32 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: compact ? 13 : 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{name}</Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
          {event.plannedDose} {event.plannedDoseUnit} · {parseFloat(event.plannedSyringeUnits).toFixed(1)}u{t ? ` · ${t}` : ''}
        </Text>
        {!compact && (
          <View style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: c + '20' }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c }}>{event.status}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    headerMonth: { fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.foreground },
    headerActions: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    viewToggle: { flexDirection: 'row', borderRadius: 8, padding: 2, flex: 1 },
    viewToggleBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
    viewToggleTxt: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    iconBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
    addBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.primaryForeground },
    dayCell: { flex: 1, minHeight: 72, borderWidth: 0.5, borderColor: colors.border + '40', padding: 4, alignItems: 'center' },
    dayNumWrap: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    dayNum: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    dotRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3 },
    eventDot: { width: 7, height: 7, borderRadius: 3.5 },
    dayDetail: { backgroundColor: colors.card, margin: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16 },
    dayDetailTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 12 },
    emptyDayText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    eventCard: { backgroundColor: colors.muted, borderRadius: colors.radius - 4, padding: 12, marginBottom: 8 },
    weekDayRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 64 },
    weekDayLabel: { width: 56, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 12, paddingLeft: 8 },
    weekDayAbbr: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, textTransform: 'uppercase' },
    weekDayNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    weekDayNumText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    weekDayEvents: { flex: 1, padding: 8, gap: 6 },
    weekEventCard: { backgroundColor: colors.muted, borderRadius: colors.radius - 6, padding: 10 },
    // modals
    modal: { flex: 1, paddingTop: 20 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground },
    infoGrid: { marginBottom: 8 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
    label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    siteChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    siteChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    textArea: { borderWidth: 1, borderRadius: colors.radius, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 15, fontFamily: 'Inter_400Regular', minHeight: 80, textAlignVertical: 'top' },
    headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: colors.radius, paddingVertical: 14, paddingHorizontal: 24 },
    primaryBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.primaryForeground },
    secondaryBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
    secondaryBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.foreground },
    cycleRow: { flexDirection: 'row', alignItems: 'center', borderRadius: colors.radius, borderWidth: 1, padding: 14, marginBottom: 10 },
  });
}
