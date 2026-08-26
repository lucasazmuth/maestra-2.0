import { supabase } from '../../../lib/supabase';

// Camada de dados do CRM de vendas da Maestra (tabelas `sales_*`).
//
// Atenção ao prefixo: `crm_*` é o CRM DO ARTISTA (contratantes, casas de show), preso a
// `artist_id` e reservado ao módulo Marketing do perfil. Este arquivo nunca toca nele.
//
// Não há edge function no meio: quem autoriza é a RLS, via `can_use_sales_crm()`. Um usuário
// sem o papel lê zero linhas e tem a escrita recusada pelo banco, não pela tela.

export interface Etapa {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  kind: 'open' | 'won' | 'lost';
  default_probability: number;
  color: string | null;
}

export interface Negocio {
  id: string;
  pipeline_id: string;
  stage_id: string;
  company_id: string | null;
  contact_id: string | null;
  linked_user_id: string | null;
  title: string;
  value: number;
  expected_close_date: string | null;
  priority: 'low' | 'medium' | 'high';
  source: string | null;
  status: 'open' | 'won' | 'lost';
  lost_reason: string | null;
  board_position: number;
  owner_id: string | null;
  archived: boolean;
  notes: string | null;
  tags: string[] | null;
}

export interface Funil {
  id: string;
  name: string;
}

/**
 * Lead prospectado pelo time (tabela `sales_contacts`).
 *
 * Estes NAO sao usuarios da Maestra: sao gente de fora que o time foi atras. Quem chega pelo
 * funil de ativacao e o caso oposto — la existe conta, e o negocio guarda `linked_user_id`.
 * Os dois viram negocio no mesmo quadro; o que muda e a origem.
 */
export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  /** Conta da Maestra por trás do lead. Nulo = prospecção externa; preenchido = veio do Inbound. */
  linked_user_id: string | null;
}

export interface MembroDoTime {
  user_id: string;
  email: string;
  role: string;
}

/** Funil padrão + suas etapas, na ordem das colunas. */
export const carregarQuadro = async (): Promise<{ funil: Funil; etapas: Etapa[] }> => {
  const { data: funil, error: erroFunil } = await supabase
    .from('sales_pipelines')
    .select('id, name')
    .eq('is_default', true)
    .maybeSingle();
  if (erroFunil) throw erroFunil;
  if (!funil) throw new Error('Nenhum funil padrão configurado.');

  const { data: etapas, error: erroEtapas } = await supabase
    .from('sales_stages')
    .select('id, pipeline_id, name, position, kind, default_probability, color')
    .eq('pipeline_id', funil.id)
    .order('position');
  if (erroEtapas) throw erroEtapas;

  return { funil: funil as Funil, etapas: (etapas || []) as Etapa[] };
};

export const carregarNegocios = async (pipelineId: string): Promise<Negocio[]> => {
  const { data, error } = await supabase
    .from('sales_deals')
    // Literal unico, sem concatenar: o `+` transforma o tipo em `string` e o parser de select do
    // supabase-js perde a inferencia, devolvendo GenericStringError em vez das colunas.
    .select('id, pipeline_id, stage_id, company_id, contact_id, linked_user_id, title, value, expected_close_date, priority, source, status, lost_reason, board_position, owner_id, archived, notes, tags')
    .eq('pipeline_id', pipelineId)
    .eq('archived', false)
    .order('board_position');
  if (error) throw error;
  return (data || []) as Negocio[];
};

/**
 * Posição de um cartão solto ENTRE dois vizinhos.
 *
 * A média entre as posições dos vizinhos deixa o arrasto escrever uma linha só, em vez de
 * renumerar a coluna inteira a cada movimento. Fora das pontas o cálculo é direto; nas pontas
 * abre-se espaço somando ou subtraindo um passo.
 */
export const posicaoEntre = (anterior?: number, proxima?: number): number => {
  if (anterior === undefined && proxima === undefined) return 0;
  if (anterior === undefined) return (proxima as number) - 1;
  if (proxima === undefined) return anterior + 1;
  return (anterior + proxima) / 2;
};

