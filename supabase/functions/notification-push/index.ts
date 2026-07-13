import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENV_PUSH_WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") || "";
const ENV_VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_PUBLIC_KEY = "BP0r64VSNphAaljqe8weMj8YqoPskkiCpFguhja8Zq0rYpvLKPfZ9m14TAtGF-80j6F3E196EsrLz3ceHV34zrU";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:suporte@maestramanager.com";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
});

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { notification_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body.notification_id) return json({ error: "notification_id_required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: config } = await admin.rpc("get_push_config");
  const pushSecret = ENV_PUSH_WEBHOOK_SECRET || config?.push_webhook_secret || "";
  const vapidPrivateKey = ENV_VAPID_PRIVATE_KEY || config?.vapid_private_key || "";
  if (!pushSecret || req.headers.get("x-push-secret") !== pushSecret) {
    return json({ error: "forbidden" }, 403);
  }
  if (!vapidPrivateKey) return json({ error: "push_not_configured" }, 503);
  const { data: notification, error: notificationError } = await admin
    .from("notifications")
    .select("id,user_id,title,message,link")
    .eq("id", body.notification_id)
    .maybeSingle();
  if (notificationError) return json({ error: "notification_lookup_failed" }, 500);
  if (!notification) return json({ ok: true, sent: 0 });

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", notification.user_id);
  if (subscriptionsError) return json({ error: "subscription_lookup_failed" }, 500);
  if (!subscriptions?.length) return json({ ok: true, sent: 0 });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, vapidPrivateKey);
  const payload = JSON.stringify({
    title: notification.title || "Maestra Manager",
    body: notification.message || "Você tem uma nova notificação.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `notification-${notification.id}`,
    data: { url: notification.link || "/notifications" },
  });

  let sent = 0;
  for (const subscription of subscriptions as SubscriptionRow[]) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload, { TTL: 60 * 60 * 24 });
      sent++;
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      } else {
        console.error("[notification-push] delivery failed:", statusCode || "unknown");
      }
    }
  }

  return json({ ok: true, sent });
});
