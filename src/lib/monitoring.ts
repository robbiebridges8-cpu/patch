/**
 * Error monitoring, provider-agnostic.
 *
 * Shaped for Sentry (captureException / captureMessage / breadcrumbs) but bound
 * to nothing. With no provider attached — the current state — errors still
 * reach the console, so behaviour is unchanged until a DSN exists.
 *
 * To wire Sentry later: `npm i @sentry/nextjs`, then in an instrumentation
 * hook call registerMonitoring({ name: "sentry", captureException: Sentry.captureException, ... }).
 */

export type Severity = "fatal" | "error" | "warning" | "info";

export interface ErrorContext {
  /** Where it happened — "api/enquiry", "search", "vendor/dashboard". */
  scope?: string;
  /** Extra detail. Must not contain secrets or personal data. */
  extra?: Record<string, unknown>;
  severity?: Severity;
}

export interface MonitoringProvider {
  name: string;
  captureException(error: unknown, context?: ErrorContext): void;
  captureMessage?(message: string, context?: ErrorContext): void;
  addBreadcrumb?(message: string, data?: Record<string, unknown>): void;
}

let provider: MonitoringProvider | null = null;

export function registerMonitoring(p: MonitoringProvider): void {
  provider = p;
}

/**
 * Keys whose values are redacted before anything leaves the process. Error
 * context is assembled from request payloads at several call sites, and an
 * email or API key in a stack trace is a breach, not a debugging aid.
 */
const REDACT = /^(email|password|token|secret|key|authorization|cookie|phone|api[_-]?key)$/i;

function scrub(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT.test(k) ? "[redacted]" : v;
  }
  return out;
}

export function captureException(error: unknown, context?: ErrorContext): void {
  const safe: ErrorContext | undefined = context && {
    ...context,
    extra: scrub(context.extra),
  };

  if (!provider) {
    console.error(`[error]${safe?.scope ? ` (${safe.scope})` : ""}`, error, safe?.extra ?? "");
    return;
  }

  try {
    provider.captureException(error, safe);
  } catch (err) {
    // Never let the reporter become the outage.
    console.error("[monitoring] provider threw:", err, "original:", error);
  }
}

export function captureMessage(message: string, context?: ErrorContext): void {
  const safe: ErrorContext | undefined = context && {
    ...context,
    extra: scrub(context.extra),
  };

  if (!provider) {
    if (safe?.severity === "warning" || safe?.severity === "info") {
      console.warn(`[monitoring]${safe?.scope ? ` (${safe.scope})` : ""}`, message);
    } else {
      console.error(`[monitoring]${safe?.scope ? ` (${safe.scope})` : ""}`, message);
    }
    return;
  }

  try {
    provider.captureMessage?.(message, safe);
  } catch (err) {
    console.error("[monitoring] provider threw:", err);
  }
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  try {
    provider?.addBreadcrumb?.(message, scrub(data));
  } catch {
    // Breadcrumbs are best-effort by definition.
  }
}

/** Test seam. */
export function __resetMonitoring(): void {
  provider = null;
}

export function currentProvider(): string | null {
  return provider?.name ?? null;
}
