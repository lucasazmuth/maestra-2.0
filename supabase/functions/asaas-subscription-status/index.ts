import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with user's auth context
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // Query the user's subscription from the local database
    // RLS ensures user can only see their own records
    const { data: subscription, error: queryError } = await supabase
      .from('asaas_subscriptions')
      .select('status, asaas_customer_id, asaas_subscription_id, next_due_date, value, grace_period_ends_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (queryError) {
      console.error('Erro ao consultar assinatura:', queryError)
      return new Response(
        JSON.stringify({ error: 'Erro interno' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // If no subscription found, return 200 with status 'none'
    if (!subscription) {
      return new Response(
        JSON.stringify({
          status: 'none',
          asaasCustomerId: null,
          asaasSubscriptionId: null,
          nextDueDate: null,
          value: null,
          gracePeriodEndsAt: null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Return subscription data
    return new Response(
      JSON.stringify({
        status: subscription.status,
        asaasCustomerId: subscription.asaas_customer_id,
        asaasSubscriptionId: subscription.asaas_subscription_id,
        nextDueDate: subscription.next_due_date,
        value: subscription.value,
        gracePeriodEndsAt: subscription.grace_period_ends_at,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
