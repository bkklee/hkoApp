import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { fetchRainfallNowcast } from './weather';
import { updateRainNotification } from './notifications';

export const BACKGROUND_RAIN_TASK = 'background-rain-check';

// Define the background task
TaskManager.defineTask(BACKGROUND_RAIN_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return;
  }

  try {
    // 1. Get current location
    // Note: When triggered by Location.startLocationUpdatesAsync, the 'data' argument 
    // will contain the updated locations.
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (data && 'locations' in data) {
        const locations = (data as any).locations as Location.LocationObject[];
        if (locations.length > 0) {
            latitude = locations[0].coords.latitude;
            longitude = locations[0].coords.longitude;
        }
    }

    // Fallback to current position if not provided in task data
    if (latitude === undefined || longitude === undefined) {
        const currentPosition = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        latitude = currentPosition.coords.latitude;
        longitude = currentPosition.coords.longitude;
    }

    console.log(`Checking rain for background location: ${latitude}, ${longitude}`);
    
    // 2. Fetch latest rain data for this location
    const rainData = await fetchRainfallNowcast(latitude, longitude);
    
    // 3. Trigger notification if needed
    await updateRainNotification(rainData);
    
  } catch (err) {
    console.error('Error in background rain task:', err);
  }
});

/**
 * Request permissions and start the background tracker
 */
export async function startBackgroundTracker() {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('Foreground location permission denied');
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission denied');
      return false;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_RAIN_TASK);
    if (!isRegistered) {
      console.log('Registering background rain task...');
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_RAIN_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15 * 60 * 1000, // Check every 15 mins
      distanceInterval: 2000,        // Or when user moves 2km
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
        console.log('Background tracker stopped');
    }
}
