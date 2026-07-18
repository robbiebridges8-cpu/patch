"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";

interface Message {
  id: string;
  sender: string;
  body: string;
  created_at: string;
}

function time(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BuyerThread({
  enquiryId,
  vendorName,
  onRead,
}: {
  enquiryId: string;
  vendorName: string;
  onRead?: () => void;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Held in a ref so the callback's identity can't retrigger the fetch — an
  // inline arrow from a caller would otherwise loop forever.
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/messages?enquiryId=${enquiryId}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setMessages(json.messages);
        // Reading the thread clears the unread badge server-side.
        onReadRef.current?.();
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError("Couldn't load this conversation.");
        setMessages([]);
      }
    })();

    return () => controller.abort();
  }, [enquiryId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enquiryId, body: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't send your message.");
      setDraft("");
      setMessages((m) => [
        ...(m ?? []),
        { id: `local-${Date.now()}`, sender: "buyer", body: text, created_at: new Date().toISOString() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.thread}>
      {messages === null ? (
        <p className={styles.threadEmpty}>Loading conversation…</p>
      ) : messages.length === 0 ? (
        <p className={styles.threadEmpty}>
          No messages yet. Send {vendorName} a note here and they&apos;ll be notified by email.
        </p>
      ) : (
        <ul className={styles.threadList}>
          {messages.map((m) => (
            <li
              key={m.id}
              className={`${styles.bubble} ${m.sender === "buyer" ? styles.bubbleMine : styles.bubbleTheirs}`}
            >
              <div className={styles.bubbleBody}>{m.body}</div>
              <div className={styles.bubbleMeta}>
                {m.sender === "buyer" ? "You" : vendorName} · {time(m.created_at)}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.threadForm} onSubmit={send}>
        <label className={styles.srOnly} htmlFor={`msg-${enquiryId}`}>
          Message {vendorName}
        </label>
        <textarea
          id={`msg-${enquiryId}`}
          className={styles.threadInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${vendorName}…`}
          rows={2}
          maxLength={4000}
        />
        <button type="submit" className={styles.threadSend} disabled={sending || !draft.trim()}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {error && <p className={styles.threadError}>{error}</p>}
    </div>
  );
}
