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
  console.log(`[${now}] Background task triggered (MOCK MODE)!`);

  if (error) {
    console.error('Background task error:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }

  try {
    // 1. Get current location (even if mock, we need coordinates for the API call log)
    let latitude: number = 22.3; 
    let longitude: number = 114.1;

    if (data && typeof data === 'object' && 'locations' in (data as any)) {
        const locations = (data as any).locations as Location.LocationObject[];
        if (locations.length > 0) {
            latitude = locations[0].coords.latitude;
            longitude = locations[0].coords.longitude;
        }
    }

    console.log(`[${now}] Running MOCK rain check for: ${latitude}, ${longitude}`);

    // --- MOCK RAIN DATA FOR TESTING ---
    // Instead of real fetching, we inject a heavy rain scenario
    const mockRainData = [
      { amount: 8.5, updateTime: '202603241400', endTime: '202603241430' },
      { amount: 12.0, updateTime: '202603241400', endTime: '202603241500' }
    ];
    
    console.log(`[${now}] Injecting MOCK rain: ${mockRainData[0].amount}mm`);

    // 2. Trigger notification with mock data
    await updateRainNotification(mockRainData);
    
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    console.error('Error in mock background rain task:', err);
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

    // Register Background Task (Periodic updates - back to 15 mins for stability)
    await BackgroundTask.registerTaskAsync(BACKGROUND_RAIN_TASK, {
        minimumInterval: 15 * 60, 
    });

    // Also register Location Updates (Movement-based updates - back to 2km)
    await Location.startLocationUpdatesAsync(BACKGROUND_RAIN_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15 * 60 * 1000, 
      distanceInterval: 2000, 
      showsBackgroundLocationIndicator: false, // Back to subtle mode
      foregroundService: {
        notificationTitle: "Rainy HK 降雨監測中",
        notificationBody: "正在背景為您追蹤即時雨雲動向",
        notificationColor: "#4dabf7"
      },
      pausesUpdatesAutomatically: false,
    });

    console.log('Background tracker started successfully (MOCK READY)');
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
