/* Firebase Cloud Messaging background worker.
   Prima dell'attivazione: inserire la configurazione Firebase reale qui sotto. */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD2WyRfiB7HbeXmVu481gmQYbZQLTla2zU',
  authDomain: 'compagnia-easy-members.firebaseapp.com',
  projectId: 'compagnia-easy-members',
  storageBucket: 'compagnia-easy-members.firebasestorage.app',
  messagingSenderId: '837831330373',
  appId: '1:837831330373:web:ca0316b28ee352c361f12c'
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || '1ª Compagnia Easy';
  const options = { body: payload.notification?.body || 'Hai un nuovo aggiornamento.', icon: './assets/icon-192.png', badge: './assets/icon-192.png', data: { url: payload.data?.url || './#home' } };
  self.registration.showNotification(title, options);
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './#home', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(client => client.url.startsWith(self.location.origin));
    if (existing) { existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  }));
});
