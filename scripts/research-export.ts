/**
 * Exportação anonimizada da base para fins de pesquisa.
 *
 * ⚠️ ESTE SCRIPT NÃO PODE SER EXECUTADO SEM O PARECER DO COMITÊ DE ÉTICA EM PESQUISA (CEP) DA
 * ESPM. Ele existe no repositório especificado e DESLIGADO, conforme o Termo de Segregação: até o
 * parecer, a base é exclusivamente operacional (do produto), e nada dela vai para a pesquisa.
 *
 * Não há rota, tela, agendamento ou consulta em nenhum lugar do app que chame este arquivo. Rodar
 * exige, de propósito, uma ação manual com duas variáveis de ambiente e o número do parecer:
 *
 *   CEP_PARECER=<número> RESEARCH_EXPORT_CONFIRMO=sim npx tsx scripts/research-export.ts
 *
 * O que ele produz: um extrato SEM identificadores diretos, com variáveis contínuas convertidas em
 * faixas e combinações raras suprimidas. O mercado musical brasileiro é pequeno — "artista de
 * gênero X, no estado Y, com receita Z" pode identificar uma pessoa mesmo sem o nome. É por isso
 * que a agregação em faixas e a supressão de células raras não são preciosismo: são a diferença
 * entre dado anonimizado (art. 12 da LGPD) e dado pessoal disfarçado.
 *
 * As faixas abaixo são um ponto de partida. A especificação fina virá da Anita, e o advogado ainda
 * precisa validar a robustez da anonimização frente às orientações da ANPD sobre reversibilidade e
 * "meios razoáveis" — é uma das decisões marcadas em vermelho na minuta da política.
 */

import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

// ── Trava de execução ────────────────────────────────────────────────────────────────────────

const PARECER = process.env.CEP_PARECER;
const CONFIRMO = process.env.RESEARCH_EXPORT_CONFIRMO;

if (CONFIRMO !== 'sim' || !PARECER) {
  console.error(
    'Execução bloqueada.\n\n' +
    'Este script só pode rodar após a aprovação do Comitê de Ética em Pesquisa.\n' +
    'Informe CEP_PARECER=<número do parecer> e RESEARCH_EXPORT_CONFIRMO=sim.\n'
  );
  process.exit(1);
}

// ── Faixas (agregação) ───────────────────────────────────────────────────────────────────────
// Valores exatos identificam; faixas descrevem. Ajustar conforme a especificação da pesquisa.

const FAIXAS_RECEITA = [0, 1_000, 5_000, 11_250, 25_000, 50_000, 100_000];
const FAIXAS_PUBLICO = [0, 1_000, 10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000];
const FAIXAS_SHOWS = [0, 1, 4, 10, 20, 30];

/** Nº de células com a mesma combinação abaixo do qual a linha é suprimida. */
const K_ANONIMATO = 5;

const emFaixa = (valor: unknown, cortes: number[]): string | null => {
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  for (let i = cortes.length - 1; i >= 0; i--) {
    if (n >= cortes[i]) return i === cortes.length - 1 ? `${cortes[i]}+` : `${cortes[i]}-${cortes[i + 1] - 1}`;
  }
  return `<${cortes[0]}`;
};

// ── Extração ─────────────────────────────────────────────────────────────────────────────────

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');

  const db = createClient(url, key, { auth: { persistSession: false } });

  // Só quem AUTORIZOU explicitamente pela tela do TCLE. A ausência de resposta não é autorização,
  // e uma recusa anterior tem que prevalecer sobre qualquer aceite mais antigo — por isso a
  // leitura vem da view do consentimento vigente, não do histórico bruto.
  const { data: autorizados, error: consentError } = await db
    .from('user_consents_current')
    .select('user_id')
    .eq('kind', 'pesquisa')
    .eq('status', 'dado');
  if (consentError) throw consentError;

  const userIds = (autorizados || []).map((c) => c.user_id);
  if (!userIds.length) {
    console.log('Nenhum titular autorizou o uso dos dados em pesquisa. Nada a exportar.');
    return;
  }

  const { data: artistas, error } = await db
    .from('artists')
    .select('id, user_id, content, created_at')
    .in('user_id', userIds);
  if (error) throw error;

  // ID novo a cada execução, sem tabela de correspondência exportada: o extrato não volta para a
  // pessoa nem cruza com um extrato anterior.
  const salDaExecucao = randomUUID();
  const pseudonimo = (id: string) =>
    createHash('sha256').update(`${salDaExecucao}:${id}`).digest('hex').slice(0, 16);

  const linhas = (artistas || []).map((a) => {
    const ri = (a.content as Record<string, any>)?.realIndex || {};
    const inputs = ri.inputs || {};
    return {
      caso: pseudonimo(a.id),
      // Sem nome, nome artístico, e-mail, IDs de plataforma ou URL de perfil. Nunca.
      uf: inputs.uf ?? null,
      generoMusical: inputs.genero ?? null,
      anoEntrada: a.created_at ? new Date(a.created_at).getFullYear() : null,
      receitaFaixa: emFaixa(ri.components?.e?.receitaEfetiva, FAIXAS_RECEITA),
      ouvintesFaixa: emFaixa(inputs.spotifyListeners, FAIXAS_PUBLICO),
      seguidoresFaixa: emFaixa(inputs.spotifyFollowers, FAIXAS_PUBLICO),
      showsFaixa: emFaixa(inputs.showsPerMonth, FAIXAS_SHOWS),
      pagantePct: inputs.pagantePct ?? null,
      perfil: ri.profile?.name ?? null,
      boletim: ri.boletim ?? null,
      padrao: ri.pattern ?? null,
    };
  });

  // Supressão de combinações raras (k-anonimato). Uma célula com uma ou duas pessoas volta a ser
  // identificável por quem conhece o meio, por mais que o nome tenha saído.
  const chave = (l: typeof linhas[number]) =>
    [l.uf, l.generoMusical, l.receitaFaixa, l.ouvintesFaixa].join('|');
  const frequencia = new Map<string, number>();
  linhas.forEach((l) => frequencia.set(chave(l), (frequencia.get(chave(l)) || 0) + 1));

  const publicaveis = linhas.filter((l) => (frequencia.get(chave(l)) || 0) >= K_ANONIMATO);
  const suprimidas = linhas.length - publicaveis.length;

  const arquivo = `research-export-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(arquivo, JSON.stringify({
    geradoEm: new Date().toISOString(),
    parecerCep: PARECER,
    kAnonimato: K_ANONIMATO,
    titularesAutorizados: userIds.length,
    casosPublicados: publicaveis.length,
    casosSuprimidos: suprimidas,
    casos: publicaveis,
  }, null, 2));

  // Toda execução fica registrada: quando, sob qual parecer, que recorte e quanto foi suprimido.
  await db.from('research_export_log').insert({
    parecer_cep: PARECER,
    titulares_autorizados: userIds.length,
    casos_publicados: publicaveis.length,
    casos_suprimidos: suprimidas,
    arquivo,
  });

  console.log(`Extrato gerado: ${arquivo}`);
  console.log(`  autorizados: ${userIds.length} | publicados: ${publicaveis.length} | suprimidos: ${suprimidas}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
