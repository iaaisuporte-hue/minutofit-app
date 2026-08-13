import { useEffect } from 'react';
import { authFetch } from '../../services/apiClient';
import { API_URL } from '../../services/apiBase';
import { isNativeApp } from '../../lib/platform';

export function isPushSupported(): boolean {
  // No app empacotado o push é nativo (FCM/APNs), não web push — não mexer no SW.
  if (isNativeApp()) return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * @param interactive `true` só quando parte de um clique explícito do usuário.
 *   Fora disso NUNCA pedimos a permissão: o prompt do sistema disparando sozinho
 *   no primeiro load da Hoje queimava a permissão (o usuário nega por reflexo e
 *   o navegador não pergunta de novo).
 */
async function registerPush(interactive: boolean): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (!interactive && Notification.permission !== 'granted') return false;

  // Fetch VAPID public key — 503 means push not configured on server, bail silently
  const keyRes = await authFetch(`${API_URL}/user/push/vapid-public-key`).catch(() => null);
  if (!keyRes || !keyRes.ok) return false;
  const { data } = await keyRes.json();
  if (!data?.key) return false;

  // O registro é feito uma única vez pelo AppUpdateBanner; aqui só esperamos.
  const reg = await navigator.serviceWorker.ready;

  // Don't re-subscribe if already subscribed to same server key
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // Refresh registration on server in case it was lost
    await sendSubscription(existing);
    return true;
  }

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.key),
  });
  await sendSubscription(subscription);
  return true;
}

/** Opt-in explícito: chamar a partir de um clique, depois de explicar o porquê. */
export function enablePushNotifications(): Promise<boolean> {
  return registerPush(true).catch(() => false);
}

async function sendSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  await authFetch(`${API_URL}/user/push/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      deviceLabel: navigator.userAgent.slice(0, 120),
    }),
  }).catch(() => {/* non-critical */});
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes;
}

/**
 * Hook: revalida no servidor a inscrição de quem JÁ concedeu a permissão.
 * Nunca abre o prompt do sistema — para isso existe `enablePushNotifications`,
 * chamado a partir do card de opt-in.
 */
export function usePushSubscription() {
  useEffect(() => {
    registerPush(false).catch(() => {/* silent */});
  }, []);
}
