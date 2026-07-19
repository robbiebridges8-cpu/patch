import webpush from "web-push";

/**
 * Web Push for the vendor control panel.
 *
 * Degrades the same way email does: without VAPID keys configured this no-ops
 * and logs, so the enquiry still lands and the dashboard still shows it. A push
 * is a nudge, never the delivery mechanism.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:vendors@patch.london";

  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID keys not set — push notifications disabled");
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushTarget {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send to every device a vendor has registered.
 *
 * Returns the subscription ids that are permanently dead (410/404) so the
 * caller can delete them — otherwise a vendor who reinstalls accumulates stale
 * endpoints and every send wastes a request on each one.
 */
export async function sendPush(
  targets: PushTarget[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; expired: string[] }> {
  if (!ensureConfigured() || targets.length === 0) {
    return { sent: 0, failed: 0, expired: [] };
  }

  const body = JSON.stringify(payload);
  const expired: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          body,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 410 Gone / 404 mean the subscription is dead for good.
        if (status === 410 || status === 404) expired.push(t.id);
        else console.error("[push] send failed:", status, (err as Error).message);
        failed++;
      }
    }),
  );

  return { sent, failed, expired };
}

export function pushConfigured(): boolean {
  return ensureConfigured();
}
