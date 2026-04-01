import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseSsrConfig } from "@/lib/supabase/ssr-config";

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseSsrConfig();

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
