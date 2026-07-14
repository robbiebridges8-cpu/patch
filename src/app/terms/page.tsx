import Header from "@/components/layout/Header";

export const metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Patch.",
  alternates: { canonical: "/terms" },
};

const wrap = { maxWidth: 720, margin: "0 auto", padding: "64px 32px 96px" } as const;
const h1 = { fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.005em", color: "var(--color-text-primary)", marginBottom: 8 } as const;
const meta = { fontSize: 13, color: "var(--color-text-muted)", marginBottom: 32 } as const;
const h2 = { fontSize: 19, fontWeight: 600, color: "var(--color-text-primary)", margin: "32px 0 10px" } as const;
const p = { fontSize: 15, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 12 } as const;
const ul = { fontSize: 15, lineHeight: 1.8, color: "var(--color-text-secondary)", paddingLeft: 20, marginBottom: 12 } as const;
const a = { color: "var(--color-text-primary)", fontWeight: 500 } as const;

export default function TermsPage() {
  return (
    <>
      <Header />
      <main style={wrap}>
        <h1 style={h1}>Terms of Service</h1>
        <p style={meta}>Last updated: 14 July 2026</p>

        <p style={p}>
          These terms govern your use of Patch. By using the site, you agree to them. If you don&apos;t agree, please don&apos;t use Patch.
        </p>

        <h2 style={h2}>What Patch is</h2>
        <p style={p}>
          Patch is a discovery platform. We help you find mobile food vendors and caterers and pass on your enquiries — but we are
          <strong> not a party to any contract</strong> between you and a vendor. All bookings, payments, cancellations, and the
          food and service themselves are arranged directly between you and the vendor.
        </p>

        <h2 style={h2}>Enquiries and bookings</h2>
        <p style={p}>
          When you send an enquiry, we share your details with the chosen vendor so they can respond. Any quote, agreement, or booking
          is between you and the vendor. Always confirm the details — price, menu, dietary requirements, timings, and cancellation terms —
          directly with the vendor before paying anything.
        </p>

        <h2 style={h2}>Vetting and reviews</h2>
        <p style={p}>
          We take reasonable steps to check vendors (such as food hygiene ratings, public liability insurance, and trading history),
          but we cannot guarantee the quality, safety, or outcome of any individual booking. Reviews on Patch come from people who
          booked through the platform; we do not publish anonymous or incentivised reviews.
        </p>

        <h2 style={h2}>For vendors</h2>
        <p style={p}>
          If you list a service, you are responsible for the accuracy of your listing, holding the necessary licences and insurance,
          and complying with food safety law. Listing is offered on a subscription basis (currently £20 per month); subscription terms,
          renewals, and cancellations are handled through your vendor dashboard. You may pause or cancel at any time; fees already
          paid are non-refundable except where required by law.
        </p>

        <h2 style={h2}>Acceptable use</h2>
        <p style={p}>You agree not to misuse Patch — for example, by submitting false enquiries, scraping data, attempting to disrupt the service, or using it for anything unlawful.</p>

        <h2 style={h2}>Liability</h2>
        <p style={p}>
          Patch is provided &ldquo;as is&rdquo;. To the extent permitted by law, we are not liable for the acts or omissions of vendors,
          or for loss arising from a booking made through the platform. Nothing in these terms limits liability that cannot be limited
          by law (such as for death or personal injury caused by negligence, or fraud).
        </p>

        <h2 style={h2}>Governing law</h2>
        <p style={p}>
          These terms are governed by the laws of England and Wales, and disputes are subject to the exclusive jurisdiction of its courts.
        </p>

        <h2 style={h2}>Changes and contact</h2>
        <p style={p}>
          We may update these terms from time to time; the &ldquo;last updated&rdquo; date above will reflect any change.
          Questions? Email <a href="mailto:hello@patch.london" style={a}>hello@patch.london</a>.
        </p>
      </main>
    </>
  );
}
