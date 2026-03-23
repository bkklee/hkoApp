import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { startBackgroundTracker } from '../services/background';

export default function RootLayout() {
  useEffect(() => {
    // Start the background tracker when the app launches
    startBackgroundTracker(); 
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
