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
    // Validate method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    // Mesmo padrão do asaas-create-customer: base + /api/v3. O sandbox serve a API em /api/v3.
    const asaasApiUrl = Deno.env.get("ASAAS_API_URL") || "https://sandbox.asaas.com";

    if (!asaasApiKey) {
      console.error("ASAAS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Erro interno de configuração" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the user's JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { customerId, billingType, creditCard, creditCardHolderInfo, cycle } = body;

    if (!customerId || typeof customerId !== "string") {
      return new Response(
        JSON.stringify({ error: "customerId é obrigatório", field: "customerId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isCreditCard = billingType === "CREDIT_CARD";

    // 0. Trava anti-duplicidade: nunca cria uma segunda assinatura no Asaas.
    //    active → já é Pro; pending/overdue COM asaas_subscription_id → já existe assinatura
    //    (retomar o pagamento, não duplicar). Pending SEM sub_id é o estado normal de 1ª vez
    //    (criado pelo asaas-create-customer), então segue o fluxo.
    const { data: existingSub } = await supabaseAdmin
      .from("asaas_subscriptions")
      .select("status, asaas_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingSub?.status === "active") {
      return new Response(
        JSON.stringify({ alreadyActive: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (
      (existingSub?.status === "pending" || existingSub?.status === "overdue") &&
      existingSub?.asaas_subscription_id
    ) {
      return new Response(
        JSON.stringify({ resume: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch active plan from asaas_plan_config
    const { data: planConfig, error: planError } = await supabaseAdmin
      .from("asaas_plan_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (planError || !planConfig) {
      console.error("Error fetching plan config:", planError);
      return new Response(
        JSON.stringify({ error: "Plano ativo não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1b. Resolve cycle + value. Anual usa cycle YEARLY + annual_value; default é mensal.
    const isAnnual = cycle === "YEARLY";
    if (isAnnual && !(planConfig.annual_enabled && Number(planConfig.annual_value) > 0)) {
      return new Response(
        JSON.stringify({ error: "Plano anual indisponível no momento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const asaasCycle = isAnnual ? "YEARLY" : "MONTHLY";
    const planValue = isAnnual ? Number(planConfig.annual_value) : Number(planConfig.monthly_value);

    // 2. Calculate nextDueDate (today's date in YYYY-MM-DD format)
    const today = new Date();
    const nextDueDate = today.toISOString().split("T")[0];

    // 3. Build subscription payload based on billing type
    const subscriptionPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: isCreditCard ? "CREDIT_CARD" : "PIX",
      cycle: asaasCycle,
      value: planValue,
      nextDueDate: nextDueDate,
    };

    // For credit card, include card data and holder info
    if (isCreditCard) {
      if (!creditCard || !creditCardHolderInfo) {
        return new Response(
          JSON.stringify({ error: "Dados do cartão são obrigatórios para pagamento com cartão de crédito" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      subscriptionPayload.creditCard = {
        holderName: creditCard.holderName,
        number: creditCard.number,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv,
      };
      subscriptionPayload.creditCardHolderInfo = {
        name: creditCardHolderInfo.name,
        email: creditCardHolderInfo.email || user.email,
        cpfCnpj: creditCardHolderInfo.cpfCnpj,
        postalCode: creditCardHolderInfo.postalCode,
        addressNumber: creditCardHolderInfo.addressNumber || "0",
        phone: creditCardHolderInfo.phone,
      };
    }

    // 4. Create subscription on Asaas API
    let subscriptionResponse: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      subscriptionResponse = await fetch(`${asaasApiUrl}/api/v3/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": asaasApiKey,
        },
        body: JSON.stringify(subscriptionPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      if (fetchError.name === "AbortError") {
        console.error("Asaas API timeout creating subscription");
        return new Response(
          JSON.stringify({ error: "Falha na comunicação com serviço de pagamento" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Asaas API network error:", fetchError.message);
      return new Response(
        JSON.stringify({ error: "Serviço de pagamento indisponível" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptionResponse.ok) {
      const errorBody = await subscriptionResponse.text();
      console.error("Asaas API error creating subscription:", subscriptionResponse.status, errorBody);

      if (subscriptionResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: "Erro de autenticação com serviço de pagamento" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (subscriptionResponse.status === 400) {
        // For credit card, try to parse decline reason from Asaas response
        let errorMessage = "Dados inválidos para o gateway de pagamento";
        if (isCreditCard) {
          try {
            const parsed = JSON.parse(errorBody);
            if (parsed.errors && parsed.errors.length > 0) {
              errorMessage = parsed.errors[0].description || errorMessage;
            }
          } catch {
            // Use default error message
          }
        }
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Falha na comunicação com serviço de pagamento" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resposta OK mas não-JSON (ex.: HTML de login se a URL/base estiver errada): trata sem quebrar.
    const rawText = await subscriptionResponse.text();
    let subscriptionData: any;
    try {
      subscriptionData = JSON.parse(rawText);
    } catch (_e) {
      console.error("Asaas OK mas corpo não-JSON:", subscriptionResponse.status, rawText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: "Resposta inesperada do gateway de pagamento" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const asaasSubscriptionId = subscriptionData.id;

    // 5. Handle response based on billing type
    if (isCreditCard) {
      // Credit card: immediate charge — subscription is active right away
      const { error: updateError } = await supabaseAdmin
        .from("asaas_subscriptions")
        .update({
          asaas_subscription_id: asaasSubscriptionId,
          status: "active",
          value: planValue,
          cycle: asaasCycle,
          billing_type: "CREDIT_CARD",
          started_at: new Date().toISOString(),
          next_due_date: new Date(nextDueDate).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error updating subscription in DB:", updateError);
      }

      return new Response(
        JSON.stringify({
          subscriptionId: asaasSubscriptionId,
          status: "active",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // PIX flow: store as pending and fetch QR Code
    // 6. Store subscription data in database
    const { error: updateError } = await supabaseAdmin
      .from("asaas_subscriptions")
      .update({
        asaas_subscription_id: asaasSubscriptionId,
        status: "pending",
        value: planValue,
        cycle: asaasCycle,
        billing_type: "PIX",
        started_at: new Date().toISOString(),
        next_due_date: new Date(nextDueDate).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating subscription in DB:", updateError);
      // Don't fail the request - subscription was created in Asaas
    }

    // 7. Fetch the first payment to get PIX QR Code data
    let pixData: { qrCode: string | null; copyPaste: string | null; expiresAt: string | null } = {
      qrCode: null,
      copyPaste: null,
      expiresAt: null,
    };

    try {
      // Wait a moment for Asaas to generate the first payment
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Fetch payments for this subscription
      const paymentsController = new AbortController();
      const paymentsTimeoutId = setTimeout(() => paymentsController.abort(), 30000);

      const paymentsResponse = await fetch(
        `${asaasApiUrl}/api/v3/payments?subscription=${asaasSubscriptionId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "access_token": asaasApiKey,
          },
          signal: paymentsController.signal,
        }
      );

      clearTimeout(paymentsTimeoutId);

      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();

        if (paymentsData.data && paymentsData.data.length > 0) {
          const firstPayment = paymentsData.data[0];
          const paymentId = firstPayment.id;

          // Fetch PIX QR Code for the first payment
          const pixController = new AbortController();
          const pixTimeoutId = setTimeout(() => pixController.abort(), 30000);

          const pixResponse = await fetch(
            `${asaasApiUrl}/api/v3/payments/${paymentId}/pixQrCode`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "access_token": asaasApiKey,
              },
              signal: pixController.signal,
            }
          );

          clearTimeout(pixTimeoutId);

          if (pixResponse.ok) {
            const pixResponseData = await pixResponse.json();
            pixData = {
              qrCode: pixResponseData.encodedImage || null,
              copyPaste: pixResponseData.payload || null,
              expiresAt: pixResponseData.expirationDate || null,
            };
          } else {
            console.warn("Failed to fetch PIX QR Code:", pixResponse.status);
          }
        } else {
          console.warn("No payments found for subscription:", asaasSubscriptionId);
        }
      } else {
        console.warn("Failed to fetch payments:", paymentsResponse.status);
      }
    } catch (pixError: any) {
      console.error("Error fetching PIX data:", pixError.message);
      // Don't fail the request - subscription was created successfully
    }

    // 8. Return response with subscription ID and PIX data
    return new Response(
      JSON.stringify({
        subscriptionId: asaasSubscriptionId,
        pixData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Unexpected error in asaas-create-subscription:", error?.message, error?.stack);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
