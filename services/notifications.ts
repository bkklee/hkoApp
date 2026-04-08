import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { addMinutesToHKOTime } from './weather';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

let lastNotificationBody = '';
let lastNotificationTitle = '';

/**
 * Common logic to update or dismiss the rain notification
 */
export async function updateRainNotification(rainfall: { amount: number, startTime: string, endTime: string }[]) {
  if (!rainfall || rainfall.length === 0) return;

  const currentRain = rainfall[0].amount;
  const anyRainLater = rainfall.some(r => r.amount >= 0.05);

  let title = '';
  let body = '';

  if (currentRain >= 0.05) {
    const firstDryIndex = rainfall.findIndex(r => r.amount < 0.05);
    if (firstDryIndex !== -1) {
      // The rain stops at the start of the first dry bucket
      const stopTime = rainfall[firstDryIndex].startTime;
      const formattedStopTime = `${stopTime.slice(8, 10)}:${stopTime.slice(10, 12)}`;
      title = '☔ 正在下雨';
      body = `預計雨勢將於 ${formattedStopTime} 左右停止。`;
    } else {
      title = '☔ 正在下雨';
      body = '未來兩小時預計持續有雨，請備雨具。';
    }
  } else if (anyRainLater) {
    const firstRainIndex = rainfall.findIndex(r => r.amount >= 0.05);
    const startTime = rainfall[firstRainIndex].startTime;
    const formattedStartTime = `${startTime.slice(8, 10)}:${startTime.slice(10, 12)}`;
    const rainAmount = rainfall[firstRainIndex].amount;
    
    title = '☁️ 降雨預警';
    body = `預計 ${formattedStartTime} 左右開始降雨 (約 ${rainAmount.toFixed(1)}mm)。`;
  } else {
    await Notifications.dismissNotificationAsync('rain-alert');
    lastNotificationBody = '';
    lastNotificationTitle = '';
    return;
  }

  // Only send if the message has changed to avoid bothering the user
  if (body !== lastNotificationBody) {
    try {
      // Logic for "Just change the context":
      // If we already have a notification and the title (status) hasn't changed, 
      // we update the body silently.
      const shouldAlert = (title !== lastNotificationTitle);
      
      await Notifications.scheduleNotificationAsync({
        identifier: 'rain-alert',
        content: {
          title,
          body,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          sound: shouldAlert, 
          sticky: true,
          data: { isSilentUpdate: !shouldAlert }
        },
        trigger: null,
      });
      lastNotificationBody = body;
      lastNotificationTitle = title;
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

  if (payload && payload.type === 'rainfall_update' && payload.updatedTime && Array.isArray(payload.rainfallNowcast)) {
    console.log('[BG TASK] Transforming and Processing Rain Data...');
    const formattedRainfall = payload.rainfallNowcast.map((amount: number, index: number) => ({
      updateTime: payload.updatedTime,
      startTime: addMinutesToHKOTime(payload.updatedTime, index * 30),
      endTime: addMinutesToHKOTime(payload.updatedTime, (index + 1) * 30),
      amount: amount
    }));
    await updateRainNotification(formattedRainfall);
  }
});

// Set up default notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const isSilentUpdate = data?.isSilentUpdate === true;

    return {
      shouldShowAlert: !isSilentUpdate,
      shouldPlaySound: !isSilentUpdate,
      shouldSetBadge: true,
      shouldShowBanner: !isSilentUpdate,
      shouldShowList: true,
    };
  },
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

    if (data && data.type === 'rainfall_update' && data.updatedTime && Array.isArray(data.rainfallNowcast)) {
      const formattedRainfall = data.rainfallNowcast.map((amount: number, index: number) => ({
        updateTime: data.updatedTime,
        startTime: addMinutesToHKOTime(data.updatedTime, index * 30),
        endTime: addMinutesToHKOTime(data.updatedTime, (index + 1) * 30),
        amount: amount
      }));
      updateRainNotification(formattedRainfall);
    }
  });

  return subscription;
}
