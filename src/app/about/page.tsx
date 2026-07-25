import Header from "@/components/layout/Header";

export const metadata = {
  title: "About",
  description: "Patch is an AI-native marketplace matching Londoners with the right local services and trades — caterers, photographers, cleaners, DJs, tradespeople and more.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main id="main-content" style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 24, letterSpacing: "-0.02em" }}>About Patch</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Patch is a marketplace for local services and trades in London. We use AI to match people with the right business for the job — caterers, photographers, cleaners, DJs, tradespeople and more — based on what they actually need, not keyword searches. Food and catering is where we started; the platform is built for every kind of casual service.
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
