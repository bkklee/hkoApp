import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { startBackgroundTracker } from '../services/background';
import { setupPushNotificationListeners, registerBackgroundNotificationTask } from '../services/notifications';

export default function RootLayout() {
  useEffect(() => {
    // 1. Start the background tracker (Old polling method)
    startBackgroundTracker(); 
    
    // 2. Register background push task (For when app is killed)
    registerBackgroundNotificationTask();

    // 3. Set up foreground listeners
    const subscription = setupPushNotificationListeners();

    return () => {
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
