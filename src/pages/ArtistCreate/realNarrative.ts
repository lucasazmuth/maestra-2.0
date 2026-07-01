// Narrativa determinística por dimensão ("O QUE ISSO REVELA") do diagnóstico REAL.
// Sem IA: cada bloco é escolhido a partir dos dados reais do motor V3 (boletim, dimTopIcon,
// revenue, engagement, inputs). Reproduz o tom/lógica do PDF de exemplo. Reusado pela tela e pelo PDF.
import { fmtNum, fmtPct, type DimKey } from './realCopy';

export interface Para { lead: string; body: string }
export interface DimNarrative { headline: string; paras: Para[] }

// Junta nomes com "e" (["o Spotify","o YouTube"] → "o Spotify e o YouTube").
const joinE = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;

// Canais de alcance (R): rótulo amigável + "frente" correspondente, na ordem dos componentes do motor.
const R_CHANNEL = {
  listeners: { name: 'o Spotify', front: 'no streaming' },
  socialFollowers: { name: 'as redes sociais', front: 'nas redes' },
  videoViews: { name: 'o YouTube', front: 'no vídeo' },
} as const;

// Fontes de receita (E) — mesmos rótulos da pizza de composição.
const SRC_LABELS: Record<string, string> = {
  shows: 'shows', streaming: 'streaming', direitos: 'direitos', publi: 'publicidade',
  aulas: 'aulas', editais: 'editais', venda: 'venda / merch', outros: 'outros',
};

const NET_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };

const money = (n: number) => `R$ ${fmtNum(Math.abs(Math.round(n)))}`;

// ── Reach ────────────────────────────────────────────────────────────────────
function reach(ri: any): DimNarrative {
  const high = !!ri.pattern?.r;
  const top = !!ri.dimTopIcon?.r;
  const headline = top ? 'Seu alcance digital é Top Tier.' : high ? 'Seu alcance digital acende.' : 'Seu alcance digital ainda está em construção.';
  const paras: Para[] = [];

  paras.push(high
    ? { lead: 'Sua música chega a gente além da sua bolha.', body: 'Seu trabalho se reflete no streaming, nas redes e no vídeo, e alcança quem ainda não te conhecia.' }
    : { lead: 'Seu alcance digital ainda está abaixo do típico do mercado.', body: 'É o ponto de partida de quem quer crescer, e costuma ser a primeira frente a destravar.' });

  // Mix de canais: rankeia os componentes de R pelo z e nomeia o(s) que puxam o alcance.
  const comps: any[] = Array.isArray(ri.components?.r) ? ri.components.r : [];
  const ranked = comps
    .filter((c) => !c.absent && c.z != null && (R_CHANNEL as any)[c.key])
    .sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
  const strong = ranked.filter((c) => c.high);
  const lead = strong.length ? strong : ranked.slice(0, 1);
  if (lead.length) {
    const names = lead.slice(0, 2).map((c) => (R_CHANNEL as any)[c.key].name as string);
    const fronts = lead.slice(0, 2).map((c) => (R_CHANNEL as any)[c.key].front as string);
    const verb = names.length > 1 ? 'puxam' : 'puxa';
    paras.push({
      lead: `${joinE(names).replace(/^o /, 'O ').replace(/^as /, 'As ')} ${verb} o seu alcance.`,
      body: `A força está concentrada ${joinE(fronts)}. Vale observar se as outras frentes acompanham esse tamanho ou se há espaço para equilibrar a presença.`,
    });
  }
  return { headline, paras: paras.slice(0, 3) };
}

