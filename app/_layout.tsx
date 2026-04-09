import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { startBackgroundTracker } from '../services/background';
import { setupPushNotificationListeners, registerBackgroundNotificationTask } from '../services/notifications';

export default function RootLayout() {
  useEffect(() => {
    // 1. Wait a bit before starting background tasks so they don't fight 
    // with the foreground location request in HomeScreen
    const timer = setTimeout(() => {
      startBackgroundTracker();
    }, 2000);
    
    // 2. Register background push task (For when app is killed)
    registerBackgroundNotificationTask();

    // 3. Set up foreground listeners
    const subscription = setupPushNotificationListeners();

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
