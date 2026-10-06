# Habit Flow — push через Cloudflare Workers

Сайт работает на GitHub Pages, привычки синхронизируются через Firebase/Firestore, а планирование push выполняет Cloudflare Worker + D1. Фактическую доставку уведомлений выполняет Firebase Cloud Messaging (FCM).

## Безопасность

- Не добавляйте JSON Service Account или private key в GitHub.
- Service Account JSON хранится только в Cloudflare Secret.
- Firebase Web API key в клиентском коде не является секретом; доступ к данным защищён Firebase Authentication и Firestore Rules.
- URL сайта и Worker рассчитаны на `https://ali-app95.github.io/habit-flow/`.

## Настройка Cloudflare

1. Создайте D1-базу `habit-flow-push`.
2. Выполните `cloudflare-worker/schema.sql`.
3. В `cloudflare-worker/wrangler.toml` замените `REPLACE_WITH_D1_DATABASE_ID` на ID D1.
4. В Cloudflare задайте секреты:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — полный JSON Service Account.
   - `FIREBASE_WEB_API_KEY` — Web API key из `firebase-config.js`.
5. Выполните `wrangler deploy`.
6. URL Worker указывается в `firebase-config.js` без `/subscribe`.

## Как работает push

- Браузер получает FCM token и отправляет его Worker вместе с Firebase ID token.
- Worker проверяет Firebase ID token и сохраняет подписку в D1.
- Cron запускается раз в минуту и отправляет push в заданное пользователем локальное время.
- При отключении уведомлений, выходе из аккаунта или полном сбросе приложения подписка отключается на Worker.
- Невалидные FCM tokens автоматически отключаются после ошибки FCM.

## Проверка

После развёртывания откройте сайт, включите уведомления и задайте время на несколько минут вперёд. Логи Worker и таблицу `subscriptions` можно проверить в Cloudflare.

> Для iPhone веб-push обычно требуется добавить сайт на экран «Домой» и разрешить уведомления.
