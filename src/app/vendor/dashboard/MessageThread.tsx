"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { sendVendorMessage, markThreadRead } from "./actions";
import styles from "../vendor.module.css";

export interface ThreadMessage {
  id: string;
  sender: string;
  body: string;
  created_at: string;
  read_by_vendor?: boolean;
}

function time(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageThread({
  enquiryId,
  initial,
  buyerName,
}: {
  enquiryId: string;
  initial: ThreadMessage[];
  buyerName: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const marked = useRef(false);

  const unread = messages.filter((m) => m.sender === "buyer" && m.read_by_vendor === false).length;

  // Opening the thread is what marks it read — do it once per mount.
  useEffect(() => {
    if (unread > 0 && !marked.current) {
      marked.current = true;
      markThreadRead(enquiryId);
    }
  }, [unread, enquiryId]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    setError(null);
    setDraft("");
    // Optimistic: the server action reconciles on revalidate.
    const optimistic: ThreadMessage = {
      id: `pending-${Date.now()}`,
      sender: "vendor",
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    startTransition(async () => {
      const res = await sendVendorMessage(enquiryId, text);
      if (res?.error) {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(text);
        setError(res.error);
      }
    });
  }

  return (
    <div className={styles.thread}>
      {messages.length === 0 ? (
        <p className={styles.threadEmpty}>
          No messages yet. Reply here to keep the conversation in Patch — {buyerName} gets an
          email with a link back.
        </p>
      ) : (
        <ul className={styles.threadList} aria-live="polite" aria-relevant="additions">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`${styles.bubble} ${m.sender === "vendor" ? styles.bubbleMine : styles.bubbleTheirs}`}
            >
              <div className={styles.bubbleBody}>{m.body}</div>
              <div className={styles.bubbleMeta}>
                {m.sender === "vendor" ? "You" : buyerName} · {time(m.created_at)}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.threadForm} onSubmit={send}>
        <label className={styles.srOnly} htmlFor={`msg-${enquiryId}`}>
          Message {buyerName}
        </label>
        <textarea
          id={`msg-${enquiryId}`}
          className={styles.threadInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Reply to ${buyerName}…`}
          rows={2}
          maxLength={4000}
        />
        <button type="submit" className={styles.btn} disabled={pending || !draft.trim()}>
          {pending ? "Sending…" : "Send"}
        </button>
      </form>
      {error && <p className={styles.threadError}>{error}</p>}
    </div>
  );
}
