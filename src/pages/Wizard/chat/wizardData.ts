import type { ArtistGender, ArtistStage, RecognitionTag } from '../../../interfaces/maestra';

// Dados estáticos da metodologia Nyta (Roteiro de Perguntas + Etapa SWOT).
// Opções exibidas nos widgets e listas-base "seedáveis". Mantidos fora de widgets.tsx
// para o componente ficar enxuto e os dados, auditáveis frente aos documentos.

// ---- Flexão de gênero --------------------------------------------------------------------------

// Escolhe a forma certa conforme o gênero gramatical do artista. 'elu'/'neutro' usam a forma
// neutra (n). Quando não há forma neutra cadastrada, cai no masculino como base segura.
export const flex = (
  gender: ArtistGender | undefined,
  forms: { m: string; f: string; n?: string }
): string => {
  if (gender === 'ela') return forms.f;
  if (gender === 'elu' || gender === 'neutro') return forms.n ?? forms.m;
  return forms.m;
};

// ---- Abertura ----------------------------------------------------------------------------------

export const GENDER_OPTIONS: { value: ArtistGender; label: string }[] = [
  { value: 'ele', label: 'ele' },
  { value: 'ela', label: 'ela' },
  { value: 'elu', label: 'elu' },
  { value: 'neutro', label: 'tanto faz' },
];

export const STAGE_OPTIONS: { value: ArtistStage; label: string }[] = [
  { value: 'comecando', label: 'Tô começando agora' },
  { value: 'lancando', label: 'Já lanço e me apresento' },
  { value: 'vivendo', label: 'Já vivo (ou quase) da música' },
  { value: 'consolidada', label: 'Carreira consolidada' },
];

// ---- Mapa de referências (4 frentes, ordem crescente de dificuldade) ---------------------------

export const REFERENCE_FRONTS: {
  key: 'artisticas' | 'comunicacao' | 'gestao' | 'posicionamento';
  label: string;
  hint: string;
}[] = [
  {
    key: 'artisticas',
    label: 'Referências artísticas',
    hint: 'Quais artistas inspiram musicalmente o seu trabalho hoje?',
  },
  {
    key: 'comunicacao',
    label: 'Referências de comunicação',
    hint: 'Quais artistas você acha que se comunicam muito bem com o público?',
  },
  {
    key: 'gestao',
    label: 'Referências de gestão de carreira',
    hint: 'Quais artistas têm (ou tiveram) uma carreira muito bem administrada?',
  },
  {
    key: 'posicionamento',
    label: 'Referências de posicionamento',
    hint: 'Daqui a 3 anos, com quem você quer estar disputando espaço (festival, evento, playlist)?',
  },
];

// ---- Visão (fórmula por partes) ----------------------------------------------------------------

// Q1 — alcance geográfico (escolha única). `intl` marca a etiqueta `internacional`.
export const VISION_ONDE_OPTIONS: { value: string; label: string; intl?: boolean }[] = [
  { value: 'cidade', label: 'Na minha cidade e região' },
  { value: 'capitais', label: 'Nas principais capitais e centros urbanos' },
  { value: 'nacional', label: 'Nacionalmente' },
  { value: 'nicho_intl', label: 'Internacionalmente, dentro do meu nicho', intl: true },
  { value: 'internacional', label: 'Internacionalmente', intl: true },
];

// Q2 — fonte de reconhecimento (múltipla, máx 2). Cada opção carrega a etiqueta invisível
// (Roteiro §8). Os rótulos são neutros de gênero de propósito (não exigem flexão).
export const VISION_PORQUEM_OPTIONS: { label: string; tag: RecognitionTag }[] = [
  { label: 'Quando eu bombar no digital', tag: 'publico' },
  { label: 'Quando eu lotar meus shows', tag: 'publico' },
  { label: 'Quando me convidarem para festivais importantes', tag: 'mercado' },
  { label: 'Quando rolar um feat com um artista que eu admiro', tag: 'classe_artistica' },
  { label: 'Quando minha música for indicada a uma premiação', tag: 'critica_midia' },
  { label: 'Quando sair uma matéria sobre mim num veículo relevante', tag: 'critica_midia' },
  { label: 'Quando eu fechar um grande contrato com uma gravadora', tag: 'mercado' },
  { label: 'Quando minha música tocar na rádio', tag: 'mercado' },
  { label: 'Quando um artista popular regravar minha música', tag: 'classe_artistica' },
];

