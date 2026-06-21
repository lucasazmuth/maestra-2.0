import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Validation Helpers ─────────────────────────────────────────────────────

function validateName(name: string): string | null {
  if (!name || name.trim().length < 3) {
    return "Nome deve ter no mínimo 3 caracteres";
  }
  if (name.trim().length > 150) {
    return "Nome deve ter no máximo 150 caracteres";
  }
  return null;
}

function validateEmail(email: string): string | null {
  if (!email) return "Email é obrigatório";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Email em formato inválido";
  }
  return null;
}

function validateCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  // All same digits are invalid
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cpf[9])) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cpf[10])) return false;

  return true;
}

function validateCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14) return false;
  // All same digits are invalid
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  // First check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cnpj[12])) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cnpj[13])) return false;

  return true;
}

function validateCpfCnpj(cpfCnpj: string): string | null {
  if (!cpfCnpj) return "CPF/CNPJ é obrigatório";
  // Remove non-digit characters
  const digits = cpfCnpj.replace(/\D/g, "");

  if (digits.length === 11) {
    if (!validateCpf(digits)) {
      return "CPF com dígitos verificadores inválidos";
    }
  } else if (digits.length === 14) {
    if (!validateCnpj(digits)) {
      return "CNPJ com dígitos verificadores inválidos";
    }
  } else {
    return "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos";
  }
  return null;
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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
    // Get JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client to get authenticated user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input
    let body: { name?: string; email?: string; cpfCnpj?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Body inválido", field: "body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { name, email, cpfCnpj } = body;

    // Validate inputs
    const nameError = validateName(name || "");
    if (nameError) {
      return new Response(
        JSON.stringify({ error: nameError, field: "name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailError = validateEmail(email || "");
    if (emailError) {
      return new Response(
        JSON.stringify({ error: emailError, field: "email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cpfCnpjError = validateCpfCnpj(cpfCnpj || "");
    if (cpfCnpjError) {
      return new Response(
        JSON.stringify({ error: cpfCnpjError, field: "cpfCnpj" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for DB operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user already has an asaas_customer_id
    const { data: existingSubscription, error: dbError } = await supabaseAdmin
      .from("asaas_subscriptions")
      .select("asaas_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Erro interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If customer already exists, return the existing ID (idempotent)
    if (existingSubscription?.asaas_customer_id) {
      return new Response(
        JSON.stringify({ customerId: existingSubscription.asaas_customer_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Asaas API to create customer
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      console.error("ASAAS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Erro interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const asaasBaseUrl = Deno.env.get("ASAAS_API_URL") || "https://sandbox.asaas.com";
    const cpfCnpjDigits = (cpfCnpj || "").replace(/\D/g, "");

    let asaasResponse: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      asaasResponse = await fetch(`${asaasBaseUrl}/api/v3/customers`, {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (err: unknown) {
      const errorName = err instanceof Error ? err.name : "Unknown";
      if (errorName === "AbortError") {
        console.error("Asaas API timeout");
        return new Response(
          JSON.stringify({ error: "Falha na comunicação com serviço de pagamento" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Asaas API network error:", err);
      return new Response(
        JSON.stringify({ error: "Serviço de pagamento indisponível" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!asaasResponse.ok) {
      const errorBody = await asaasResponse.text();
      console.error(`Asaas API error (${asaasResponse.status}):`, errorBody);

      if (asaasResponse.status === 400) {
        return new Response(
          JSON.stringify({ error: "Dados inválidos para o gateway" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Falha na comunicação com serviço de pagamento" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const asaasCustomer = await asaasResponse.json();
    const customerId = asaasCustomer.id;

    if (!customerId) {
      console.error("Asaas API returned no customer ID:", asaasCustomer);
      return new Response(
        JSON.stringify({ error: "Erro interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert the customer ID in the database
    const { error: upsertError } = await supabaseAdmin
      .from("asaas_subscriptions")
      .upsert(
        {
          user_id: user.id,
          asaas_customer_id: customerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Database upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Erro interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ customerId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
