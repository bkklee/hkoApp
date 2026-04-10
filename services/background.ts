import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as BackgroundTask from 'expo-background-task';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import { fetchRainfallNowcast } from './weather';
import { updateRainNotification, requestNotificationPermissions, registerForPushNotificationsAsync } from './notifications';

export const BACKGROUND_RAIN_TASK = 'background-rain-check';
export const LAST_BG_SYNC_KEY = 'last-background-sync';

let starting = false;

/**
 * Update your server with the current push token and coordinates.
 * This is the core of how Silent Push works.
 */
async function registerLocationWithServer(latitude: number, longitude: number) {
  const pushToken = await registerForPushNotificationsAsync();
  if (!pushToken) return;

  try {
    const response = await fetch('https://kklee.dev/api/register-device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: pushToken,
        bundleId: 'com.kklee.rainyhk', 
        latitude: latitude,
        longitude: longitude,
      }),
    });

    if (response.ok) {
      console.log(`[Push Server] Registered: ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
    } else {
      console.error('[Push Server] Registration failed:', response.status);
    }
  } catch (error) {
    console.error('[Push Server] Network error:', error);
  }
}

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

    // 1. (NEW) Update server so it knows where to send Silent Pushes
    await registerLocationWithServer(latitude, longitude);

    // 2. (OLD) Still perform local check for transition period
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
  if (starting) return false;
  
  try {
    const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_RAIN_TASK);
    if (isTaskRegistered) return true;

    starting = true;
    console.log(`[Tracker] Starting background sequence...`);

    // Wait 2 seconds before asking for notifications/background location 
    // to give the user time to finish the foreground location prompt
    await new Promise(resolve => setTimeout(resolve, 2000));

    await requestNotificationPermissions();
    
    // Attempt to get push token early
    await registerForPushNotificationsAsync();

    // Check foreground permission first
    const { status: fgCheck } = await Location.getForegroundPermissionsAsync();
    if (fgCheck !== 'granted') {
      const { status: fgReq } = await Location.requestForegroundPermissionsAsync();
      if (fgReq !== 'granted') {
        starting = false;
        return false;
      }
    }

    // Check background permission
    const { status: bgCheck } = await Location.getBackgroundPermissionsAsync();
    if (bgCheck !== 'granted') {
      const { status: bgReq } = await Location.requestBackgroundPermissionsAsync();
      if (bgReq !== 'granted') {
        Alert.alert(
          "需要背景位置權限",
          "您未開啟「始終允許」位置權限。這將導致應用程式無法在背景為您監測降雨，您將無法收到降雨預警通知。",
          [
            { text: "我明白了", style: "cancel" },
            { text: "前往設定", onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings() }
          ]
        );
        starting = false;
        return false;
      }
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
    starting = false;
    return true;
  } catch (error) {
    console.error('Failed to start background tracker:', error);
    starting = false;
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
