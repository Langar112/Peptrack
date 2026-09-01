import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/useColors';
import {
  addNotificationResponseReceivedListener,
  requestNotificationPermissions,
  routeNotificationResponse,
} from '@/services/notifications';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function HeaderRightSettings() {
  const router = useRouter();
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={() => router.push('/settings')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ marginRight: Platform.OS === 'web' ? 16 : 4, padding: 4 }}
    >
      <Feather name="settings" size={20} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function RootLayoutNav() {
  const colors = useColors();
  const { isLoading, sessionError, retrySession } = useAuth();

  if (isLoading || sessionError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.background }}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text style={{ fontSize: 17, fontFamily: 'Inter_600SemiBold', color: colors.foreground, textAlign: 'center' }}>
              We couldn’t start your private session
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 }}>
              {sessionError}
            </Text>
            <TouchableOpacity
              onPress={retrySession}
              style={{ marginTop: 20, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.primaryForeground }}>Try again</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerBackTitle: '',
      }}
    >
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: Platform.OS === 'web',
          title: 'PepTrack',
          headerRight: () => <HeaderRightSettings />,
        }}
      />
      <Stack.Screen name="cycle/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="add-cycle" options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Request notification permission once on startup (no-op on web)
    requestNotificationPermissions();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let subscription: Awaited<
      ReturnType<typeof addNotificationResponseReceivedListener>
    > = null;

    const registerResponseListener = async () => {
      subscription = await addNotificationResponseReceivedListener((response) => {
        if (!isMounted) return;
        routeNotificationResponse(response, (route) => router.push(route));
      });

      // The lazy native module may resolve after this layout unmounts.
      // Remove the subscription immediately in that case.
      if (!isMounted) subscription?.remove();
    };

    void registerResponseListener();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [router]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
