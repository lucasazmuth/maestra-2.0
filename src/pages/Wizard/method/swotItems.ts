// Itens canônicos do Diagnóstico SWOT (Metodologia v2).
// Transcrição literal de "Maestra Metodologia V2" §16/§17. Tudo determinístico, sem LLM.
//
// Os 20 itens internos têm IDs estáveis (1–20) que casam com as linhas da Matriz A
// (fraqueza→estratégia) e da Matriz C (força→estratégia) em ./matrices.ts. As 22 oportunidades
// casam com a Matriz B. As 13 ameaças NÃO geram estratégias (ficam no diagnóstico como radar).

export interface SwotInternalItem {
  id: number; // 1–20, casa com Matriz A / Matriz C
  label: string; // título curto do item
  question: string; // pergunta de autoavaliação (forte / melhorar / não se aplica)
}

export interface SwotExternalItem {
  id: number;
  label: string;
}

// 20 itens internos — para cada um o artista responde: forte / melhorar / não se aplica.
export const SWOT_INTERNAL: SwotInternalItem[] = [
  { id: 1, label: 'Talento / qualidade artística', question: 'Você tem domínio técnico e entrega artística consistente?' },
  { id: 2, label: 'Composição própria / repertório inédito', question: 'Você tem repertório autoral próprio (ou inédito de parceiros) em quantidade e qualidade pra sustentar shows e lançamentos?' },
  { id: 3, label: 'Produção musical', question: 'Suas gravações têm qualidade sonora à altura, produção, estúdio, mixagem, masterização?' },
  { id: 4, label: 'Show pronto e ensaiado', question: 'Você tem um show fechado, ensaiado e pronto pra subir no palco a qualquer momento, sem improviso?' },
  { id: 5, label: 'Presença de palco', question: 'Você sente que consegue prender o público no ao vivo com boa comunicação e conexão com a plateia?' },
  { id: 6, label: 'Agenda de shows', question: 'A sua agenda hoje (não a desejada) tem quantidade e regularidade?' },
  { id: 7, label: 'Gestão comercial / prospecção de shows', question: 'Tem alguém (você ou outra pessoa) prospectando contratações de forma estruturada, com metas e materiais de venda?' },
  { id: 8, label: 'Estrutura de equipe', question: 'Você tem pessoas cuidando dos bastidores da sua carreira, empresário, produtor executivo, assistente, alguém que organize o operacional?' },
  { id: 9, label: 'Profissionalismo / disciplina', question: 'Você cumpre prazos, honra combinados, mantém rotina de trabalho e está onde precisa estar?' },
  { id: 10, label: 'Planejamento e organização da carreira', question: 'Você tem um plano no papel com seus lançamentos fonográficos e shows estratégicos mapeados em um cronograma?' },
  { id: 11, label: 'Posicionamento estratégico', question: 'Você sabe o que diferencia o seu trabalho dos demais e pra qual público ele fala?' },
  { id: 12, label: 'Identidade visual / branding', question: 'O visual da sua marca (fotos, capas, paleta, tipografia) é coerente em tudo que aparece?' },
  { id: 13, label: 'Material de divulgação', question: 'Seus materiais (fotos, vídeo, press kit, release) estão atualizados e bem-feitos pra apresentar você a contratantes, imprensa e parceiros?' },
  { id: 14, label: 'Rede de contatos / network', question: 'Você tem pessoas do meio (artistas, produtores, contratantes, jornalistas) que conhecem seu trabalho e que pode acionar quando precisa?' },
  { id: 15, label: 'Gestão das redes sociais e presença digital', question: 'Sua presença digital tem frequência, qualidade e estratégia, incluindo seus canais próprios (site, mailing), independente de você gerir por conta própria ou com equipe?' },
  { id: 16, label: 'Assessoria de imprensa', question: 'Tem alguém (você ou profissional contratado) trabalhando o seu nome com jornalistas, veículos e curadores?' },
  { id: 17, label: 'Capacidade de investimento no projeto', question: 'Você (ou o projeto) tem capacidade de investir em gravação, divulgação, equipe e estrutura?' },
  { id: 18, label: 'Distribuição, edição e arrecadação', question: 'Você tem uma distribuidora (gravadora, selo, agregadora) para lançar suas músicas e editora e associação para recolher seus direitos?' },
  { id: 19, label: 'Conhecimento do mercado e do ecossistema musical', question: 'Você entende como o mercado da música funciona, contratos, direitos, plataformas, fluxos de receita, atores principais?' },
  { id: 20, label: 'Estrutura jurídica e formalização', question: 'A parte jurídica do seu projeto está em ordem, CNPJ, contratos formalizados, certidões em dia?' },
];

// 22 oportunidades — checkbox (sem percentuais). IDs casam com a Matriz B.
export const SWOT_OPPORTUNITIES: SwotExternalItem[] = [
  { id: 1, label: 'Editais' },
  { id: 2, label: 'Leis de incentivo' },
  { id: 3, label: 'Redes sociais' },
  { id: 4, label: 'Patrocínio e relacionamento com marcas' },
  { id: 5, label: 'Imprensa e mídia' },
  { id: 6, label: 'Produtores de festivais e eventos em geral' },
  { id: 7, label: 'Rádios' },
  { id: 8, label: 'YouTube' },
  { id: 9, label: 'Casas de show, teatros e espaços de bilheteria' },
  { id: 10, label: 'Shows corporativos' },
  { id: 11, label: 'Shows com órgãos públicos' },
  { id: 12, label: 'Financiamento coletivo / crowdfunding' },
  { id: 13, label: 'Feats e parcerias com outros artistas' },
  { id: 14, label: 'Plataformas de streaming / distribuidoras' },
  { id: 15, label: 'Merchandise e produtos licenciados' },
  { id: 16, label: 'Sincronização (trilhas para filmes, séries, publicidade)' },
  { id: 17, label: 'Podcasts' },
  { id: 18, label: 'Shows particulares (casamentos, eventos privados)' },
  { id: 19, label: 'Mercado de influenciadores / creators' },
  { id: 20, label: 'Cursos / aulas / materiais' },
  { id: 21, label: 'Mercado internacional' },
  { id: 22, label: 'Premiações' },
];

// 13 ameaças — checkbox (sem percentuais). Não geram estratégias (ficam no diagnóstico).
export const SWOT_THREATS: SwotExternalItem[] = [
  { id: 1, label: 'Alta concorrência no mercado' },
  { id: 2, label: 'Instabilidade política' },
  { id: 3, label: 'Crise econômica' },
  { id: 4, label: 'Altos custos logísticos' },
  { id: 5, label: 'Machismo / preconceito / etarismo / homofobia' },
  { id: 6, label: 'Escassez de empresários disponíveis' },
  { id: 7, label: 'Poucos espaços para artistas novos' },
  { id: 8, label: 'Mercado exige alto investimento inicial' },
  { id: 9, label: 'Cancelamento nas redes sociais' },
  { id: 10, label: 'Violência urbana / falta de segurança' },
  { id: 11, label: 'Baixa remuneração do streaming' },
  { id: 12, label: 'Informalidade do mercado' },
  { id: 13, label: 'Dependência das plataformas digitais' },
];

// Helpers de lookup por id.
export const internalLabel = (id: number): string => SWOT_INTERNAL.find((i) => i.id === id)?.label || '';
export const opportunityLabel = (id: number): string => SWOT_OPPORTUNITIES.find((o) => o.id === id)?.label || '';
export const threatLabel = (id: number): string => SWOT_THREATS.find((t) => t.id === id)?.label || '';
