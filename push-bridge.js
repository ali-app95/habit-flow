import { PushNotifications } from '@capacitor/push-notifications';

// This file is bundled by Vite. The classic app script reads this bridge
// when the user enables notifications.
window.HabitPushNotifications = PushNotifications;

let foregroundListenerAdded = false;
PushNotifications.addListener('pushNotificationReceived', notification => {
  const toast = document.getElementById('rewardToast');
  if (!toast) return;
  const title = notification && notification.title ? notification.title : 'Habit Flow 🔥';
  const body = notification && notification.body ? notification.body : 'Пора проверить привычки';
  toast.textContent = body ? title + ': ' + body : title;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 5000);
}).then(() => { foregroundListenerAdded = true; }).catch(error => {
  console.warn('Native foreground push listener failed:', error);
});
