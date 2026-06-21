import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, apikey, x-client-info",
};

// ─── Configuration ───────────────────────────────────────────────────────────

/** Max recipients (owner + collaborators) per reminder */
const MAX_RECIPIENTS_PER_REMINDER = 20;

/** Task deadline window: 72 hours */
const TASK_DEADLINE_HOURS = 72;

/** Event start window: 24 hours */
const EVENT_START_HOURS = 24;

/** Max retry attempts before cancelling */
const MAX_RETRY_ATTEMPTS = 3;

/** Retry interval in minutes */
const RETRY_INTERVAL_MINUTES = 5;

/** Evolution milestone thresholds */
const METRIC_THRESHOLDS = {
  followers_change_pct: 10, // Follower growth above 10%
  listeners_change_pct: 15, // Monthly listeners growth above 15%
  popularity_change_abs: 5, // Popularity increase above 5 points
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProAccount {
  user_id: string;
  status: string;
  grace_period_ends_at: string | null;
}

interface Artist {
  id: string;
  user_id: string;
  name: string;
}

interface TaskWithDeadline {
  id: string;
  description: string;
  deadline: string;
  status: string;
  strategy_title: string;
}

interface Recipient {
  user_id: string;
}

interface NotificationInsert {
  user_id: string;
  artist_id: string;
  type: string;
  title: string;
  message: string;
  source: "auto_task" | "auto_event" | "auto_metric";
  reference_type: "task" | "event" | "metric_snapshot";
  reference_id: string;
  scheduled_for: string;
  status: "active";
  link: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function isProActive(sub: ProAccount): boolean {
  if (sub.status === "active") return true;
  if (sub.status === "overdue") {
    const now = new Date();
    if (
      sub.grace_period_ends_at &&
      now < new Date(sub.grace_period_ends_at)
    ) {
      return true;
    }
  }
  return false;
}

function hoursFromNow(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    const nowISO = now.toISOString();

    // ── Step 1: Fetch active PRO accounts ──────────────────────────────────
    const { data: subscriptions, error: subErr } = await supabase
      .from("asaas_subscriptions")
      .select("user_id, status, grace_period_ends_at")
      .in("status", ["active", "overdue"]);

    if (subErr) {
      console.error("Error fetching subscriptions:", subErr);
      return jsonResponse({ error: "Failed to fetch subscriptions" }, 500);
    }

    const proUserIds = (subscriptions ?? [])
      .filter((s: ProAccount) => isProActive(s))
      .map((s: ProAccount) => s.user_id);

    if (proUserIds.length === 0) {
      // No PRO accounts — cancel any pending auto reminders for non-PRO
      await cancelNonProReminders(supabase);
      return jsonResponse({ processed: 0, message: "No PRO accounts found" });
    }

    // ── Step 5 (early): Cancel pending notifications for completed items ───
    await cancelCompletedItemReminders(supabase);

    // ── Cancel reminders for accounts that lost PRO status ─────────────────
    await cancelNonProReminders(supabase, proUserIds);

    // ── Step 2-4: Process each PRO artist ──────────────────────────────────
    // Fetch all artists belonging to PRO users (paid profiles only)
    const { data: artists, error: artistErr } = await supabase
      .from("artists")
      .select("id, user_id, name")
      .in("user_id", proUserIds)
      .eq("is_locked", false); // Only paid profiles (is_locked = false)

    if (artistErr) {
      console.error("Error fetching artists:", artistErr);
      return jsonResponse({ error: "Failed to fetch artists" }, 500);
    }

    let totalReminders = 0;
    const errors: string[] = [];

    for (const artist of artists ?? []) {
      try {
        const count = await processArtist(supabase, artist, nowISO);
        totalReminders += count;
      } catch (err) {
        const msg = `Error processing artist ${artist.id}: ${(err as Error).message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // ── Retry failed notifications ─────────────────────────────────────────
    await retryFailedNotifications(supabase, nowISO);

    return jsonResponse({
      processed: (artists ?? []).length,
      remindersGenerated: totalReminders,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("generate-reminders error:", (error as Error).message);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});

// ─── Process a single artist ─────────────────────────────────────────────────

async function processArtist(
  supabase: ReturnType<typeof createClient>,
  artist: Artist,
  nowISO: string
): Promise<number> {
  let reminderCount = 0;

  // Get recipients (owner + collaborators), capped at MAX_RECIPIENTS_PER_REMINDER
  const recipients = await getRecipients(supabase, artist);

  if (recipients.length === 0) return 0;

  // ── Check tasks due in 72h ─────────────────────────────────────────────
  const taskReminders = await generateTaskReminders(
    supabase,
    artist,
    recipients,
    nowISO
  );
  reminderCount += taskReminders;

  // ── Check events in 24h ────────────────────────────────────────────────
  const eventReminders = await generateEventReminders(
    supabase,
    artist,
    recipients,
    nowISO
  );
  reminderCount += eventReminders;

  // ── Check evolution milestones ─────────────────────────────────────────
  const metricReminders = await generateMetricReminders(
    supabase,
    artist,
    recipients,
    nowISO
  );
  reminderCount += metricReminders;

  return reminderCount;
}

// ─── Get recipients (owner + active collaborators, max 20) ───────────────────

async function getRecipients(
  supabase: ReturnType<typeof createClient>,
  artist: Artist
): Promise<Recipient[]> {
  const recipients: Recipient[] = [{ user_id: artist.user_id }];

  const { data: members } = await supabase
    .from("artist_members")
    .select("user_id")
    .eq("artist_id", artist.id)
    .eq("status", "active")
    .not("user_id", "is", null);

  if (members) {
    for (const member of members) {
      if (
        member.user_id &&
        member.user_id !== artist.user_id &&
        recipients.length < MAX_RECIPIENTS_PER_REMINDER
      ) {
        recipients.push({ user_id: member.user_id });
      }
    }
  }

  return recipients.slice(0, MAX_RECIPIENTS_PER_REMINDER);
}

// ─── Task reminders (72h before deadline) ────────────────────────────────────

async function generateTaskReminders(
  supabase: ReturnType<typeof createClient>,
  artist: Artist,
  recipients: Recipient[],
  nowISO: string
): Promise<number> {
  // Tasks are stored in strategic_plans.strategies JSONB
  const { data: plans } = await supabase
    .from("strategic_plans")
    .select("strategies")
    .eq("artist_id", artist.id)
    .eq("status", "active");

  if (!plans || plans.length === 0) return 0;

  const deadline72h = hoursFromNow(TASK_DEADLINE_HOURS);
  const tasksApproaching: TaskWithDeadline[] = [];

  for (const plan of plans) {
    const strategies = plan.strategies as Array<{
      title?: string;
      tasks?: Array<{
        id?: string;
        description?: string;
        deadline?: string;
        status?: string;
        isCompleted?: boolean;
      }>;
    }> | null;

    if (!Array.isArray(strategies)) continue;

    for (const strategy of strategies) {
      if (!Array.isArray(strategy.tasks)) continue;
      for (const task of strategy.tasks) {
        if (!task.deadline || !task.id) continue;
        if (task.status === "done" || task.isCompleted) continue;

        const deadlineDate = new Date(task.deadline);
        const nowDate = new Date(nowISO);

        // Task is due within 72h and hasn't passed yet
        if (deadlineDate > nowDate && deadlineDate <= new Date(deadline72h)) {
          tasksApproaching.push({
            id: task.id,
            description: task.description || "Tarefa sem descrição",
            deadline: task.deadline,
            status: task.status || "todo",
            strategy_title: strategy.title || "Estratégia",
          });
        }
      }
    }
  }

  if (tasksApproaching.length === 0) return 0;

  let insertedCount = 0;

  for (const task of tasksApproaching) {
    // Check if a reminder already exists for this task
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("reference_type", "task")
      .eq("reference_id", task.id)
      .eq("artist_id", artist.id)
      .eq("status", "active")
      .limit(1);

    if (existing && existing.length > 0) continue; // Already has a reminder

    const notifications: NotificationInsert[] = recipients.map((r) => ({
      user_id: r.user_id,
      artist_id: artist.id,
      type: "reminder",
      title: `Tarefa vencendo: ${task.description.substring(0, 60)}`,
      message: `A tarefa "${task.description}" da estratégia "${task.strategy_title}" vence em ${task.deadline}. Artista: ${artist.name}.`,
      source: "auto_task" as const,
      reference_type: "task" as const,
      reference_id: task.id,
      scheduled_for: new Date(task.deadline).toISOString(),
      status: "active" as const,
      link: `/artists/${artist.id}/dashboard`,
    }));

    const { error } = await supabase.from("notifications").insert(notifications);
    if (error) {
      console.error(`Failed to insert task reminders for ${task.id}:`, error);
    } else {
      insertedCount += notifications.length;
    }
  }

  return insertedCount;
}

// ─── Event reminders (24h before start) ──────────────────────────────────────

async function generateEventReminders(
  supabase: ReturnType<typeof createClient>,
  artist: Artist,
  recipients: Recipient[],
  nowISO: string
): Promise<number> {
  const now = new Date(nowISO);
  const in24h = new Date(now.getTime() + EVENT_START_HOURS * 60 * 60 * 1000);
  const todayStr = now.toISOString().split("T")[0];
  const tomorrowStr = new Date(in24h.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Fetch events happening within next 24h that aren't completed/cancelled
  const { data: events } = await supabase
    .from("events")
    .select("id, title, date, start_time, status")
    .eq("artist_id", artist.id)
    .gte("date", todayStr)
    .lte("date", tomorrowStr)
    .not("status", "in", '("completed","cancelled")');

  if (!events || events.length === 0) return 0;

  let insertedCount = 0;

  for (const event of events) {
    // Build event datetime
    const eventDatetime = buildEventDatetime(event.date, event.start_time);
    if (!eventDatetime) continue;

    // Event must be within 24h window
    if (eventDatetime <= now || eventDatetime > in24h) continue;

    // Check if reminder already exists
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("reference_type", "event")
      .eq("reference_id", event.id)
      .eq("artist_id", artist.id)
      .eq("status", "active")
      .limit(1);

    if (existing && existing.length > 0) continue;

    const notifications: NotificationInsert[] = recipients.map((r) => ({
      user_id: r.user_id,
      artist_id: artist.id,
      type: "reminder",
      title: `Evento em breve: ${event.title.substring(0, 60)}`,
      message: `O evento "${event.title}" está programado para ${event.date}${event.start_time ? ` às ${event.start_time}` : ""}. Artista: ${artist.name}.`,
      source: "auto_event" as const,
      reference_type: "event" as const,
      reference_id: event.id,
      scheduled_for: eventDatetime.toISOString(),
      status: "active" as const,
      link: `/artists/${artist.id}/agenda`,
    }));

    const { error } = await supabase.from("notifications").insert(notifications);
    if (error) {
      console.error(`Failed to insert event reminders for ${event.id}:`, error);
    } else {
      insertedCount += notifications.length;
    }
  }

  return insertedCount;
}

function buildEventDatetime(
  dateStr: string,
  startTime: string | null
): Date | null {
  try {
    if (startTime) {
      return new Date(`${dateStr}T${startTime}:00`);
    }
    // If no start_time, assume start of day
    return new Date(`${dateStr}T00:00:00`);
  } catch {
    return null;
  }
}

// ─── Metric milestone reminders ──────────────────────────────────────────────

async function generateMetricReminders(
  supabase: ReturnType<typeof createClient>,
  artist: Artist,
  recipients: Recipient[],
  _nowISO: string
): Promise<number> {
  // Get the latest snapshot with deltas
  const { data: snapshots } = await supabase
    .from("artist_metrics_snapshots")
    .select("id, deltas, collected_at")
    .eq("artist_id", artist.id)
    .not("deltas", "is", null)
    .order("collected_at", { ascending: false })
    .limit(1);

  if (!snapshots || snapshots.length === 0) return 0;

  const latest = snapshots[0];
  const deltas = latest.deltas as Record<
    string,
    { abs: number; pct: number }
  > | null;

  if (!deltas) return 0;

  const milestonesHit: string[] = [];

  // Check follower growth
  if (
    deltas.followers?.pct != null &&
    deltas.followers.pct >= METRIC_THRESHOLDS.followers_change_pct
  ) {
    milestonesHit.push(
      `Crescimento de seguidores: +${deltas.followers.pct.toFixed(1)}%`
    );
  }

  // Check monthly listeners growth
  if (
    deltas.monthly_listeners?.pct != null &&
    deltas.monthly_listeners.pct >= METRIC_THRESHOLDS.listeners_change_pct
  ) {
    milestonesHit.push(
      `Crescimento de ouvintes mensais: +${deltas.monthly_listeners.pct.toFixed(1)}%`
    );
  }

  // Check popularity change
  if (
    deltas.popularity?.abs != null &&
    deltas.popularity.abs >= METRIC_THRESHOLDS.popularity_change_abs
  ) {
    milestonesHit.push(
      `Aumento de popularidade: +${deltas.popularity.abs} pontos`
    );
  }

  if (milestonesHit.length === 0) return 0;

  // Check if we already sent a reminder for this snapshot
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("reference_type", "metric_snapshot")
    .eq("reference_id", latest.id)
    .eq("artist_id", artist.id)
    .eq("status", "active")
    .limit(1);

  if (existing && existing.length > 0) return 0;

  const message = `Marcos de evolução detectados para ${artist.name}:\n${milestonesHit.join("\n")}`;

  const notifications: NotificationInsert[] = recipients.map((r) => ({
    user_id: r.user_id,
    artist_id: artist.id,
    type: "milestone",
    title: `Marco de evolução: ${artist.name}`,
    message,
    source: "auto_metric" as const,
    reference_type: "metric_snapshot" as const,
    reference_id: latest.id,
    scheduled_for: new Date().toISOString(),
    status: "active" as const,
    link: `/artists/${artist.id}/dashboard`,
  }));

  const { error } = await supabase.from("notifications").insert(notifications);
  if (error) {
    console.error(
      `Failed to insert metric reminders for snapshot ${latest.id}:`,
      error
    );
    return 0;
  }

  return notifications.length;
}

// ─── Cancel pending reminders for completed items (within 5 min) ─────────────

async function cancelCompletedItemReminders(
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  // Cancel event reminders for completed/cancelled events
  const { data: activeEventReminders } = await supabase
    .from("notifications")
    .select("id, reference_id, artist_id")
    .eq("reference_type", "event")
    .eq("status", "active")
    .not("reference_id", "is", null);

  if (activeEventReminders && activeEventReminders.length > 0) {
    // Batch check which events are completed/cancelled
    const eventIds = [
      ...new Set(activeEventReminders.map((r) => r.reference_id)),
    ];
    const { data: completedEvents } = await supabase
      .from("events")
      .select("id")
      .in("id", eventIds)
      .in("status", ["completed", "cancelled"]);

    if (completedEvents && completedEvents.length > 0) {
      const completedIds = new Set(completedEvents.map((e) => e.id));
      const toCancel = activeEventReminders
        .filter((r) => completedIds.has(r.reference_id))
        .map((r) => r.id);

      if (toCancel.length > 0) {
        await supabase
          .from("notifications")
          .update({ status: "cancelled" })
          .in("id", toCancel);
      }
    }
  }

  // Cancel task reminders for completed tasks (check strategic_plans)
  // Tasks are in JSONB so we handle this differently — we check each active task reminder
  const { data: activeTaskReminders } = await supabase
    .from("notifications")
    .select("id, reference_id, artist_id")
    .eq("reference_type", "task")
    .eq("status", "active")
    .not("reference_id", "is", null);

  if (activeTaskReminders && activeTaskReminders.length > 0) {
    // Group by artist_id for efficient lookups
    const byArtist = new Map<string, typeof activeTaskReminders>();
    for (const reminder of activeTaskReminders) {
      const list = byArtist.get(reminder.artist_id) || [];
      list.push(reminder);
      byArtist.set(reminder.artist_id, list);
    }

    const toCancelIds: string[] = [];

    for (const [artistId, reminders] of byArtist) {
      const { data: plans } = await supabase
        .from("strategic_plans")
        .select("strategies")
        .eq("artist_id", artistId)
        .eq("status", "active");

      if (!plans) continue;

      // Build a set of completed task IDs
      const completedTaskIds = new Set<string>();
      for (const plan of plans) {
        const strategies = plan.strategies as Array<{
          tasks?: Array<{ id?: string; status?: string; isCompleted?: boolean }>;
        }> | null;
        if (!Array.isArray(strategies)) continue;
        for (const strategy of strategies) {
          if (!Array.isArray(strategy.tasks)) continue;
          for (const task of strategy.tasks) {
            if (task.id && (task.status === "done" || task.isCompleted)) {
              completedTaskIds.add(task.id);
            }
          }
        }
      }

      for (const reminder of reminders) {
        if (completedTaskIds.has(reminder.reference_id)) {
          toCancelIds.push(reminder.id);
        }
      }
    }

    if (toCancelIds.length > 0) {
      await supabase
        .from("notifications")
        .update({ status: "cancelled" })
        .in("id", toCancelIds);
    }
  }
}

// ─── Cancel reminders for non-PRO accounts ───────────────────────────────────

async function cancelNonProReminders(
  supabase: ReturnType<typeof createClient>,
  proUserIds?: string[]
): Promise<void> {
  if (proUserIds && proUserIds.length > 0) {
    // Cancel for users NOT in the PRO list
    // Supabase doesn't have a "not in" for update easily, so we fetch first
    const { data: nonProReminders } = await supabase
      .from("notifications")
      .select("id, user_id")
      .eq("status", "active")
      .in("source", ["auto_task", "auto_event", "auto_metric"]);

    if (nonProReminders && nonProReminders.length > 0) {
      const proSet = new Set(proUserIds);
      const toCancelIds = nonProReminders
        .filter((n) => !proSet.has(n.user_id))
        .map((n) => n.id);

      if (toCancelIds.length > 0) {
        await supabase
          .from("notifications")
          .update({ status: "cancelled" })
          .in("id", toCancelIds);
      }
    }
  } else {
    // No PRO users at all — cancel all automated reminders
    await supabase
      .from("notifications")
      .update({ status: "cancelled" })
      .eq("status", "active")
      .in("source", ["auto_task", "auto_event", "auto_metric"]);
  }
}

// ─── Retry failed notifications ──────────────────────────────────────────────

async function retryFailedNotifications(
  supabase: ReturnType<typeof createClient>,
  nowISO: string
): Promise<void> {
  // Find notifications that are due for retry (next_retry_at <= now, retry_count < MAX)
  const { data: retryable } = await supabase
    .from("notifications")
    .select("id, retry_count, next_retry_at")
    .eq("status", "active")
    .lt("retry_count", MAX_RETRY_ATTEMPTS)
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", nowISO);

  if (!retryable || retryable.length === 0) return;

  for (const notification of retryable) {
    const newRetryCount = (notification.retry_count || 0) + 1;

    if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
      // Max retries reached — cancel and log
      await supabase
        .from("notifications")
        .update({
          status: "cancelled",
          retry_count: newRetryCount,
          next_retry_at: null,
        })
        .eq("id", notification.id);

      console.error(
        `[MONITORING] Notification ${notification.id} cancelled after ${MAX_RETRY_ATTEMPTS} failed attempts.`
      );
    } else {
      // Schedule next retry
      const nextRetry = new Date(
        new Date(nowISO).getTime() + RETRY_INTERVAL_MINUTES * 60 * 1000
      );
      await supabase
        .from("notifications")
        .update({
          retry_count: newRetryCount,
          next_retry_at: nextRetry.toISOString(),
        })
        .eq("id", notification.id);
    }
  }
}
