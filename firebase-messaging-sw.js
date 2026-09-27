importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");
firebase.initializeApp({apiKey:"AIzaSyBS9GXvsdS-40Q_HQUR2nqbIpgkvhoo60c",authDomain:"habit-flow-4f442.firebaseapp.com",projectId:"habit-flow-4f442",storageBucket:"habit-flow-4f442.firebasestorage.app",messagingSenderId:"917670174871",appId:"1:917670174871:web:6bea1bf477ca446c97c9d2"});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>self.registration.showNotification(payload.notification?.title||"Habit Flow",{body:payload.notification?.body||"Время проверить свои привычки 🔥",data:{url:"/habit-flow/"}}));
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.openWindow(new URL("/habit-flow/",self.location.origin).href));});
