import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseSsrConfig } from "@/lib/supabase/ssr-config";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = getSupabaseSsrConfig();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies directly.
          // Middleware handles session refresh writes for those cases.
        }
      },
    },
  });
}
