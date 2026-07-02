import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only allow POST or DELETE methods
    if (req.method !== "POST" && req.method !== "DELETE") {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get JWT token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    // API da Asaas: produção https://api.asaas.com, sandbox https://api-sandbox.asaas.com.
    // Path /v3 (SEM /api) — api.asaas.com responde 404 para /api/v3.
    const asaasBaseUrl = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com";

    if (!asaasApiKey) {
      console.error("ASAAS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Erro interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's JWT to get user context
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Look up user's subscription in asaas_subscriptions
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from("asaas_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !subscription) {
      return new Response(
        JSON.stringify({ error: "Recurso não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Resolve o id da assinatura na Asaas.
    // Há linhas antigas com status 'active' mas asaas_subscription_id NULO (ativadas via webhook).
    // Antes isso retornava 404 e travava o cancelamento. Agora: se faltar o id, busca a assinatura
    // na Asaas pelo cliente (asaas_customer_id) para também encerrar a cobrança recorrente.
    let asaasSubscriptionId: string | null = subscription.asaas_subscription_id || null;

    if (!asaasSubscriptionId && subscription.asaas_customer_id) {
      try {
        const listResp = await fetch(
          `${asaasBaseUrl}/v3/subscriptions?customer=${subscription.asaas_customer_id}`,
          { headers: { "access_token": asaasApiKey, "Content-Type": "application/json" } }
        );
        if (listResp.ok) {
          const listJson = await listResp.json();
          const items = Array.isArray(listJson?.data) ? listJson.data : [];
          const match = items.find((s: any) => s.status === "ACTIVE") || items[0];
          if (match?.id) asaasSubscriptionId = match.id;
        } else {
          console.warn("Busca de assinatura por cliente retornou", listResp.status);
        }
      } catch (lookupErr: any) {
        console.warn("Falha ao buscar assinatura por cliente:", lookupErr?.message);
        // Segue mesmo assim: vamos cancelar localmente para o usuário perder o acesso.
      }
    }

    // 3. Cancela na Asaas (DELETE /v3/subscriptions/{id}), se houver um id.
    // Sem id (grant manual/legado ou cliente sem assinatura na Asaas), pula direto pro
    // cancelamento local — o usuário SEMPRE consegue encerrar e perder o acesso Pro.
    if (asaasSubscriptionId) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let asaasResponse: Response;
      try {
        asaasResponse = await fetch(
          `${asaasBaseUrl}/v3/subscriptions/${asaasSubscriptionId}`,
          {
            method: "DELETE",
            headers: {
              "access_token": asaasApiKey,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        if (fetchErr.name === "AbortError") {
          console.error("Asaas API timeout for subscription:", asaasSubscriptionId);
          return new Response(
            JSON.stringify({ error: "Falha na comunicação com serviço de pagamento" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.error("Asaas API network error:", fetchErr.message);
        return new Response(
          JSON.stringify({ error: "Serviço de pagamento indisponível" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } finally {
        clearTimeout(timeout);
      }

      // Handle Asaas API error responses
      if (!asaasResponse.ok) {
        const statusCode = asaasResponse.status;
        console.error("Asaas API error:", statusCode, "for subscription:", asaasSubscriptionId);

        if (statusCode === 401 || statusCode === 403) {
          return new Response(
            JSON.stringify({ error: "Erro interno" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (statusCode === 404) {
          // Subscription not found on Asaas — still mark as cancelled locally
          console.warn("Subscription not found on Asaas, marking as cancelled locally");
        } else if (statusCode >= 500) {
          return new Response(
            JSON.stringify({ error: "Serviço de pagamento indisponível" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({ error: "Falha na comunicação com serviço de pagamento" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      console.warn(
        "Sem asaas_subscription_id e sem assinatura ativa na Asaas; cancelando só localmente para o usuário:",
        user.id
      );
    }

    // 4. Update status to "cancelled" in local database
    const { error: updateError } = await supabaseAdmin
      .from("asaas_subscriptions")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update subscription status:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Assinatura cancelada com sucesso",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Unexpected error in asaas-cancel-subscription:", error.message);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
