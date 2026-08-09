# Friends & Family UAT — setup checklist

*What it takes to run a F&F round where the enquiry loop actually closes. Last
updated 2026-08-09. Owner: config + data (not code — the app is ready).*

The 50-user synthetic round's verdict was "loved the front-end, bounced off a
broken loop." F&F will do the same unless the three things below are real:
**email works**, **a few vendors can actually receive a lead**, and **search is
on the paid AI path**. Everything here is config/data you set — no code changes.

---

## 0. Deploy is current ✅
`main` is level with origin (the vertical-agnostic fix + `/search` redirect are
live). Netlify CD ships every push automatically.

---

## 1. Environment variables (Netlify → Site settings → Environment)

Exact names as the code reads them (`grep process.env src/`).

| Var | F&F? | What breaks without it |
|---|---|---|
| `ANTHROPIC_API_KEY` (+ credit) | **Must** | Search silently drops to keyword-only — not the product. |
| `VOYAGE_API_KEY` | **Must** | No semantic search; keyword fallback only. |
| `RESEND_API_KEY` | **Must** | No email at all — vendors never hear about a lead, buyers get no confirmation. |
| `ENQUIRY_FROM_EMAIL` | **Must** | The verified "from" address for Resend (e.g. `hello@patch.london`). Must be a domain you've verified in Resend. |
| `NEXT_PUBLIC_SITE_URL` | Should | Canonical URLs, sitemap, email links, redirects. Set to the real F&F URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Should | Push notifications + Stripe webhook writes. Not loop-critical for F&F. |
| `AI_DAILY_SEARCH_CAP` | Optional | Daily spend guard. Leave default unless you want a tighter cap for F&F. |
| Stripe (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`) | **Skip** | Billing isn't what F&F tests. Leave unset. |
| VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) | Skip | Web push; not needed for F&F. |

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already set (the
app runs), leave them.

After setting vars, **trigger a redeploy** — Netlify only picks up env changes on
a new build.

---

## 2. Supabase email template (so OTP login shows the code)

Supabase → Authentication → Email Templates → **Magic Link**. Make sure the body
exposes the token, otherwise the 6-digit code UX on `/login` shows nothing (the
magic-link button still works without this, so it's "should", not "must"):

```
<h2>Your Patch sign-in code</h2>
<p>Enter this code to sign in:</p>
<p style="font-size:24px;font-weight:700;letter-spacing:3px">{{ .Token }}</p>
<p>Or <a href="{{ .ConfirmationURL }}">click here to sign in</a>.</p>
```

---

## 3. Close the loop — make ~6 vendors able to receive a real lead

**This is the step that makes F&F feel real.** Today: 0 vendors are paid-tier,
and the code only emails a *full lead* to paid vendors (free ones get a "someone
wants to hire you — upgrade to reply" teaser). Seeded `contact_email`s are also
fake. So pick a handful of showcase vendors, point their contact email at an
inbox **you** control, and put them on the paid tier so the real lead lands.

Run in Supabase SQL editor (replace the email with your monitored inbox):

```sql
-- Showcase F&F vendors: top-reviewed, with photos and a filled-out profile.
with picks as (
  select id from vendors
  where status = 'live' and review_count >= 3
  order by rating_avg desc, review_count desc
  limit 6
)
update vendors v
set tier = 1,                              -- PAID: unlocks full lead emails
    contact_email = 'you+patchvendor@gmail.com'  -- an inbox you read
where v.id in (select id from picks);
```

Now an enquiry to any of those six emails you the full brief, you reply as the
"vendor," and the buyer sees a genuine response. That's the whole loop.

Optional, for a richer round (lets you also test the **vendor** side — dashboard,
lead inbox, editing): claim one or two of them to a real account by setting
`owner_id` to your Supabase auth user id after you log in once.

> Undo after F&F: `update vendors set tier = 0, contact_email = <original> …`.
> Note the originals first if you care about them.

---

## 4. Pre-flight smoke test (5 minutes, on the deployed URL)

- [ ] Home → search a real brief (e.g. "caterer for 40 in Hackney, ~£600") → shortlist streams in, each with a reason.
- [ ] Apply the **Location** and **Budget** filters → results update.
- [ ] Open a **showcase vendor** → send an enquiry → **the lead lands in your inbox** and the buyer sees "Enquiry sent" + a confirmation email.
- [ ] `/login` → request a code → it arrives → sign in → enquiry shows under **My enquiries**.
- [ ] Open a **non-showcase (free)** vendor → enquire → buyer still gets confirmation; that vendor gets the teaser (expected).
- [ ] Phone check: hamburger menu, sticky enquiry bar, no sideways scroll.

If all six pass, F&F is a real test, not a demo.

---

## What F&F is NOT testing (don't block on these)
- **Stripe / paid conversion** — billing flow is built but not the F&F question.
- **Real vendor supply at scale** — 500 seeded listings are enough to make search
  feel alive; genuine multi-vertical supply is a post-F&F growth problem.
- **Real photography** — category stock photos read fine for F&F; flag it as
  known if anyone asks.
