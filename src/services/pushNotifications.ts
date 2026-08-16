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

// O `userId` não é enviado: quem define o dono é o servidor, a partir do token de quem chama.
const saveSubscription = async (subscription: PushSubscription): Promise<void> => {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('invalid_push_subscription');

  // Antes era um upsert com onConflict:'endpoint'. Só que o endpoint é ÚNICO na tabela e pertence
  // ao navegador, não à conta: quando outra pessoa entrava no mesmo dispositivo, o upsert caía na
  // linha do dono anterior e a RLS recusava com 403 ("violates row-level security policy (USING
  // expression)") — em qualquer navegador com duas contas, ativar notificações parava de
  // funcionar de vez. A função no banco faz a troca de dono de forma controlada.
  const { error } = await supabase.rpc('fn_registrar_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_expiration: json.expirationTime ?? null,
  });
  if (error) throw error;
};

/**
 * Reassocia a inscrição deste navegador ao usuário atual.
 * A inscrição pertence ao dispositivo/browser, e pode ter sido criada por outra conta antes de um
 * logout — a função no banco transfere o endpoint, apagando a inscrição do dono anterior para que
 * ele não siga recebendo notificações num aparelho que não é mais dele.
 */
export const syncWebPushSubscription = async (): Promise<boolean> => {
  if (!isWebPushSupported() || Notification.permission !== 'granted') return false;
  const subscription = await (await getRegistration()).pushManager.getSubscription();
  if (!subscription) return false;
  await saveSubscription(subscription);
  return true;
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

export const enableWebPush = async (): Promise<void> => {
  if (!isWebPushSupported()) throw new Error('push_unsupported');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('push_permission_denied');

  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(VAPID_PUBLIC_KEY) as BufferSource,
  });
  await saveSubscription(subscription);
};
