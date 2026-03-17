import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

let lastNotificationBody = '';

export async function updateRainNotification(rainfall: { amount: number, endTime: string }[]) {
  if (rainfall.length === 0) return;

  const currentRain = rainfall[0].amount;
  const anyRainLater = rainfall.some(r => r.amount >= 0.05);

  let title = '';
  let body = '';

  if (currentRain >= 0.05) {
    // Currently Raining: Find when it might stop
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
    // Not raining now, but rain is coming
    const firstRainIndex = rainfall.findIndex(r => r.amount >= 0.05);
    const startTime = rainfall[firstRainIndex].endTime;
    const formattedStartTime = `${startTime.slice(8, 10)}:${startTime.slice(10, 12)}`;
    const rainAmount = rainfall[firstRainIndex].amount;
    
    title = '☁️ 降雨預警';
    body = `預計 ${formattedStartTime} 左右開始降雨 (約 ${rainAmount.toFixed(1)}mm)。`;
  } else {
    // No rain expected: Clear existing notifications
    await Notifications.dismissNotificationAsync('rain-alert');
    lastNotificationBody = '';
    return;
  }

  // Only send if the message has changed to avoid bothering the user
  if (body !== lastNotificationBody) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'rain-alert', // Use a fixed ID to replace previous notification
      content: {
        title,
        body,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sticky: true,
      },
      trigger: null,
    });
    lastNotificationBody = body;
  }
}
