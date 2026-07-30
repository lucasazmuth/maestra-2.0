// Painel admin de adoção por perfil de artista.
// Lista todos os perfis e devolve um detalhe operacional com sinais de uso do
// Diagnóstico REAL, planejamento, plano de ação, catálogo, agenda, equipe e Nyta.
// O detalhe geral expõe apenas contagens e datas. O histórico completo é
// disponibilizado por uma ação separada, exclusiva para administradores, para
// fins de moderação.
//
// Body: { action: "list" } | { action: "detail", artistId } |
//       { action: "nyta-history", artistId }
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// deno-lint-ignore no-explicit-any
type AnyRow = Record<string, any>;
// deno-lint-ignore no-explicit-any
type AdminClient = any;

const array = <T = AnyRow>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const object = (value: unknown): AnyRow =>
  value && typeof value === "object" && !Array.isArray(value) ? value as AnyRow : {};

const maxIso = (...values: Array<string | null | undefined>): string | null => {
  const valid = values.filter((value): value is string => !!value && !Number.isNaN(Date.parse(value)));
  return valid.length ? valid.sort().at(-1)! : null;
};

const lastOf = (rows: AnyRow[], ...keys: string[]): string | null =>
  rows.reduce<string | null>((latest, row) => {
    const candidate = maxIso(...keys.map((key) => row[key] as string | null | undefined));
    return maxIso(latest, candidate);
  }, null);

const taskStats = (content: AnyRow) => {
  const strategies = array(content.strategies);
  const tasks = strategies.flatMap((strategy) => array(object(strategy).tasks));
  const done = tasks.filter((task) => object(task).status === "done").length;
  return {
    strategies: strategies.length,
    total: tasks.length,
    done,
    progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
};

const realSummary = (content: AnyRow) => {
  const real = object(content.realIndex);
  const profile = object(real.profile);
  const boletim = object(real.boletim);
  const dimensions = object(real.dimensions);
  const values = ["r", "e", "a", "l"]
    .map((key) => Number(boletim[key] ?? dimensions[key]))
    .filter(Number.isFinite);
  const score = Number.isFinite(Number(real.realScore))
    ? Math.round(Number(real.realScore))
    : values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : null;

  return {
    available: !!profile.name,
    profileName: String(profile.name || ""),
    profileKey: String(profile.key || ""),
    score,
    computedAt: typeof real.computedAt === "string" ? real.computedAt : null,
  };
};

const planningSummary = (content: AnyRow) => {
  const objectives = array(content.objectives);
  const strategies = array(content.strategies);
  const swot = object(content.swotAnalysis);
  const swotItems = ["strengths", "weaknesses", "opportunities", "threats"]
    .reduce((sum, key) => sum + array(swot[key]).length, 0);
  return {
    completed: objectives.length > 0 && strategies.length > 0,
    step: Number.isFinite(Number(content.step)) ? Number(content.step) : null,
    objectives: objectives.length,
    strategies: strategies.length,
    swotItems,
  };
};

const usage = (input: {
  real: boolean;
  planning: boolean;
  actionPlan: boolean;
  catalog: boolean;
  events: boolean;
  team: boolean;
  nyta: boolean;
}) => {
  const entries = Object.entries(input);
  const used = entries.filter(([, active]) => active).length;
  return { used, total: entries.length, percent: Math.round((used / entries.length) * 100), areas: input };
};

const activityLabel = (lastActivityAt: string | null) => {
  if (!lastActivityAt) return "never";
  const days = Math.floor((Date.now() - Date.parse(lastActivityAt)) / 864e5);
  if (days <= 7) return "active";
  if (days <= 30) return "recent";
  return "inactive";
};

const ensure = (result: { error?: { message?: string } | null }, label: string) => {
  if (result.error) throw new Error(`${label}: ${result.error.message || "erro desconhecido"}`);
  return result;
};

const authUsers = async (admin: AdminClient) => {
  const users: AnyRow[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const chunk = data?.users || [];
    users.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return new Map(users.map((user) => [user.id, user]));
};

const nameOf = (user?: AnyRow): string =>
  String(
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    ""
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  const admin: AdminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller) return json({ error: "Não autorizado" }, 401);

  let isAdmin = !!caller.app_metadata?.is_platform_admin;
  if (!isAdmin) {
    const { data: row } = await admin
      .from("platform_admins")
      .select("id")
      .eq("user_id", caller.id)
      .maybeSingle();
    isAdmin = !!row;
  }
  if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);

  let body: { action?: string; artistId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  try {
    if (body.action === "detail") return await detail(admin, body.artistId || "");
    if (body.action === "nyta-history") return await nytaHistory(admin, body.artistId || "");
    return await list(admin);
  } catch (error) {
    console.error("[admin-artists] erro:", (error as Error)?.message);
    return json({ error: "Erro interno" }, 500);
  }
});

