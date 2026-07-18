import { describe, it, expect } from "vitest";
import { safeJsonLd, sanitizeNoteHtml } from "./sanitize";

describe("safeJsonLd", () => {
  // The actual vector: a vendor controls their own business name.
  it("neutralises a </script> break-out in vendor-controlled data", () => {
    const out = safeJsonLd({ name: "Taco </script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("\\u003c");
  });

  it("stays valid JSON that parses back to the original value", () => {
    const value = { name: "A < B & C", nested: { list: ["</script>", "ok"] } };
    expect(JSON.parse(safeJsonLd(value))).toEqual(value);
  });

  it("escapes the line separators that break some JSON parsers", () => {
    const out = safeJsonLd({ s: "a\u2028b\u2029c" });
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
  });
});

describe("sanitizeNoteHtml", () => {
  it("keeps the emphasis the note actually uses", () => {
    expect(sanitizeNoteHtml("I'd lean <strong>Taco Loco</strong>"))
      .toBe("I&#39;d lean <strong>Taco Loco</strong>");
  });

  it("strips a script tag the model was induced to echo", () => {
    const out = sanitizeNoteHtml('<script>alert(1)</script>');
    expect(out).not.toContain("<script");
    expect(out).toContain("&lt;script&gt;");
  });

  it("strips event handlers and img/svg payloads", () => {
    for (const payload of [
      '<img src=x onerror=alert(1)>',
      '<svg/onload=alert(1)>',
      '<a href="javascript:alert(1)">x</a>',
      '<iframe src="evil"></iframe>',
    ]) {
      const out = sanitizeNoteHtml(payload);
      expect(out, payload).not.toMatch(/<(img|svg|a|iframe)/i);
      expect(out, payload).toContain("&lt;");
    }
  });

  // Attributes are where XSS lives, so allowed tags are restored bare only.
  it("does not restore an allowed tag that carries attributes", () => {
    const out = sanitizeNoteHtml('<strong onmouseover="alert(1)">hi</strong>');
    expect(out).not.toContain("onmouseover=\"alert(1)\">");
    expect(out).toContain("&lt;strong");
  });

  it("is idempotent and safe on empty input", () => {
    expect(sanitizeNoteHtml("")).toBe("");
    const once = sanitizeNoteHtml("<strong>x</strong><script>y</script>");
    expect(sanitizeNoteHtml(once)).not.toContain("<script");
  });
});
