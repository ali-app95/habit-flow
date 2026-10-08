importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBS9GXvsdS-40Q_HQUR2nqbIpgkvhoo60c",
  projectId: "habit-flow-4f442",
  messagingSenderId: "917670174871",
  appId: "1:917670174871:web:6bea1bf477ca446c97c9d2"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Habit Flow 🔥';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Время проверить привычки!',
    icon: './favicon-32.png',
    data: { url: payload.data?.url || './' }
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
