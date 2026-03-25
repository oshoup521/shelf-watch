import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabaseServer";

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface InventoryRow {
  user_id: string;
  name: string;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  subscription: webpush.PushSubscription;
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Compute date range: today through 3 days from now
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(today.getDate() + 3);

  const todayStr = today.toISOString().split("T")[0];
  const laterStr = threeDaysLater.toISOString().split("T")[0];

  const { data: expiringItems } = await supabase
    .from("inventory")
    .select("user_id, name")
    .gte("expiry_date", todayStr)
    .lte("expiry_date", laterStr);

  if (!expiringItems || expiringItems.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Group by user
  const byUser: Record<string, string[]> = {};
  (expiringItems as InventoryRow[]).forEach((item) => {
    if (!byUser[item.user_id]) byUser[item.user_id] = [];
    byUser[item.user_id].push(item.name);
  });

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*")
    .in("user_id", Object.keys(byUser));

  let sent = 0;
  const toDelete: string[] = [];

  await Promise.allSettled(
    ((subscriptions as PushSubscriptionRow[]) ?? []).map(async (sub) => {
      const names = byUser[sub.user_id];
      if (!names) return;

      const payload = JSON.stringify({
        title: "Shelf Watch - Saaman expire ho raha hai!",
        body: names.join(", "),
      });

      try {
        await webpush.sendNotification(sub.subscription, payload);
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          toDelete.push(sub.id);
        }
      }
    })
  );

  if (toDelete.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", toDelete);
  }

  return NextResponse.json({ sent });
}
