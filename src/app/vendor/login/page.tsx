import { redirect } from "next/navigation";

// There's one sign-in now (/login). This path stays only as a redirect so old
// links, bookmarks and PWA shortcuts keep working — it carries the vendor
// context (landing + role) through to the unified flow.
export default async function VendorLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = next || "/vendor/dashboard";
  redirect(`/login?next=${encodeURIComponent(dest)}&intent=vendor`);
}
