import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "./OnboardingWizard";

export const metadata = {
  title: "List your business",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/vendor/onboarding&intent=vendor");

  // Already listed? Onboarding is only for the first listing — send them to the
  // dashboard. (This is the mirror of the dashboard redirecting listing-less
  // vendors here, so the two never loop.)
  const { data: existing } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existing) redirect("/vendor/dashboard");

  return <OnboardingWizard defaultEmail={user.email ?? ""} />;
}
