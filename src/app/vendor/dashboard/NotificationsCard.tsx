"use client";

import { useEffect, useState } from "react";
import styles from "../vendor.module.css";

/**
 * Install prompt and push toggle.
 *
 * This card is the whole reason the vendor side is a PWA: getting to a lead
 * first is what wins the job, and a push beats an email by minutes.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Permission = "default" | "granted" | "denied" | "unsupported";

export default function NotificationsCard({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [permission, setPermission] = useState<Permission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installable, setInstallable] = useState<Event | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as Permission);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => { /* not registered yet — fine */ });

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallable(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as Permission);
      if (result !== "granted") {
        setBusy(false);
        return;
      }
      if (!vapidPublicKey) {
        setError("Notifications aren't configured on the server yet.");
        setBusy(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Couldn't save.");
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn notifications on.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError("Couldn't turn notifications off.");
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    if (!installable) return;
    // @ts-expect-error — prompt() is not in the standard Event type
    installable.prompt();
    setInstallable(null);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Notifications</span>
        {standalone && <span className={styles.badge}>installed</span>}
      </div>

      {permission === "unsupported" ? (
        <p className={styles.sub}>
          This browser doesn&apos;t support notifications. On iPhone, add Patch to your home screen
          first — Safari only allows them for installed apps.
        </p>
      ) : (
        <>
          <p className={styles.sub}>
            Get a notification the moment an enquiry arrives. Replying first is usually what wins
            the job.
          </p>

          {permission === "denied" && (
            <div className={`${styles.notice} ${styles.noticeErr}`}>
              Notifications are blocked for this site. You&apos;ll need to allow them in your
              browser settings before this will work.
            </div>
          )}

          {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}

          <div className={styles.leadActions}>
            {subscribed ? (
              <button type="button" className={styles.btnGhost} disabled={busy} onClick={disable}>
                {busy ? "Turning off…" : "Turn off notifications"}
              </button>
            ) : (
              <button
                type="button"
                className={styles.btn}
                disabled={busy || permission === "denied"}
                onClick={enable}
              >
                {busy ? "Enabling…" : "Notify me about new enquiries"}
              </button>
            )}

            {installable && !standalone && (
              <button type="button" className={styles.btnGhost} onClick={install}>
                Add to home screen
              </button>
            )}
          </div>

          {!standalone && !installable && (
            <p className={styles.metricHint} style={{ marginTop: 10 }}>
              To install: use your browser&apos;s &ldquo;Add to Home Screen&rdquo; option.
            </p>
          )}
        </>
      )}
    </div>
  );
}
