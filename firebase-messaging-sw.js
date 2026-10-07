importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:"AIzaSyBS9GXvsdS-40_QHUR2nqbIpgkvhoo4c",
  authDomain:"habit-flow-4f442.firebaseapp.com",
  projectId:"habit-flow-4f442",
  storageBucket:"habit-flow-4f442.firebasestorage.app",
  messagingSenderId:"917670174871",
  appId:"1:917670174871:web:6bea1bf477ca446c97c9d2"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  self.registration.showNotification(
    data.title || "Habit Flow",
    {
      body: data.body || "Время проверить свои привычки 🔥",
      icon: "/habit-flow/icon-192.png",
      badge: "/habit-flow/icon-192.png",
      tag: "habit-flow-daily",
      renotify: false,
      data: { url: data.url || "https://ali-app95.github.io/habit-flow/" }
    }
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const target = event.notification.data?.url || "https://ali-app95.github.io/habit-flow/";
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
