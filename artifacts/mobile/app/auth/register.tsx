import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { ApiError } from '@/services/api';

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
    if (!email.trim()) { setError('Please enter your email.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      await register(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Registration failed. Please try again.';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: Platform.OS === 'web' ? 20 : insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={s.header}>
          <Text style={s.title}>Create Account</Text>
          <Text style={s.subtitle}>Save cycles, schedule injections, and track progress</Text>
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={s.field}>
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={(t) => { setEmail(t); setError(''); }}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Password</Text>
          <View style={s.passwordRow}>
            <TextInput
              style={[s.input, { flex: 1, borderRightWidth: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              placeholder="Min. 8 characters"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
            />
            <TouchableOpacity
              style={[s.eyeBtn, { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
              onPress={() => setShowPassword((p) => !p)}
            >
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Confirm Password</Text>
          <TextInput
            style={s.input}
            value={confirm}
            onChangeText={(t) => { setConfirm(t); setError(''); }}
            placeholder="Re-enter password"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[s.primaryBtn, isLoading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={s.primaryBtnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={s.switchRow}>
          <Text style={s.switchText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace('/auth/login')}>
            <Text style={s.switchLink}> Sign in</Text>
          </TouchableOpacity>
        </View>

        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            For informational tracking and mathematical calculation only. This app does not provide medical advice, recommend dosages, diagnose conditions, or replace a licensed healthcare professional. Always verify calculations before use.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function styles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: 24, paddingBottom: 60 },
    backBtn: { alignSelf: 'flex-end', padding: 8, marginTop: 8 },
    header: { marginTop: 16, marginBottom: 32 },
    title: { fontSize: 30, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: -0.5 },
    subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 6 },
    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.destructive + '18', borderRadius: colors.radius - 4,
      padding: 12, marginBottom: 16,
    },
    errorText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.destructive },
    field: { marginBottom: 18 },
    label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.foreground,
    },
    passwordRow: { flexDirection: 'row' },
    eyeBtn: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
    },
    primaryBtn: {
      backgroundColor: colors.primary, borderRadius: colors.radius, paddingVertical: 16,
      alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 20, minHeight: 52,
    },
    primaryBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primaryForeground },
    switchRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 32 },
    switchText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    switchLink: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.primary },
    disclaimer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 },
    disclaimerText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', lineHeight: 16 },
  });
}