async function list(admin: AdminClient) {
  const [usersById, artistsResult, catalogResult, eventsResult, membersResult, conversationsResult, messagesResult] =
    await Promise.all([
      authUsers(admin),
      admin.from("artists").select("id, user_id, name, content, is_locked, created_at, updated_at"),
      admin.from("catalog_items").select("artist_id, status, created_at, updated_at"),
      admin.from("events").select("artist_id, date, status, created_at, updated_at"),
      admin.from("artist_members").select("artist_id, status, created_at"),
      admin.from("nyta_conversations").select("id, artist_id, created_at, updated_at"),
      admin.from("nyta_messages").select("conversation_id, role, created_at"),
    ]);

  const artists = ensure(artistsResult, "artists").data || [];
  const catalog = ensure(catalogResult, "catalog_items").data || [];
  const events = ensure(eventsResult, "events").data || [];
  const members = ensure(membersResult, "artist_members").data || [];
  const conversations = ensure(conversationsResult, "nyta_conversations").data || [];
  const messages = ensure(messagesResult, "nyta_messages").data || [];
  const conversationArtist = new Map(conversations.map((row: AnyRow) => [row.id, row.artist_id]));
  const today = new Date().toISOString().slice(0, 10);

  const rows = artists.map((artist: AnyRow) => {
    const content = object(artist.content);
    const owner = usersById.get(artist.user_id);
    const artistCatalog = catalog.filter((row: AnyRow) => row.artist_id === artist.id);
    const artistEvents = events.filter((row: AnyRow) => row.artist_id === artist.id);
    const artistMembers = members.filter((row: AnyRow) => row.artist_id === artist.id);
    const artistConversations = conversations.filter((row: AnyRow) => row.artist_id === artist.id);
    const artistMessages = messages.filter((row: AnyRow) => conversationArtist.get(row.conversation_id) === artist.id);
    const real = realSummary(content);
    const planning = planningSummary(content);
    const actionPlan = taskStats(content);
    const userMessages = artistMessages.filter((row: AnyRow) => row.role === "user").length;
    const lastActivityAt = maxIso(
      artist.updated_at,
      lastOf(artistCatalog, "updated_at", "created_at"),
      lastOf(artistEvents, "updated_at", "created_at"),
      lastOf(artistMembers, "created_at"),
      lastOf(artistConversations, "updated_at", "created_at"),
      lastOf(artistMessages, "created_at"),
    );
    const adoption = usage({
      real: real.available,
      planning: planning.completed,
      actionPlan: actionPlan.total > 0,
      catalog: artistCatalog.length > 0,
      events: artistEvents.length > 0,
      team: artistMembers.length > 0,
      nyta: userMessages > 0,
    });

    return {
      id: artist.id,
      name: artist.name,
      image: content.spotifyProfile?.image || null,
      isLocked: artist.is_locked !== false,
      createdAt: artist.created_at,
      updatedAt: artist.updated_at,
      owner: {
        id: artist.user_id,
        name: nameOf(owner),
        email: owner?.email || "",
        lastSignInAt: owner?.last_sign_in_at || null,
      },
      real,
      planning,
      actionPlan,
      catalog: {
        total: artistCatalog.length,
        released: artistCatalog.filter((row: AnyRow) => row.status === "released").length,
      },
      events: {
        total: artistEvents.length,
        upcoming: artistEvents.filter((row: AnyRow) => row.date >= today && row.status !== "cancelled").length,
      },
      team: {
        total: artistMembers.length,
        active: artistMembers.filter((row: AnyRow) => row.status === "active").length,
      },
      nyta: {
        conversations: artistConversations.length,
        userMessages,
        lastAt: lastOf(artistMessages, "created_at") || lastOf(artistConversations, "updated_at"),
      },
      adoption,
      lastActivityAt,
      activity: activityLabel(lastActivityAt),
    };
  }).sort((a: AnyRow, b: AnyRow) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));

  return json({ artists: rows, total: rows.length, generatedAt: new Date().toISOString() });
}

