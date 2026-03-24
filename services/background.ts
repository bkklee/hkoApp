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
  console.log(`[${nowStr}] Background rain check started.`);

  if (error) {
    console.error('Background task error:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }

  try {
    // Save last sync time for UI visibility
    await AsyncStorage.setItem(LAST_BG_SYNC_KEY, nowStr);

    // 1. Get current location
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

    console.log(`[${nowStr}] Checking real rain for: ${latitude}, ${longitude}`);

    // 2. Fetch REAL latest rain data
    const rainData = await fetchRainfallNowcast(latitude, longitude);
    
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
    
    // 1. Request Notification Permissions
    await requestNotificationPermissions();

    // 2. Request Foreground Location Permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') return false;

    // 3. Request Background Location Permissions
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

    // Register Background Task (15 mins)
    await BackgroundTask.registerTaskAsync(BACKGROUND_RAIN_TASK, {
        minimumInterval: 15 * 60, 
    });

    // Register Location Updates (2km)
    await Location.startLocationUpdatesAsync(BACKGROUND_RAIN_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15 * 60 * 1000, 
      distanceInterval: 2000, 
      showsBackgroundLocationIndicator: false,
      pausesUpdatesAutomatically: false,
    });

    console.log('Background tracker fully active.');
    return true;
  } catch (error) {
    console.error('Failed to start background tracker:', error);
    return false;
  }
}

export async function stopBackgroundTracker() {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_RAIN_TASK);
    if (isStarted) await Location.stopLocationUpdatesAsync(BACKGROUND_RAIN_TASK);
    
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_RAIN_TASK);
    if (isTaskRegistered) await BackgroundTask.unregisterTaskAsync(BACKGROUND_RAIN_TASK);
}
