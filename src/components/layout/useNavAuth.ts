"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// The header/mobile-menu nav depends on *who* is looking:
//   out    → logged out
//   buyer  → logged in, owns no listing (still a candidate to list one)
//   vendor → logged in, owns a listing (wants to manage it, not "list a service")
// We resolve "vendor" by reading the caller's own vendors row — RLS
// (owner_id = auth.uid()) scopes this to exactly their listing, so a buyer
// gets an empty read and never sees vendor-only nav.
export type NavAuth = "loading" | "out" | "buyer" | "vendor";

export function useNavAuth(): NavAuth {
  const [state, setState] = useState<NavAuth>("loading");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function resolve(userId: string | undefined) {
      if (!userId) {
        if (active) setState("out");
        return;
      }
      const { data } = await supabase
        .from("vendors")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (active) setState(data ? "vendor" : "buyer");
    }

    supabase.auth.getUser().then(({ data }) => resolve(data.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      resolve(session?.user?.id),
    );
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
