import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { startBackgroundTracker } from '../services/background';
import { setupPushNotificationListeners } from '../services/notifications';

export default function RootLayout() {
  useEffect(() => {
    // Start the background tracker (Old polling method still active)
    startBackgroundTracker(); 
    
    // Set up listeners for new Push Notifications (Silent Data Pushes)
    let subscription: { remove: () => void } | undefined;
    
    const initNotifications = async () => {
      subscription = await setupPushNotificationListeners();
    };
    
    initNotifications();

    return () => {
      if (subscription) {
        subscription.remove();
      }
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
