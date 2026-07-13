import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY =
  process.env.REACT_APP_VAPID_PUBLIC_KEY ||
  'BP0r64VSNphAaljqe8weMj8YqoPskkiCpFguhja8Zq0rYpvLKPfZ9m14TAtGF-80j6F3E196EsrLz3ceHV34zrU';

export const isWebPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const decodeBase64Url = (value: string): Uint8Array => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const getRegistration = async (): Promise<ServiceWorkerRegistration> => navigator.serviceWorker.ready;

export const hasWebPushSubscription = async (): Promise<boolean> => {
  if (!isWebPushSupported()) return false;
  const subscription = await (await getRegistration()).pushManager.getSubscription();
  return !!subscription;
};

export const disableWebPush = async (userId: string): Promise<void> => {
  if (!isWebPushSupported()) return;
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);
  if (error) throw error;
};

export const enableWebPush = async (userId: string): Promise<void> => {
  if (!isWebPushSupported()) throw new Error('push_unsupported');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('push_permission_denied');

  const registration = await getRegistration();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(VAPID_PUBLIC_KEY) as BufferSource,
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('invalid_push_subscription');

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      expiration_time: json.expirationTime ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
};
