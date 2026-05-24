import Header from "@/components/layout/Header";

export default function AboutPage() {
  return (
    <>
      <Header />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--navy)", marginBottom: 24, letterSpacing: "-0.02em" }}>About Patch</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--text-2)", marginBottom: 16 }}>
          Patch is a marketplace for mobile food vendors and small caterers in London. We use AI to match event organisers with the right street food trucks, catering companies, and mobile bars — based on what they actually need, not keyword searches.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--text-2)", marginBottom: 16 }}>
          Every vendor on Patch is vetted. We check food hygiene ratings, public liability insurance, and only list businesses with a track record of great events.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--text-2)" }}>
          We launched in 2026, starting with London. If you&apos;re a vendor and want to be listed, or a client with feedback, get in touch at <a href="mailto:hello@patch.london" style={{ color: "var(--navy)", fontWeight: 500 }}>hello@patch.london</a>.
        </p>
      </main>
    </>
  );
}
