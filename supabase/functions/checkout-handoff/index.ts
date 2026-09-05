import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// REPASSE PARA O CHECKOUT DA WEB, JÁ AUTENTICADO.
//
// O app não vende: quem vai pagar sai para o navegador. Sem isto, a pessoa cai numa tela de
// login já estando logada no aplicativo — e digitar senha no meio de uma compra é onde a maior
// parte desiste.
//
// COMO: a function gera um link mágico de uso único para o e-mail DA PRÓPRIA SESSÃO e devolve a
// URL. O navegador abre, o Supabase troca o token por uma sessão e redireciona para a página de
// destino. Nada de token da sessão do app na URL: link em barra de endereço vaza por histórico,
// por referrer e por qualquer app que "melhore" o link antes de abrir.
//
// O e-mail NUNCA vem do corpo do pedido. Ele sai do JWT — senão isto vira uma máquina de gerar
// acesso à conta alheia.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const SITE = Deno.env.get('SITE_URL') ?? 'https://www.maestramanager.com'

/** Os destinos permitidos, resolvidos AQUI. O cliente escolhe o nome, nunca a URL. */
const destinos = {
  assinatura: () => `${SITE}/assinatura`,
  desbloqueio: (artistId: string) => `${SITE}/artists/${artistId}/desbloquear`,
} as const

const ehUuid = (v: unknown): v is string =>
  typeof v === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const autorizacao = req.headers.get('Authorization')
    if (!autorizacao) return json({ error: 'Não autorizado' }, 401)

    const comOUsuario = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: autorizacao } } },
    )

    const { data: { user }, error: erroDeAuth } = await comOUsuario.auth.getUser()
    if (erroDeAuth || !user) return json({ error: 'Não autorizado' }, 401)
    if (!user.email) return json({ error: 'Esta conta não tem e-mail para o repasse.' }, 400)

    const corpo = await req.json().catch(() => ({}))
    const destino = corpo?.destino === 'desbloqueio' ? 'desbloqueio' : 'assinatura'

    let redirectTo: string
    if (destino === 'desbloqueio') {
      if (!ehUuid(corpo?.artistId)) return json({ error: 'Perfil inválido.' }, 400)
      // O perfil precisa ser DESTE usuário: sem esta conferência, o repasse levaria a pessoa a
      // uma página de pagamento de um perfil que não é dela.
      const { data: artista } = await comOUsuario
        .from('artists').select('id').eq('id', corpo.artistId).maybeSingle()
      if (!artista) return json({ error: 'Perfil não encontrado.' }, 404)
      redirectTo = destinos.desbloqueio(corpo.artistId)
    } else {
      redirectTo = destinos.assinatura()
    }

    const comServico = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // `generateLink` NÃO envia e-mail: ele devolve o link para nós abrirmos. O tempo de vida é o
    // do OTP do projeto, e o link morre no primeiro uso.
    const { data, error } = await comServico.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: { redirectTo },
    })

    const url = data?.properties?.action_link
    if (error || !url) {
      // Sem link mágico o app ainda abre o destino: a pessoa entra na conta à mão. Pior, mas
      // não é beco sem saída.
      console.error('[checkout-handoff] generateLink falhou:', error?.message)
      return json({ url: redirectTo, autenticado: false })
    }

    return json({ url, autenticado: true })
  } catch (e) {
    console.error('[checkout-handoff] erro:', e instanceof Error ? e.message : e)
    return json({ error: 'Não foi possível preparar o checkout.' }, 500)
  }
})
