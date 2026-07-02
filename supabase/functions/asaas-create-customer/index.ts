import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function validateName(name: string): string | null {
  if (!name || name.trim().length < 3) return "Nome deve ter no mínimo 3 caracteres";
  if (name.trim().length > 150) return "Nome deve ter no máximo 150 caracteres";
  return null;
}

function validateEmail(email: string): string | null {
  if (!email) return "Email é obrigatório";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email inválido";
  return null;
}

function validateCpfCnpj(cpfCnpj: string): string | null {
  if (!cpfCnpj) return "CPF/CNPJ é obrigatório";
  const digits = cpfCnpj.replace(/\D/g, "");
  if (digits.length !== 11 && digits.length !== 14) return "CPF (11) ou CNPJ (14) dígitos";
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    // API da Asaas: produção https://api.asaas.com, sandbox https://api-sandbox.asaas.com.
    // O path é /v3 (SEM /api) — https://docs.asaas.com/reference. O host antigo
    // sandbox.asaas.com aceitava /api/v3, mas api.asaas.com (produção) responde 404.
    const asaasApiUrl = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com";

    if (!asaasApiKey) {
      return new Response(
        JSON.stringify({ error: "Erro interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse & validate
    const body = await req.json();
    const { name, email, cpfCnpj } = body;
    const nameErr = validateName(name || "");
    if (nameErr) return new Response(JSON.stringify({ error: nameErr }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const emailErr = validateEmail(email || "");
    if (emailErr) return new Response(JSON.stringify({ error: emailErr }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const cpfErr = validateCpfCnpj(cpfCnpj || "");
    if (cpfErr) return new Response(JSON.stringify({ error: cpfErr }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check existing record
    const { data: existingRecord } = await supabaseAdmin
      .from("asaas_subscriptions")
      .select("asaas_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // If we have a customer_id, verify it still exists on Asaas
    if (existingRecord?.asaas_customer_id) {
      const checkResponse = await fetch(
        `${asaasApiUrl}/v3/customers/${existingRecord.asaas_customer_id}`,
        { headers: { "access_token": asaasApiKey } }
      );

      if (checkResponse.ok) {
        const customerData = await checkResponse.json();
        // Customer exists and is not deleted
        if (!customerData.deleted) {
          console.log(`Reusing existing customer: ${existingRecord.asaas_customer_id}`);
          return new Response(
            JSON.stringify({ customerId: existingRecord.asaas_customer_id }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      // Customer was deleted or doesn't exist anymore — create a new one
      console.log(`Customer ${existingRecord.asaas_customer_id} no longer valid, creating new`);
    }

    // Create customer on Asaas
    const cpfCnpjDigits = (cpfCnpj || "").replace(/\D/g, "");
    let asaasResponse: Response;
    try {
      asaasResponse = await fetch(`${asaasApiUrl}/v3/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": asaasApiKey,
        },
        body: JSON.stringify({
          name: (name || "").trim(),
          email: (email || "").trim(),
          cpfCnpj: cpfCnpjDigits,
        }),
      });
    } catch (err: any) {
      console.error("Asaas network error:", err.message);
      return new Response(
        JSON.stringify({ error: "Serviço de pagamento indisponível" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!asaasResponse.ok) {
      const errorBody = await asaasResponse.text();
      console.error(`Asaas error (${asaasResponse.status}):`, errorBody);
      return new Response(
        JSON.stringify({ error: "Falha ao criar cliente" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const asaasCustomer = await asaasResponse.json();
    const customerId = asaasCustomer.id;

    // Upsert in DB (update customer_id, clear old subscription data)
    const { error: upsertError } = await supabaseAdmin
      .from("asaas_subscriptions")
      .upsert(
        {
          user_id: user.id,
          asaas_customer_id: customerId,
          asaas_subscription_id: existingRecord ? null : undefined,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("DB error:", upsertError);
    }

    console.log(`Customer created: ${customerId}`);
    return new Response(
      JSON.stringify({ customerId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unexpected error:", err.message);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