// ── Earnings ─────────────────────────────────────────────────────────────────
function earnings(ri: any): DimNarrative {
  const high = !!ri.pattern?.e;
  const top = !!ri.dimTopIcon?.e;
  const rev = ri.revenue || {};
  const inputs = ri.inputs || {};
  const headline = top ? 'Sua receita é Top Tier.' : high ? 'A receita acende.' : 'Sua receita ainda não se sustenta.';
  const paras: Para[] = [];

  paras.push(high
    ? { lead: 'Sua carreira já fatura acima do que o mercado considera consolidado.', body: 'A música paga as contas, e isso te coloca à frente de boa parte dos artistas.' }
    : { lead: 'A música ainda não paga as contas sozinha.', body: 'Isso é mais comum do que parece e tem solução estratégica: dá para construir receita com método.' });

  // Diversificação: conta as fontes com valor > 0 (shows + fontes fora-shows).
  const srcs: { label: string; value: number }[] = [];
  if (Number(rev.shows) > 0) srcs.push({ label: SRC_LABELS.shows, value: Number(rev.shows) });
  Object.entries(rev.sources || {}).forEach(([k, v]) => { if (Number(v) > 0) srcs.push({ label: SRC_LABELS[k] || k, value: Number(v) }); });
  srcs.sort((a, b) => b.value - a.value);
  if (srcs.length >= 2) {
    const names = srcs.slice(0, 3).map((s) => s.label);
    paras.push({ lead: 'Sua receita tem mais de uma perna.', body: `${joinE(names)} se dividem o faturamento. Ter mais de uma fonte é o que dá estabilidade quando uma delas oscila.`.replace(/^\w/, (c) => c.toUpperCase()) });
  } else if (srcs.length === 1) {
    paras.push({ lead: 'Sua receita depende de uma fonte só.', body: `Hoje o faturamento vem de ${srcs[0].label}. Concentração é risco: diversificar as fontes é o que protege a carreira quando uma delas oscila.` });
  }

  // Saúde financeira (12m): faturamento bruto anual × investimento informado → saldo.
  const fat = Math.round(Number(rev.total ?? 0) * 12);
  const inv = Math.round(Number(inputs.investimento ?? 0));
  if (fat > 0 || inv > 0) {
    const saldo = fat - inv;
    paras.push(saldo >= 0
      ? { lead: 'A música se paga, e sobra.', body: `Em 12 meses você faturou ${money(fat)} e investiu ${money(inv)}. O saldo é positivo: a carreira devolve mais do que consome.` }
      : { lead: 'Você ainda investe mais do que a música devolve.', body: `Em 12 meses foram ${money(fat)} de faturamento e ${money(inv)} de investimento. Saldo negativo é comum em fase de construção, mas precisa de um plano para virar.` });
  }
  return { headline, paras: paras.slice(0, 3) };
}

// ── Audience ─────────────────────────────────────────────────────────────────
function audience(ri: any): DimNarrative {
  const high = !!ri.pattern?.a;
  const top = !!ri.dimTopIcon?.a;
  const inputs = ri.inputs || {};
  const shows = Number(inputs.showsPerMonth ?? 0);
  const headline = top ? 'Sua audiência real é Top Tier.' : high ? 'Sua audiência real acende.' : 'Sua audiência real ainda está em construção.';
  const paras: Para[] = [];

  paras.push(high
    ? { lead: 'Você tem público de verdade.', body: 'Gente que aparece, compra ingresso e segue a música. Isso é difícil de construir e vale muito.' }
    : { lead: 'Você ainda não tem público presencial em escala.', body: 'É a frente que se constrói no palco e no vínculo direto com quem ouve, e a que mais diferencia uma carreira que dura.' });

  if (shows < 4) {
    paras.push({ lead: 'Você quase não está no palco.', body: 'A agenda de shows está rarefeita. O ao vivo é onde a audiência real se constrói e se prova, e hoje essa frente precisa entrar em desenvolvimento.' });
  } else {
    paras.push({ lead: 'Você está no palco com frequência.', body: 'Uma agenda ativa é o motor da audiência real: cada show constrói público que volta e traz gente nova.' });
  }

  // Engajamento: nomeia a rede acima do corte (ou aponta que todas estão abaixo).
  const eng = ri.engagement || {};
  const above = (['instagram', 'tiktok', 'youtube'] as const).find((k) => eng[k]?.above);
  const anyData = (['instagram', 'tiktok', 'youtube'] as const).some((k) => eng[k]);
  if (above) {
    paras.push({ lead: `Seu público engaja no ${NET_LABEL[above]}.`, body: `No ${NET_LABEL[above]}, sua taxa de engajamento (${fmtPct(eng[above].value)}) está acima da média. Quem te acompanha presta atenção, comenta e compartilha, e seguidor que engaja vale mais que seguidor que só existe no número.` });
  } else if (anyData) {
    paras.push({ lead: 'Seu engajamento ainda está abaixo do corte.', body: 'Alcance sem engajamento é audiência passiva. Estimular resposta (comentário, compartilhamento, presença) é o que transforma número em público de verdade.' });
  }
  return { headline, paras: paras.slice(0, 3) };
}

