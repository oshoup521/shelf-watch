import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import DashboardClient from "@/components/DashboardClient";
import { InventoryItem } from "@/lib/supabase";

function computeStatus(expiry_date: string): InventoryItem["status"] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiry_date + "T00:00:00");
  const diffDays = Math.round(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "expired";
  if (diffDays <= 3) return "expiring_soon";
  return "good";
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: raw } = await supabase
    .from("inventory")
    .select("*")
    .eq("user_id", user.id)
    .order("expiry_date", { ascending: true });

  const inventory: InventoryItem[] = (raw ?? []).map(
    (item: Omit<InventoryItem, "status">) => ({
      ...item,
      status: computeStatus(item.expiry_date),
    })
  );

  return <DashboardClient initialInventory={inventory} userId={user.id} />;
}