// Q3 — como o quê (substantivo, flexionado por gênero). Metodologia v2 adiciona
// Multiartista, Performer e Multiinstrumentista.
export const SUBSTANTIVO_OPTIONS: { m: string; f: string; n: string }[] = [
  { m: 'artista', f: 'artista', n: 'artista' },
  { m: 'cantor', f: 'cantora', n: 'cantore' },
  { m: 'compositor', f: 'compositora', n: 'compositore' },
  { m: 'instrumentista', f: 'instrumentista', n: 'instrumentista' },
  { m: 'multiinstrumentista', f: 'multiinstrumentista', n: 'multiinstrumentista' },
  { m: 'cantautor', f: 'cantautora', n: 'cantautore' },
  { m: 'intérprete', f: 'intérprete', n: 'intérprete' },
  { m: 'multiartista', f: 'multiartista', n: 'multiartista' },
  { m: 'performer', f: 'performer', n: 'performer' },
];

// Q12 (Missão) — tier financeiro (Metodologia v2). `label` é o que o artista vê; `suffix` é a
// parte financeira determinística da frase de missão; hobby não acrescenta nada.
export const MISSION_FINANCIAL_OPTIONS: {
  value: 'hobby' | 'projeto' | 'eu' | 'eu_parceiros';
  label: string;
  suffix: string;
}[] = [
  { value: 'hobby', label: 'É um hobby, o que vier é lucro', suffix: '' },
  {
    value: 'projeto',
    label: 'Quero que meu projeto alcance sustentabilidade financeira, mesmo que não gere receita pra mim',
    suffix: 'alcançando em paralelo sustentabilidade financeira para o projeto',
  },
  {
    value: 'eu',
    label: 'Tenho a expectativa de ter resultados financeiros relevantes para mim',
    suffix: 'gerando em paralelo resultados financeiros relevantes',
  },
  {
    value: 'eu_parceiros',
    label: 'Tenho a expectativa de gerar resultados para mim e para os parceiros envolvidos',
    suffix: 'gerando em paralelo resultados financeiros para o projeto e seus parceiros',
  },
];

export const missionFinancialSuffix = (tier?: string): string =>
  MISSION_FINANCIAL_OPTIONS.find((o) => o.value === tier)?.suffix || '';

// Q4 — atributo (texto livre com sugestão; lista-base de fallback — Roteiro §9.3).
export const ADJETIVO_SEEDS = [
  'autêntico',
  'original',
  'inovador',
  'visceral',
  'poético',
  'intenso',
  'sofisticado',
  'transgressor',
  'sensível',
  'popular',
];

// ---- Valores (chips seedados a partir da missão — Roteiro §7) -----------------------------------

export const VALUE_BASE = [
  'Autenticidade',
  'Respeito',
  'Diversidade',
  'Profissionalismo',
  'Coragem',
  'Afeto',
  'Liberdade',
  'Excelência',
  'Coletividade',
  'Inovação',
];

// Semeia valores a partir de palavras-chave da entrega da missão (sem interrogar o artista).
const VALUE_SEED_MAP: { rx: RegExp; values: string[] }[] = [
  { rx: /acolh|afeto|carinho|cuidado|amor/i, values: ['Afeto', 'Acolhimento'] },
  { rx: /verdade|honest|autent|raiz/i, values: ['Autenticidade', 'Verdade'] },
  { rx: /coletiv|comunidade|junto|pertenc/i, values: ['Coletividade', 'Comunidade'] },
  { rx: /repres|divers|inclus|periferia|preto|negr|lgbt/i, values: ['Diversidade', 'Representatividade'] },
  { rx: /liberdade|livre|independ/i, values: ['Liberdade', 'Independência'] },
  { rx: /reflex|consci|crítica|denúncia|política/i, values: ['Consciência', 'Coragem'] },
  { rx: /alegria|festa|dança|energia/i, values: ['Alegria', 'Energia'] },
];