async function nytaHistory(admin: AdminClient, artistId: string) {
  if (!artistId) return json({ error: "artistId é obrigatório" }, 400);

  const artistResult = await admin
    .from("artists")
    .select("id")
    .eq("id", artistId)
    .maybeSingle();
  const artist = ensure(artistResult, "artist").data;
  if (!artist) return json({ error: "Perfil não encontrado" }, 404);

  const conversationsResult = await admin
    .from("nyta_conversations")
    .select("id, created_at, updated_at")
    .eq("artist_id", artistId)
    .order("updated_at", { ascending: false });
  const conversations = ensure(conversationsResult, "nyta_conversations").data || [];
  const conversationIds = conversations.map((row: AnyRow) => row.id);

  if (!conversationIds.length) {
    return json({
      conversations: [],
      totalMessages: 0,
      truncated: false,
      generatedAt: new Date().toISOString(),
    });
  }

  const MESSAGE_LIMIT = 500;
  const messagesResult = await admin
    .from("nyta_messages")
    .select("id, conversation_id, role, content, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_LIMIT + 1);
  const messageRows = ensure(messagesResult, "nyta_messages").data || [];
  const truncated = messageRows.length > MESSAGE_LIMIT;
  const messages = messageRows.slice(0, MESSAGE_LIMIT);

  const grouped = conversations.map((conversation: AnyRow, index: number) => {
    const conversationMessages = messages
      .filter((message: AnyRow) => message.conversation_id === conversation.id)
      .sort((a: AnyRow, b: AnyRow) => a.created_at < b.created_at ? -1 : 1)
      .map((message: AnyRow) => ({
        id: message.id,
        role: String(message.role || "system"),
        content: String(message.content || ""),
        createdAt: message.created_at,
      }));

    return {
      id: conversation.id,
      label: `Conversa ${conversations.length - index}`,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      messages: conversationMessages,
    };
  });

  return json({
    conversations: grouped,
    totalMessages: messages.length,
    truncated,
    generatedAt: new Date().toISOString(),
  });
}

async function detail(admin: AdminClient, artistId: string) {
  if (!artistId) return json({ error: "artistId é obrigatório" }, 400);

  const artistResult = await admin
    .from("artists")
    .select("id, user_id, name, content, is_locked, created_at, updated_at, purchased_at")
    .eq("id", artistId)
    .maybeSingle();
  const artist = ensure(artistResult, "artist").data;
  if (!artist) return json({ error: "Perfil não encontrado" }, 404);

  const [ownerResult, catalogResult, eventsResult, membersResult, conversationsResult] = await Promise.all([
    admin.auth.admin.getUserById(artist.user_id),
    admin.from("catalog_items")
      .select("id, title, status, genre, release_date, created_at, updated_at")
      .eq("artist_id", artistId)
      .order("updated_at", { ascending: false }),
    admin.from("events")
      .select("id, title, type, date, start_time, status, source, created_at, updated_at")
      .eq("artist_id", artistId)
      .order("date", { ascending: false }),
    admin.from("artist_members")
      .select("id, name, email, status, access_levels, created_at")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false }),
    admin.from("nyta_conversations")
      .select("id, user_id, created_at, updated_at")
      .eq("artist_id", artistId),
  ]);

  const catalog = ensure(catalogResult, "catalog_items").data || [];
  const events = ensure(eventsResult, "events").data || [];
  const members = ensure(membersResult, "artist_members").data || [];
  const conversations = ensure(conversationsResult, "nyta_conversations").data || [];
  const conversationIds = conversations.map((row: AnyRow) => row.id);
  const messagesResult = conversationIds.length
    ? await admin.from("nyta_messages")
      .select("conversation_id, role, created_at")
      .in("conversation_id", conversationIds)
    : { data: [], error: null };
  const messages = ensure(messagesResult, "nyta_messages").data || [];
  const owner = ownerResult.data?.user;
  const content = object(artist.content);
  const identity = object(content.identity);
  const spotify = object(content.spotifyProfile);
  const chartmetric = object(content.chartmetricProfile);
  const real = object(content.realIndex);
  const diagnostic = object(content.diagnostic);
  const planning = planningSummary(content);
  const actionPlan = taskStats(content);
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const userMessages = messages.filter((row: AnyRow) => row.role === "user");
  const assistantMessages = messages.filter((row: AnyRow) => row.role === "assistant");

  const byCount = (rows: AnyRow[], key: string) =>
    rows.reduce<Record<string, number>>((acc, row) => {
      const value = String(row[key] || "other");
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});

  const strategyRows = array(content.strategies).map((value) => {
    const strategy = object(value);
    const tasks = array(strategy.tasks);
    const done = tasks.filter((task) => object(task).status === "done").length;
    return {
      id: String(strategy.id || ""),
      title: String(strategy.title || "Estratégia"),
      type: String(strategy.type || ""),
      tasks: tasks.length,
      done,
      progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    };
  });

  const realProfile = object(real.profile);
  const adoption = usage({
    real: !!realProfile.name,
    planning: planning.completed,
    actionPlan: actionPlan.total > 0,
    catalog: catalog.length > 0,
    events: events.length > 0,
    team: members.length > 0,
    nyta: userMessages.length > 0,
  });
  const lastActivityAt = maxIso(
    artist.updated_at,
    lastOf(catalog, "updated_at", "created_at"),
    lastOf(events, "updated_at", "created_at"),
    lastOf(members, "created_at"),
    lastOf(conversations, "updated_at", "created_at"),
    lastOf(messages, "created_at"),
  );

  return json({
    generatedAt: new Date().toISOString(),
    artist: {
      id: artist.id,
      name: artist.name,
      image: spotify.image || null,
      isLocked: artist.is_locked !== false,
      createdAt: artist.created_at,
      updatedAt: artist.updated_at,
      purchasedAt: artist.purchased_at,
      lastActivityAt,
      activity: activityLabel(lastActivityAt),
      adoption,
      owner: {
        id: artist.user_id,
        name: nameOf(owner),
        email: owner?.email || "",
        lastSignInAt: owner?.last_sign_in_at || null,
      },
    },
    profile: {
      identity: {
        name: identity.name || artist.name,
        genre: identity.genre || chartmetric.genre || "",
        stage: identity.stage || "",
        city: identity.city || "",
        state: identity.state || "",
        bio: identity.bio || "",
        vision: identity.vision || "",
        mission: identity.mission || "",
        values: array(identity.values),
      },
      spotify: {
        followers: spotify.followers ?? null,
        popularity: spotify.popularity ?? null,
        trackCount: spotify.track_count ?? null,
        genres: array(spotify.genres),
      },
      chartmetric: {
        monthlyListeners: chartmetric.monthly_listeners ?? null,
        careerRank: chartmetric.career_rank ?? null,
        enriched: !!chartmetric.enriched,
      },
    },
    real: {
      ...realSummary(content),
      description: realProfile.description || "",
      pattern: object(real.pattern),
      boletim: object(real.boletim),
      headline: diagnostic.headline || "",
      bullets: array(diagnostic.bullets),
      metrics: array(diagnostic.metrics),
    },
    planning: {
      ...planning,
      objectives: array(content.objectives),
      swot: {
        strengths: array(object(content.swotAnalysis).strengths).length,
        weaknesses: array(object(content.swotAnalysis).weaknesses).length,
        opportunities: array(object(content.swotAnalysis).opportunities).length,
        threats: array(object(content.swotAnalysis).threats).length,
      },
      executiveSummary: content.executiveSummary || "",
    },
    actionPlan: {
      ...actionPlan,
      strategies: strategyRows,
    },
    catalog: {
      total: catalog.length,
      byStatus: byCount(catalog, "status"),
      items: catalog.slice(0, 20).map((row: AnyRow) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        genre: row.genre,
        releaseDate: row.release_date,
        updatedAt: row.updated_at || row.created_at,
      })),
    },
    events: {
      total: events.length,
      upcoming: events.filter((row: AnyRow) => row.date >= today && row.status !== "cancelled").length,
      byType: byCount(events, "type"),
      items: [...events]
        .sort((a: AnyRow, b: AnyRow) => {
          const aFuture = a.date >= today;
          const bFuture = b.date >= today;
          if (aFuture !== bFuture) return aFuture ? -1 : 1;
          return aFuture ? (a.date > b.date ? 1 : -1) : (a.date < b.date ? 1 : -1);
        })
        .slice(0, 20)
        .map((row: AnyRow) => ({
          id: row.id,
          title: row.title,
          type: row.type,
          date: row.date,
          startTime: row.start_time,
          status: row.status,
          source: row.source,
        })),
    },
    team: {
      total: members.length,
      active: members.filter((row: AnyRow) => row.status === "active").length,
      members: members.map((row: AnyRow) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        status: row.status,
        accessLevels: row.access_levels || [],
        createdAt: row.created_at,
      })),
    },
    nyta: {
      conversations: conversations.length,
      messages: messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      lastAt: lastOf(messages, "created_at") || lastOf(conversations, "updated_at"),
      last7d: userMessages.filter((row: AnyRow) => row.created_at >= sevenDaysAgo).length,
      last30d: userMessages.filter((row: AnyRow) => row.created_at >= thirtyDaysAgo).length,
    },
  });
}