/**
 * Move o negócio de etapa e grava a passagem na linha do tempo.
 *
 * As duas escritas são deliberadas: `sales_deals` guarda ONDE o negócio está, e
 * `sales_activities` guarda QUE ele passou por ali. Sem a segunda não há como medir quanto tempo
 * um negócio levou em cada etapa, que é a leitura que um funil precisa dar.
 *
 * O `status` acompanha o `kind` da etapa de destino: é o `kind` que diz se a coluna significa
 * ganho ou perda, e deixar o status desalinhado da coluna faria o relatório divergir do quadro.
 */
export const moverNegocio = async (params: {
  negocio: Negocio;
  etapaDestino: Etapa;
  posicao: number;
  motivoDaPerda?: string;
}): Promise<void> => {
  const { negocio, etapaDestino, posicao, motivoDaPerda } = params;

  const patch: Record<string, unknown> = {
    stage_id: etapaDestino.id,
    board_position: posicao,
    status: etapaDestino.kind,
    updated_at: new Date().toISOString(),
  };
  // O banco recusa perda sem motivo (constraint sales_deals_perda_tem_motivo); sair da perda
  // precisa limpar o campo, senão o motivo antigo fica pendurado num negócio reaberto.
  if (etapaDestino.kind === 'lost') patch.lost_reason = motivoDaPerda ?? null;
  else patch.lost_reason = null;

  const { error } = await supabase.from('sales_deals').update(patch).eq('id', negocio.id);
  if (error) throw error;

  const { data: sessao } = await supabase.auth.getUser();
  await supabase.from('sales_activities').insert({
    deal_id: negocio.id,
    kind: 'stage_change',
    // Guarda o id da etapa, não o nome: renomear a coluna não pode reescrever o passado.
    metadata: { de: negocio.stage_id, para: etapaDestino.id },
    body: motivoDaPerda || null,
    owner_id: sessao?.user?.id ?? null,
    created_by: sessao?.user?.id ?? null,
  });
};

export interface DadosDoNegocio {
  title: string;
  value: number;
  contactId?: string | null;
  ownerId?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  /** Só faz sentido em negócio perdido; ignorado nos demais. */
  lostReason?: string | null;
}

