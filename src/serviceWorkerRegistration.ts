const register = (): void => {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

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
