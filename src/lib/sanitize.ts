/**
 * Output sanitisers for the two places this app deliberately emits raw HTML.
 *
 * Both exist because `dangerouslySetInnerHTML` and `<script type="ld+json">`
 * bypass React's automatic escaping, and both render content that is ultimately
 * attacker-influenced: vendors edit their own listing fields, and buyers control
 * the search query that the narration model sees.
 */

/**
 * Serialise data for a <script type="application/ld+json"> block.
 *
 * `JSON.stringify` does NOT escape `</script>`, so a vendor whose business name
 * contains `</script><script>…` closes the tag and executes. Escaping `<`
 * (and the line separators that break some parsers) is the standard fix and
 * leaves the JSON semantically identical — `<` parses back to `<`.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Allow-list sanitiser for the AI reasoning note.
 *
 * The narration prompt contains the buyer's raw query, so a crafted search can
 * try to make the model echo markup back — a reflected XSS in a shareable URL.
 * The note only ever needs light emphasis, so everything is escaped and then a
 * fixed set of tags is restored. Allow-list, never blocklist: anything the
 * model invents that isn't on this list renders as visible text.
 */
const ALLOWED = ["strong", "em", "b", "i"] as const;

export function sanitizeNoteHtml(input: string): string {
  if (!input) return "";

  const escaped = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Restore only bare open/close tags — no attributes, so there is nowhere to
  // hang an event handler or a javascript: URL.
  return ALLOWED.reduce(
    (html, tag) =>
      html
        .replace(new RegExp(`&lt;${tag}&gt;`, "gi"), `<${tag}>`)
        .replace(new RegExp(`&lt;/${tag}&gt;`, "gi"), `</${tag}>`),
    escaped,
  );
}
