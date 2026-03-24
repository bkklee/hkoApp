import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as BackgroundTask from 'expo-background-task';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import { fetchRainfallNowcast } from './weather';
import { updateRainNotification, requestNotificationPermissions } from './notifications';

export const BACKGROUND_RAIN_TASK = 'background-rain-check';
export const LAST_BG_SYNC_KEY = 'last-background-sync';

// Define the background task
TaskManager.defineTask(BACKGROUND_RAIN_TASK, async ({ data, error }) => {
  const nowStr = new Date().toLocaleTimeString();
  
  if (error) {
    console.error('Background task error:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }

  try {
    await AsyncStorage.setItem(LAST_BG_SYNC_KEY, nowStr);

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (data && typeof data === 'object' && 'locations' in (data as any)) {
        const locations = (data as any).locations as Location.LocationObject[];
        if (locations.length > 0) {
            latitude = locations[0].coords.latitude;
            longitude = locations[0].coords.longitude;
        }
    }

    if (latitude === undefined || longitude === undefined) {
        const currentPosition = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        latitude = currentPosition.coords.latitude;
        longitude = currentPosition.coords.longitude;
    }

    console.log(`[${nowStr}] BG EXECUTION: Rain check for ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);

    const rainData = await fetchRainfallNowcast(latitude, longitude);
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
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_RAIN_TASK);
    console.log(`Initial Status: Task registered = ${isTaskRegistered}`);

    await requestNotificationPermissions();

    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') return false;

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      Alert.alert(
        "需要背景位置權限",
        "為了在背景持續為您監測降雨並發送即時通知，請將位置權限設定為「始終允許」。",
        [
          { text: "取消", style: "cancel" },
          { text: "前往設定", onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings() }
        ]
      );
      return false;
    }

    // 1. Register Background Fetch Task (Every 15 mins)
    await BackgroundTask.registerTaskAsync(BACKGROUND_RAIN_TASK, {
        minimumInterval: 15, 
    });

    // 2. Register Location Updates (Discrete updates to avoid blue arrow)
    await Location.startLocationUpdatesAsync(BACKGROUND_RAIN_TASK, {
      accuracy: Location.Accuracy.Balanced, // Balanced is usually enough and more discrete
      timeInterval: 15 * 60 * 1000, 
      distanceInterval: 2000, 
      showsBackgroundLocationIndicator: false, // REMOVED BLUE ARROW
      pausesUpdatesAutomatically: true, // Allow OS to pause if user is stationary
      activityType: Location.ActivityType.Other, 
      foregroundService: {
        notificationTitle: "Rainy HK 降雨監測中",
        notificationBody: "正在背景為您追蹤即時雨雲動向",
        notificationColor: "#4dabf7"
      },
    });

    console.log('--- BACKGROUND TRACKER ACTIVATED (SUBTLE MODE) ---');
    return true;
  } catch (error) {
    console.error('Failed to start background tracker:', error);
    return false;
  }
}

export async function stopBackgroundTracker() {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_RAIN_TASK);
    if (isStarted) await Location.stopLocationUpdatesAsync(BACKGROUND_RAIN_TASK);
    
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_RAIN_TASK);
    if (isRegistered) await BackgroundTask.unregisterTaskAsync(BACKGROUND_RAIN_TASK);
    
    console.log('Background tracker stopped');
}
