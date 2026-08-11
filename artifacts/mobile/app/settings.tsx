import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, updateUser, isAuthenticated } = useAuth();
  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const [isSaving, setIsSaving] = useState(false);

  const handleThemeChange = async (theme: string) => {
    if (!user) return;
    try {
      const { user: updated } = await api.auth.updateSettings({ theme });
      updateUser(updated);
      Haptics.selectionAsync();
    } catch { }
  };

  const handleFirstDayChange = async (day: string) => {
    if (!user) return;
    try {
      const { user: updated } = await api.auth.updateSettings({ firstDayOfWeek: day });
      updateUser(updated);
      Haptics.selectionAsync();
    } catch { }
  };

  const handleDefaultSyringeChange = async (size: string) => {
    if (!user) return;
    try {
      const { user: updated } = await api.auth.updateSettings({ defaultSyringeSize: size });
      updateUser(updated);
      Haptics.selectionAsync();
    } catch { }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          await logout();
          router.back();
        }
      }
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account', style: 'destructive', onPress: async () => {
            try {
              await api.auth.deleteAccount();
              await logout();
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        }
      ]
    );
  };

  const s = makeStyles(colors);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Account */}
        {isAuthenticated && user ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Account</Text>
            <View style={s.card}>
              <Row icon="mail" label="Email" value={user.email} colors={colors} />
              <Row icon="clock" label="Member since" value={new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })} colors={colors} />
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Account</Text>
            <View style={s.card}>
              <TouchableOpacity style={s.cardRow} onPress={() => router.push('/auth/login')}>
                <View style={s.rowLeft}>
                  <Feather name="log-in" size={18} color={colors.primary} />
                  <Text style={[s.rowLabel, { color: colors.primary }]}>Sign In</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity style={s.cardRow} onPress={() => router.push('/auth/register')}>
                <View style={s.rowLeft}>
                  <Feather name="user-plus" size={18} color={colors.primary} />
                  <Text style={[s.rowLabel, { color: colors.primary }]}>Create Account</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Appearance */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Appearance</Text>
          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={s.rowLeft}>
                <Feather name="sun" size={18} color={colors.mutedForeground} />
                <Text style={s.rowLabel}>Theme</Text>
              </View>
              <View style={s.segmented}>
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.segment, (user?.theme ?? 'system') === t && { backgroundColor: colors.primary }]}
                    onPress={() => handleThemeChange(t)}
                  >
                    <Text style={[s.segmentText, (user?.theme ?? 'system') === t && { color: colors.primaryForeground }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Calendar</Text>
          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={s.rowLeft}>
                <Feather name="calendar" size={18} color={colors.mutedForeground} />
                <Text style={s.rowLabel}>Week starts on</Text>
              </View>
              <View style={s.segmented}>
                {(['sunday', 'monday'] as const).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[s.segment, (user?.firstDayOfWeek ?? 'sunday') === d && { backgroundColor: colors.primary }]}
                    onPress={() => handleFirstDayChange(d)}
                  >
                    <Text style={[s.segmentText, (user?.firstDayOfWeek ?? 'sunday') === d && { color: colors.primaryForeground }]}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Defaults */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Calculator Defaults</Text>
          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={s.rowLeft}>
                <Feather name="activity" size={18} color={colors.mutedForeground} />
                <Text style={s.rowLabel}>Default syringe</Text>
              </View>
              <View style={s.segmented}>
                {(['1.0', '0.5'] as const).map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[s.segment, (user?.defaultSyringeSize ?? '1.0') === size && { backgroundColor: colors.primary }]}
                    onPress={() => handleDefaultSyringeChange(size)}
                  >
                    <Text style={[s.segmentText, (user?.defaultSyringeSize ?? '1.0') === size && { color: colors.primaryForeground }]}>
                      {size === '1.0' ? '1.0 mL' : '0.5 mL'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Legal */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Legal</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.cardRow}>
              <View style={s.rowLeft}>
                <Feather name="shield" size={18} color={colors.mutedForeground} />
                <Text style={s.rowLabel}>Medical Disclaimer</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={s.cardRow}>
              <View style={s.rowLeft}>
                <Feather name="lock" size={18} color={colors.mutedForeground} />
                <Text style={s.rowLabel}>Privacy Policy</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.cardRow, { borderBottomWidth: 0 }]}>
              <View style={s.rowLeft}>
                <Feather name="file-text" size={18} color={colors.mutedForeground} />
                <Text style={s.rowLabel}>Terms of Use</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Disclaimer */}
        <View style={[s.disclaimerBox, { marginHorizontal: 20 }]}>
          <Text style={s.disclaimerText}>
            For informational tracking and mathematical calculation only. This app does not provide medical advice, recommend dosages, diagnose conditions, or replace a licensed healthcare professional.
          </Text>
        </View>

        {/* Account actions */}
        {isAuthenticated && (
          <View style={s.section}>
            <View style={s.card}>
              <TouchableOpacity style={[s.cardRow, { borderBottomWidth: 0 }]} onPress={handleLogout}>
                <View style={s.rowLeft}>
                  <Feather name="log-out" size={18} color={colors.destructive} />
                  <Text style={[s.rowLabel, { color: colors.destructive }]}>Sign Out</Text>
                </View>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.deleteAccountBtn} onPress={handleDeleteAccount}>
              <Text style={s.deleteAccountText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Feather name={icon as any} size={18} color={colors.mutedForeground} />
        <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, maxWidth: '55%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.foreground },
    section: { paddingHorizontal: 20, marginTop: 24 },
    sectionTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    rowLabel: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.foreground },
    segmented: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: 8, padding: 2 },
    segment: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
    segmentText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    disclaimerBox: { backgroundColor: colors.muted, borderRadius: colors.radius - 4, padding: 14, marginTop: 16 },
    disclaimerText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', lineHeight: 16 },
    deleteAccountBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 12 },
    deleteAccountText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.destructive },
  });
}
