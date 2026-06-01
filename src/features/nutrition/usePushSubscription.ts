import { useEffect } from 'react';
import { authFetch } from '../../services/apiClient';

const API_URL = import.meta.env.VITE_API_URL ?? '';

async function registerPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  // Fetch VAPID public key — 503 means push not configured on server, bail silently
  const keyRes = await authFetch(`${API_URL}/user/push/vapid-public-key`).catch(() => null);
  if (!keyRes || !keyRes.ok) return;
  const { data } = await keyRes.json();
  if (!data?.key) return;

  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // Don't re-subscribe if already subscribed to same server key
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // Refresh registration on server in case it was lost
    await sendSubscription(existing);
    return;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.key),
  });
  await sendSubscription(subscription);
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Hook: registers push subscription once when the component mounts.
 * Safe to call from any page — degrades silently if push is unavailable or not configured.
 */
export function usePushSubscription() {
  useEffect(() => {
    registerPush().catch(() => {/* silent */});
  }, []);
}