// ── Legitimacy ───────────────────────────────────────────────────────────────
function legitimacy(ri: any): DimNarrative {
  const high = !!ri.pattern?.l;
  const top = !!ri.dimTopIcon?.l;
  const inputs = ri.inputs || {};
  const headline = top ? 'Parabéns: sua legitimação é Top Tier.' : high ? 'Sua legitimação acende.' : 'Sua legitimação ainda está em construção.';
  const paras: Para[] = [];

  paras.push(top
    ? { lead: 'Você está no topo absoluto desta dimensão.', body: 'Um patamar que pouquíssimos artistas alcançam: o setor te reconhece por vários ângulos ao mesmo tempo, prêmios, imprensa, playlists e rádio.' }
    : high
      ? { lead: 'O setor já reconhece o seu trabalho.', body: 'Prêmios e imprensa validam o que você faz, um capital que abre portas que números sozinhos não abrem.' }
      : { lead: 'Seu trabalho ainda não foi chancelado pelo setor.', body: 'Prêmios e imprensa costumam vir com estratégia de posicionamento, não só com talento.' });

  // Imprensa: constância é o que diferencia legitimação sustentada.
  if (inputs.imprensaRepercussao && inputs.imprensaFrequencia === 'perene') {
    paras.push({ lead: 'Sua presença na mídia é constante.', body: 'Você aparece de forma perene, não só em momentos pontuais. Consistência é o que diferencia um artista que a imprensa acompanha de um que apareceu uma vez.' });
  } else if (inputs.imprensaRepercussao) {
    paras.push({ lead: 'Sua imprensa ainda é pontual.', body: 'Aparições concentradas em lançamentos viram legitimação sustentada quando ganham constância ao longo do ano.' });
  }

  // Chancela de plataforma (opcional): playlists editoriais e/ou rádio.
  const editorial = Number(inputs.editorialPlaylists ?? 0);
  const radio = Number(inputs.radioAirplay ?? 0) > 0;
  if (paras.length < 3 && (editorial > 0 || radio)) {
    const bits: string[] = [];
    if (editorial > 0) bits.push(`${editorial} ${editorial === 1 ? 'playlist editorial' : 'playlists editoriais'}`);
    if (radio) bits.push('execução em rádio');
    paras.push({ lead: 'Você tem chancela de plataforma.', body: `${joinE(bits).replace(/^\w/, (c) => c.toUpperCase())} colocam sua música em vitrines que o público confia.` });
  }
  return { headline, paras: paras.slice(0, 3) };
}

const BUILDERS: Record<DimKey, (ri: any) => DimNarrative> = { r: reach, e: earnings, a: audience, l: legitimacy };

// Ponto de entrada: narrativa "O QUE ISSO REVELA" da dimensão `dk` a partir do realIndex V3.
export const dimNarrative = (dk: DimKey, ri: any): DimNarrative => BUILDERS[dk](ri);

// ── Copy estática (verbatim do PDF de exemplo) ──────────────────────────────────
export const METODOLOGIA = {
  title: 'Como nasce o seu diagnóstico',
  intro: [
    'O Índice REAL foi criado por Anita Carvalho, a partir de mais de 30 anos cuidando de carreiras na música e de uma pesquisa de doutorado dedicada a entender o que realmente move uma carreira artística.',
    'No centro dessa pesquisa está um trabalho raro: a análise de 313 planejamentos estratégicos de artistas reais, com mais de 17 mil trechos catalogados e estudados. Em vez de partir de teoria, o REAL partiu da prática.',
    'A percepção que organiza tudo é simples: talento quase nunca é o que falta. O que falta é clareza sobre onde a carreira está e o que ela precisa para crescer.',
  ],
  dims: [
    { l: 'R', t: 'Reach · Alcance', d: 'O quanto a música alcança gente no digital: streaming, redes e vídeo. É o tamanho da presença online, a porta de entrada de quem ainda não conhece o trabalho.' },
    { l: 'E', t: 'Earnings · Receita', d: 'O quanto a carreira fatura com música. Não é sobre riqueza, é sobre sustentabilidade: uma carreira que se paga é uma carreira que pode durar.' },
    { l: 'A', t: 'Audience · Público real', d: 'O público que aparece, que paga ingresso, que se conecta de verdade. É diferente de alcance: alcance é quanta gente vê, audiência é quanta gente fica.' },
    { l: 'L', t: 'Legitimacy · Legitimação', d: 'O reconhecimento do setor: imprensa, prêmios, presença nas plataformas e no rádio. É a validação que abre portas que números sozinhos não abrem.' },
  ],
  outro: 'Cada dimensão é lida a partir de dados reais. Nenhuma delas vale mais que a outra: o que importa é como se combinam na carreira, hoje. Esse retrato não é um julgamento. É um ponto de partida.',
};

export const QUEM_ASSINA = {
  name: 'Anita Carvalho',
  role: 'Criadora do Índice REAL · Fundadora da Maestra Manager',
  paras: [
    'Anita Carvalho é empresária artística, consultora e pesquisadora do mercado da música, com foco em gestão de carreiras. Doutoranda em Economia Criativa pela ESPM, atua há mais de 30 anos no setor.',
    'Sócia da Música & Mídia Produções, está atualmente à frente das carreiras de Fafá de Belém, Karinah, Bangalafumenga, Loulou Gilberto e Yassir Chediak. Ao longo da trajetória, esteve à frente das carreiras de Beth Carvalho, Baby do Brasil e Mariene de Castro, e colaborou com nomes como Ivan Lins, Barão Vermelho e Jorge Aragão.',
    'É autora da Pesquisa de Empresariamento Artístico, estudo longitudinal publicado desde 2017, hoje em sua quinta edição, e de artigos e publicações nacionais e internacionais sobre o setor. Já atendeu mais de 300 artistas em planejamento estratégico de carreira.',
  ],
  highlight: 'O Índice REAL nasce dessa trajetória: a prática de mercado encontrando o rigor da pesquisa.',
};
