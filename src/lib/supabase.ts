import { createBrowserClient } from "@supabase/ssr";

export type InventoryItem = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  quantity: number;
  expiry_date: string;
  image_url?: string;
  status: "good" | "expiring_soon" | "expired";
  created_at: string;
};

let _supabase: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
  if (!_supabase) {
    _supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

// Convenience proxy — lazily delegates to the real client.
// Using a Proxy means existing code that does `supabase.from(...)` keeps working.
export const supabase = new Proxy(
  {} as ReturnType<typeof createBrowserClient>,
  {
    get(_target, prop) {
      return getSupabase()[prop as keyof ReturnType<typeof createBrowserClient>];
    },
  }
);