export const criarNegocio = async (params: DadosDoNegocio & {
  pipelineId: string;
  etapa: Etapa;
  posicao: number;
  linkedUserId?: string | null;
  source?: string | null;
}): Promise<Negocio> => {
  const { data: sessao } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('sales_deals')
    .insert({
      pipeline_id: params.pipelineId,
      stage_id: params.etapa.id,
      title: params.title,
      value: params.value,
      probability: params.etapa.default_probability,
      board_position: params.posicao,
      status: params.etapa.kind,
      contact_id: params.contactId ?? null,
      linked_user_id: params.linkedUserId ?? null,
      source: params.source ?? null,
      notes: params.notes ?? null,
      tags: params.tags?.length ? params.tags : null,
      // O responsavel e escolhido na tela; sem escolha, fica com quem criou.
      owner_id: params.ownerId ?? sessao?.user?.id ?? null,
      created_by: sessao?.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Negocio;
};

export const editarNegocio = async (
  id: string,
  dados: DadosDoNegocio,
  /** Status atual do negócio. Decide se o motivo da perda entra no patch. */
  status?: Negocio['status']
): Promise<void> => {
  const patch: Record<string, unknown> = {
    title: dados.title,
    value: dados.value,
    contact_id: dados.contactId ?? null,
    owner_id: dados.ownerId ?? null,
    notes: dados.notes ?? null,
    tags: dados.tags?.length ? dados.tags : null,
    updated_at: new Date().toISOString(),
  };
  // O motivo só entra quando o negócio ESTÁ perdido. Mandar `null` aqui num negócio perdido
  // esbarraria na constraint `sales_deals_perda_tem_motivo` e derrubaria a edição inteira por
  // causa de um campo que a tela nem mostra nos outros casos.
  if (status === 'lost' && dados.lostReason?.trim()) patch.lost_reason = dados.lostReason.trim();

  const { error } = await supabase.from('sales_deals').update(patch).eq('id', id);
  if (error) throw error;
};

// ---- Leads -------------------------------------------------------------------------------

export const carregarLeads = async (): Promise<Lead[]> => {
  const { data, error } = await supabase
    .from('sales_contacts')
    .select('id, name, email, phone, notes, owner_id, created_by, created_at, linked_user_id')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Lead[];
};

export interface DadosDoLead {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export const criarLead = async (dados: DadosDoLead): Promise<Lead> => {
  const { data: sessao } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('sales_contacts')
    .insert({
      name: dados.name,
      email: dados.email || null,
      phone: dados.phone || null,
      notes: dados.notes || null,
      owner_id: sessao?.user?.id ?? null,
      created_by: sessao?.user?.id ?? null,
    })
    .select('id, name, email, phone, notes, owner_id, created_by, created_at, linked_user_id')
    .single();
  if (error) throw error;
  return data as Lead;
};

export const editarLead = async (id: string, dados: DadosDoLead): Promise<void> => {
  const { error } = await supabase
    .from('sales_contacts')
    .update({
      name: dados.name,
      email: dados.email || null,
      phone: dados.phone || null,
      notes: dados.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Time que pode ser responsavel por um negocio.
 *
 * Vem de uma funcao no banco porque `auth.users` nao e legivel pelo cliente: sem ela o campo de
 * responsavel mostraria uuid em vez de gente.
 */
export const carregarTime = async (): Promise<MembroDoTime[]> => {
  const { data, error } = await supabase.rpc('sales_team');
  if (error) throw error;
  return (data || []) as MembroDoTime[];
};

/**
 * Lead correspondente a uma conta da Maestra, criando se ainda nao existir.
 *
 * O negocio do Inbound tambem precisa aparecer na aba Leads: sem isso a pessoa fica so como um
 * `linked_user_id` dentro do negocio, e olhar a lista de leads depois nao diz quem do Inbound
 * avancou. O indice unico em `linked_user_id` garante uma linha por conta, entao clicar "Criar
 * negocio" duas vezes para a mesma pessoa reaproveita o lead em vez de duplicar.
 */
export const garantirLeadDaConta = async (conta: {
  id: string;
  nome: string | null;
  email: string;
}): Promise<Lead> => {
  const colunas = 'id, name, email, phone, notes, owner_id, created_by, created_at, linked_user_id';

  const { data: existente, error: erroBusca } = await supabase
    .from('sales_contacts')
    .select(colunas)
    .eq('linked_user_id', conta.id)
    .maybeSingle();
  if (erroBusca) throw erroBusca;
  if (existente) return existente as Lead;

  const { data: sessao } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('sales_contacts')
    .insert({
      name: conta.nome?.trim() || conta.email,
      email: conta.email,
      linked_user_id: conta.id,
      notes: 'Veio do funil de ativação (Inbound).',
      owner_id: sessao?.user?.id ?? null,
      created_by: sessao?.user?.id ?? null,
    })
    .select(colunas)
    .single();
  if (error) throw error;
  return data as Lead;
};

/**
 * Titulo sugerido ao abrir um negocio para um lead.
 *
 * Um titulo em branco faz o time digitar a mesma coisa toda vez, e cartoes sem padrao deixam o
 * quadro ilegivel de longe. A sugestao e ponto de partida: o campo continua editavel.
 */
export const tituloSugerido = (nomeDoLead: string): string =>
  nomeDoLead.trim() ? `Proposta para ${nomeDoLead.trim()}` : '';

/** Contagem e soma por coluna. É o que transforma o quadro numa leitura de funil. */
export const totalDaEtapa = (negocios: Negocio[], etapaId: string) => {
  const daEtapa = negocios.filter((n) => n.stage_id === etapaId);
  return {
    quantidade: daEtapa.length,
    valor: daEtapa.reduce((soma, n) => soma + Number(n.value || 0), 0),
  };
};

export const emReais = (valor: number): string =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
