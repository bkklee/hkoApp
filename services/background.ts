import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as BackgroundTask from 'expo-background-task';
import { Alert, Linking, Platform } from 'react-native';
import { fetchRainfallNowcast } from './weather';
import { updateRainNotification, requestNotificationPermissions } from './notifications';

export const BACKGROUND_RAIN_TASK = 'background-rain-check';
export const LAST_BG_SYNC_KEY = 'last-background-sync';

// Define the background task
TaskManager.defineTask(BACKGROUND_RAIN_TASK, async ({ data, error }) => {
  const now = new Date().toLocaleTimeString();
  console.log(`[${now}] Background task triggered!`);

  if (error) {
    console.error('Background task error:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }

  try {
    // 1. Get current location
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (data && typeof data === 'object' && 'locations' in (data as any)) {
        const locations = (data as any).locations as Location.LocationObject[];
        if (locations.length > 0) {
            latitude = locations[0].coords.latitude;
            longitude = locations[0].coords.longitude;
            console.log('Location trigger data found.');
        }
    }

    if (latitude === undefined || longitude === undefined) {
        console.log('No location data in trigger, fetching current position...');
        const currentPosition = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        latitude = currentPosition.coords.latitude;
        longitude = currentPosition.coords.longitude;
    }

    console.log(`[${now}] Checking rain for: ${latitude}, ${longitude}`);

    // 2. Fetch latest rain data
    const rainData = await fetchRainfallNowcast(latitude, longitude);
    console.log(`[${now}] Rain data fetched, amount: ${rainData[0]?.amount}`);

    // 3. Trigger notification
    await updateRainNotification(rainData);
    
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    console.error('Error in background rain task:', err);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Request permissions and start the background tracker
 */
export async function startBackgroundTracker() {
  try {
    const isAvailable = await TaskManager.isAvailableAsync();
    console.log('TaskManager Available:', isAvailable);

    if (!isAvailable) {
      console.warn('TaskManager is not available on this device. Check low power mode or background refresh settings.');
    }

    // 1. Request Notification Permissions
    await requestNotificationPermissions();

    // 2. Request Foreground Location Permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('Foreground location permission denied');
      return false;
    }

    // 3. Request Background Location Permissions
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission denied');
      
      Alert.alert(
        "需要背景位置權限",
        "為了在背景持續為您監測降雨並發送即時通知，請將位置權限設定為「始終允許」。",
        [
          { text: "取消", style: "cancel" },
          { 
            text: "前往設定", 
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }
          }
        ]
      );
      return false;
    }

    // Register Background Task (Periodic updates)
    await BackgroundTask.registerTaskAsync(BACKGROUND_RAIN_TASK, {
        minimumInterval: 5 * 60, // 5 minutes (Note: OS may still limit to 15 mins)
    });

    // Also register Location Updates (Movement-based updates)
    await Location.startLocationUpdatesAsync(BACKGROUND_RAIN_TASK, {
      accuracy: Location.Accuracy.High, // Use High accuracy to encourage OS wakeup
      timeInterval: 5 * 60 * 1000, // 5 minutes
      distanceInterval: 500, // Trigger every 500m (more aggressive)
      foregroundService: {
        notificationTitle: "Rainy HK 降雨監測中",
        notificationBody: "正在背景為您追蹤即時雨雲動向",
        notificationColor: "#4dabf7"
      },
      pausesUpdatesAutomatically: false,
    });

    console.log('Background tracker started successfully');
    return true;
  } catch (error) {
    console.error('Failed to start background tracker:', error);
    return false;
  }
}

/**
 * Stop the background tracker
 */
export async function stopBackgroundTracker() {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_RAIN_TASK);
    if (isStarted) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_RAIN_TASK);
    }
    
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_RAIN_TASK);
    if (isTaskRegistered) {
        await BackgroundTask.unregisterTaskAsync(BACKGROUND_RAIN_TASK);
    }
    
    console.log('Background tracker stopped');
}
