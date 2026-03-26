import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

let lastNotificationBody = '';

/**
 * Common logic to update or dismiss the rain notification
 */
export async function updateRainNotification(rainfall: { amount: number, endTime: string }[]) {
  if (!rainfall || rainfall.length === 0) return;

  const currentRain = rainfall[0].amount;
  const anyRainLater = rainfall.some(r => r.amount >= 0.05);

  let title = '';
  let body = '';

  if (currentRain >= 0.05) {
    const firstDryIndex = rainfall.findIndex(r => r.amount < 0.05);
    if (firstDryIndex !== -1) {
      const stopTime = rainfall[firstDryIndex].endTime;
      const formattedStopTime = `${stopTime.slice(8, 10)}:${stopTime.slice(10, 12)}`;
      title = '☔ 正在下雨';
      body = `預計雨勢將於 ${formattedStopTime} 左右停止。`;
    } else {
      title = '☔ 正在下雨';
      body = '未來兩小時預計持續有雨，請備雨具。';
    }
  } else if (anyRainLater) {
    const firstRainIndex = rainfall.findIndex(r => r.amount >= 0.05);
    const startTime = rainfall[firstRainIndex].endTime;
    const formattedStartTime = `${startTime.slice(8, 10)}:${startTime.slice(10, 12)}`;
    const rainAmount = rainfall[firstRainIndex].amount;
    
    title = '☁️ 降雨預警';
    body = `預計 ${formattedStartTime} 左右開始降雨 (約 ${rainAmount.toFixed(1)}mm)。`;
  } else {
    await Notifications.dismissNotificationAsync('rain-alert');
    lastNotificationBody = '';
    return;
  }

  // Only send if the message has changed to avoid bothering the user
  if (body !== lastNotificationBody) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: 'rain-alert',
        content: {
          title,
          body,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          sound: true,
          sticky: true,
        },
        trigger: null,
      });
      lastNotificationBody = body;
    } catch (e) {
      console.error('Failed to schedule notification:', e);
    }
  }
}

// Define the task that handles silent pushes in the background
// Must be defined in the global scope
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background Notification Task Error:', error);
    return;
  }
  
  const notification = (data as any).notification;
  const payload = notification?.request?.content?.data;

  if (payload && payload.type === 'rainfall_update' && Array.isArray(payload.rainfallNowcast)) {
    console.log('[BG TASK] Processing Rain Data from Silent Push...');
    await updateRainNotification(payload.rainfallNowcast);
  }
});

// Set up default notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

/**
 * Register for Native Device Token
 */
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.warn('Must use physical device for Push Notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.error('Failed to get push token for push notification!');
    return null;
  }

  try {
    const pushToken = (await Notifications.getDevicePushTokenAsync()).data;
    console.log('--- NATIVE DEVICE TOKEN READY ---');
    console.log(pushToken);
    return pushToken;
  } catch (e) {
    console.error('Error getting native push token:', e);
    return null;
  }
}

/**
 * Register the background task (for when app is killed)
 */
export async function registerBackgroundNotificationTask() {
  if (Platform.OS !== 'ios') return;
  
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (!isRegistered) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      console.log('Background Notification Task Registered');
    }
  } catch (e) {
    console.error('Failed to register background notification task:', e);
  }
}

/**
 * Foreground listener
 */
export function setupPushNotificationListeners() {
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    const data = notification.request.content.data;
    console.log('Push Notification Received (Foreground):', data);

    if (data && data.type === 'rainfall_update' && Array.isArray(data.rainfallNowcast)) {
      updateRainNotification(data.rainfallNowcast);
    }
  });

  return subscription;
}