export const seedValues = (entrega?: string): string[] => {
  const seeds: string[] = [];
  const txt = entrega || '';
  VALUE_SEED_MAP.forEach(({ rx, values }) => {
    if (rx.test(txt)) values.forEach((v) => seeds.push(v));
  });
  const seen = new Set<string>();
  return [...seeds, ...VALUE_BASE].filter((v) => {
    const k = v.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// ---- SWOT — chips de complemento (Doc 4) -------------------------------------------------------
// `pct` = % do corpus dos 313 planos. Exibido só em oportunidades/ameaças (âncora de realidade);
// nas forças/fraquezas a % fica interna (não exibir) — Doc 4 §7.3.

export const SWOT_FORCAS_CHIPS: { label: string; pct: number }[] = [
  { label: 'Rede de contatos / network', pct: 71 },
  { label: 'Talento / qualidade artística', pct: 49 },
  { label: 'Composição própria / repertório autoral', pct: 45 },
  { label: 'Presença digital ativa (redes, streaming)', pct: 33 },
  { label: 'Produção musical (produtor, estúdio)', pct: 28 },
  { label: 'Capacidade de investimento no projeto', pct: 27 },
  { label: 'Material de divulgação pronto (foto, vídeo, press kit)', pct: 23 },
  { label: 'Criatividade / originalidade', pct: 20 },
  { label: 'Equipe estruturada', pct: 18 },
  { label: 'Presença de palco', pct: 16 },
  { label: 'Show pronto e ensaiado', pct: 15 },
  { label: 'Profissionalismo / disciplina', pct: 14 },
  { label: 'Assessoria de imprensa', pct: 11 },
  { label: 'Identidade visual / branding', pct: 10 },
  { label: 'Agenda de shows ativa', pct: 3 },
];

export const SWOT_FRAQUEZAS_CHIPS: { label: string; pct: number }[] = [
  { label: 'Gestão das redes sociais', pct: 55 },
  { label: 'Material de apresentação desatualizado ou ausente', pct: 48 },
  { label: 'Ausência de empresário / gestor de carreira', pct: 47 },
  { label: 'Prospecção comercial / venda de shows', pct: 46 },
  { label: 'Baixa capacidade de investimento', pct: 44 },
  { label: 'Formalização da empresa / CNPJ / contratos', pct: 37 },
  { label: 'Identidade visual / branding', pct: 34 },
  { label: 'Editora / gestão de direitos autorais', pct: 32 },
  { label: 'Assessoria de imprensa', pct: 31 },
  { label: 'Distribuidora digital', pct: 22 },
  { label: 'Programação de lançamentos', pct: 20 },
  { label: 'Base de fãs pequena', pct: 17 },
  { label: 'Show não está pronto', pct: 16 },
  { label: 'Marketing digital / tráfego pago', pct: 6 },
];

export const SWOT_OPORTUNIDADES_CHIPS: { label: string; pct: number }[] = [
  { label: 'Editais e leis de incentivo', pct: 85 },
  { label: 'Redes sociais', pct: 84 },
  { label: 'Patrocínio e marcas', pct: 77 },
  { label: 'Imprensa e mídia', pct: 75 },
  { label: 'Festivais', pct: 71 },
  { label: 'Rádios', pct: 64 },
  { label: 'YouTube', pct: 62 },
  { label: 'Casas de show', pct: 59 },
  { label: 'Shows corporativos e órgãos públicos', pct: 54 },
  { label: 'Financiamento coletivo / crowdfunding', pct: 37 },
  { label: 'Feats e parcerias com outros artistas', pct: 37 },
  { label: 'Plataformas de streaming', pct: 35 },
  { label: 'Merchandise e produtos licenciados', pct: 34 },
  { label: 'Sincronização (trilhas para filmes, séries, publicidade)', pct: 29 },
  { label: 'Podcasts', pct: 27 },
  { label: 'Gravadoras e distribuidoras', pct: 25 },
  { label: 'Lives', pct: 24 },
  { label: 'Premiações', pct: 8 },
];

export const SWOT_AMEACAS_CHIPS: { label: string; pct: number }[] = [
  { label: 'Alta concorrência no mercado', pct: 74 },
  { label: 'Instabilidade política', pct: 30 },
  { label: 'Crise econômica', pct: 29 },
  { label: 'Altos custos logísticos', pct: 24 },
  { label: 'Machismo / preconceito / etarismo', pct: 17 },
  { label: 'Escassez de empresários disponíveis', pct: 16 },
  { label: 'Poucos espaços para artistas novos', pct: 15 },
  { label: 'Mercado exige alto investimento inicial', pct: 12 },
  { label: 'Cancelamento', pct: 11 },
  { label: 'Violência urbana / falta de segurança', pct: 10 },
  { label: 'Baixa remuneração do streaming', pct: 6 },
  { label: 'Informalidade do mercado', pct: 4 },
  { label: 'Dependência das plataformas digitais', pct: 2 },
];

// Deriva as etiquetas de reconhecimento da Visão (Q2 escolhidas + Q1 internacional).
export const deriveRecognitionTags = (
  porQuem: string[],
  ondeValue?: string
): RecognitionTag[] => {
  const tags = new Set<RecognitionTag>();
  porQuem.forEach((label) => {
    const opt = VISION_PORQUEM_OPTIONS.find((o) => o.label === label);
    if (opt) tags.add(opt.tag);
  });
  const onde = VISION_ONDE_OPTIONS.find((o) => o.value === ondeValue);
  if (onde?.intl) tags.add('internacional');
  return Array.from(tags);
};
