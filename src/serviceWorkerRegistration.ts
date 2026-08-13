const register = (): void => {
  if (!('serviceWorker' in navigator)) return;

  if (process.env.NODE_ENV !== 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch((error) => {
          console.warn('[PWA] service worker cleanup failed:', error);
        });

      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch((error) => {
            console.warn('[PWA] cache cleanup failed:', error);
          });
      }
    });
    return;
  }

  window.addEventListener('load', () => {
    const publicUrl = process.env.PUBLIC_URL || '';
    const swUrl = `${publicUrl}/sw.js`.replace(/\/+/g, '/');

    navigator.serviceWorker.register(swUrl).catch((error) => {
      // PWA support is progressive; a registration failure must not break the app.
      console.warn('[PWA] service worker registration failed:', error);
    });
  });
};

export default register;
