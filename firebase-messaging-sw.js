importScripts("./firebase-config.js?v=3");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

firebase.initializeApp(globalThis.HABIT_FIREBASE_CONFIG);

const messaging = firebase.messaging();

// Определяем базовый путь сайта динамически
const BASE_URL = self.location.origin;

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  
  self.registration.showNotification(
    data.title || "Habit Flow",
    {
      body: data.body || "Время проверить свои привычки 🔥",
      icon: `${BASE_URL}/icon-192.png`,
      badge: `${BASE_URL}/icon-192.png`,
      tag: "habit-flow-daily",
      renotify: false,
      data: { 
        url: data.url || BASE_URL 
      }
    }
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || BASE_URL;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      // Если вкладка уже открыта — фокусируемся на ней
      for (const client of clientList) {
        if (client.url.startsWith(BASE_URL) && "focus" in client) {
          if ("navigate" in client && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Если закрыта — открываем новую
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
