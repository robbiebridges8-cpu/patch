import Header from "@/components/layout/Header";

export const metadata = {
  title: "About",
  description: "Patch is an AI-native marketplace matching London event organisers with mobile food vendors and caterers.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main id="main-content" style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 24, letterSpacing: "-0.02em" }}>About Patch</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Patch is a marketplace for mobile food vendors and small caterers in London. We use AI to match event organisers with the right street food trucks, catering companies, and mobile bars — based on what they actually need, not keyword searches.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Patch does not vet or verify the businesses listed. Listings are self-declared, and it is
          worth asking to see the licences, insurance or certifications that matter for your job
          before you book. What Patch does is find the right handful of people to ask.</p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
          We launched in 2026, starting with London. If you&apos;re a vendor and want to be listed, or a client with feedback, get in touch at <a href="mailto:hello@patch.london" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>hello@patch.london</a>.
        </p>
      </main>
    </>
  );
}
