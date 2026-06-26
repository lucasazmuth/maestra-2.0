import { FC } from 'react';
import { nytaAvatar } from '../../../components/Icons/system';

// Identidade visual e verbal da Nyta — a inteligência da Maestra Manager.
// As falas são templadas (custo zero por turno) e seguem o tom de voz do método
// (Doc 1): direta com firmeza carinhosa, empoderadora, "a gente" com naturalidade.
// A IA gera só o conteúdo estratégico (visão/missão montadas, objetivos, estratégias).

// Nome de exibição global da assistente.
export const NYTA_NAME = 'Nyta';

// Avatar da Nyta: o rosto da assistente num círculo, com uma aura pulsante (vida de IA). Quando ela
// está processando (`state='thinking'`), a aura pulsa mais rápido.
export type NytaAvatarState = 'idle' | 'thinking';

export const NytaAvatar: FC<{ size?: number; state?: NytaAvatarState }> = ({ size = 32, state = 'idle' }) => (
  <span
    className={`nyta-avatar nyta-avatar--glow${state === 'thinking' ? ' nyta-avatar--thinking' : ''}`}
    style={{ width: size, height: size, minWidth: size, borderRadius: '50%', background: '#16141c', overflow: 'hidden' }}
    aria-hidden
  >
    <img src={nytaAvatar} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  </span>
);

// Sorteia uma variação para a fala não soar robótica.
export const pick = (variants: string[]): string =>
  variants[Math.floor(Math.random() * variants.length)];

export const SAY = {
  // --- Abertura (Metodologia v2, Q1) -----------------------------------------------------------
  greeting: (artist: string) => [
    `Prazer, eu sou a Nyta. Vou te ajudar a pensar estrategicamente o seu projeto de carreira, ${artist} — e a sair daqui com um plano organizado, construído por você.`,
    'Antes da gente começar, um combinado importante: o que a gente vai construir aqui é um plano de negócios, não um plano artístico. A sua música, o seu estilo, a sua identidade — isso é 100% seu, e eu não toco. O que a gente trabalha aqui é a estratégia em volta da sua arte: como ela circula, como ela sustenta você, como ela chega onde você quer.',
    'Eu sei que música carrega muita coisa que não cabe em planilha — sentido, vocação, afeto. Nada disso some. Só que pra essa coisa intangível continuar de pé, ela precisa de uma estrutura concreta por trás. E é essa estrutura que a gente vai montar juntos.',
    'Então te peço uma licença: deixa eu olhar pra sua carreira como um negócio junto com você? Funciona assim — eu pergunto, você responde, e a gente vai montando uma coisa de cada vez, no seu ritmo.',
  ],
  // Texto de apoio "Explique-me melhor" (Metodologia v2, Q1) — exibido sob demanda.
  explainMore: () => [
    'Deixa eu te contar por que isso vale a pena.',
    'Tem um ditado que diz que, no Japão, se planeja uma ferrovia por dois anos e se constrói em seis meses; no Brasil, faz-se o oposto. Os dois terminam — mas planejar é muito mais barato do que executar. Eficiência é isso: chegar no mesmo lugar gastando menos energia, menos dinheiro e menos retrabalho.',
    'E o que a maioria dos artistas não percebe é que carreira musical é um negócio — mesmo quando ninguém chama assim. Tem produto, tem cliente, tem custo, tem receita, tem concorrência. Você não abriria um restaurante sem um plano, certo? Tratar a sua carreira como negócio por algumas horas não te tira nada da arte. Pelo contrário: te dá clareza pra escolher onde investir o seu tempo e a sua grana — sem deixar de ser fiel ao que você faz.',
  ],
  recap: (done: string[], next: string) => [
    pick([
      `Que bom te ver de volta! A gente já tem ${done.join(', ')}. Seguimos de onde paramos: ${next}.`,
      `Voltamos! ${done.join(', ')} já estão guardados. Próximo passo: ${next}.`,
    ]),
  ],
  newPhase: (phase: number, label: string) => [
    `Novo ciclo desbloqueado: ${label} (fase ${phase}). Quem você é continua o mesmo. Vamos revisar objetivos, diagnóstico e estratégias pra essa nova etapa.`,
  ],
  askGender: () => [
    'Antes de tudo, como você prefere que eu te trate? Isso ajuda a minha fala a combinar com você.',
  ],
  askGenreMusical: () => [
    'Boa! Agora me conta: quais estilos definem a sua música? Pode marcar mais de um.',
  ],
  // Metodologia v2, Q2 — quando a Chartmetric já trouxe gênero(s), a Nyta só pede confirmação.
  askGenreConfirm: (genres: string) => [
    `Pelo que vimos, seus gêneros musicais são: ${genres}. Confirma? Se quiser, pode ajustar ou somar outros.`,
  ],
  askStage: () => [
    'Em que momento da carreira você está hoje? Quanto mais eu te entender, melhor eu te ajudo.',
  ],
  guidedIntro: () => [
    pick(['Fechado, vamos montar juntos. Te faço algumas perguntas rápidas:', 'Boa, eu te ajudo. Responde rapidinho:']),
  ],
  proposalReady: () => [
    pick([
      'Com base no que você me contou, montei isso aqui. Se gostar, é só usar. Se não, a gente refaz.',
      'Olha o que escrevi com as suas respostas. Pode usar, ou a gente refaz as perguntas.',
    ]),
  ],

  // --- Mapa de referências (Metodologia v2, Q5 — uma frente por vez) ----------------------------
  referencesIntro: (artist: string) => [
    `Pronto, ${artist}. Agora a gente começa o planejamento de verdade.`,
    'E a gente começa pelo básico: te situar. Antes de pensar pra onde você quer ir, vale olhar pra onde você está — e isso passa pelas suas referências. Quem inspira, quem dialoga, com quem você quer dividir espaço.',
    'Não tem resposta certa, e se uma pergunta não te servir, é só escrever "pular".',
  ],
  refArtisticas: () => [
    'Vamos começar pelas suas referências artísticas. Quais artistas inspiram musicalmente o seu trabalho hoje? (Pra gente começar a enxergar onde o seu som se encontra no mercado.)',
  ],
  refComunicacao: () => [
    'Agora me conta: quais artistas você acha que se comunicam muito bem com o público? (Pensa em quem tem tudo alinhado — a imagem combina com o som, o Instagram é interessante, a capa do álbum é incrível, manda super bem nas entrevistas…)',
  ],
  refGestao: () => [
    'Vamos para os bastidores: quais artistas você considera que têm (ou tiveram) uma carreira muito bem administrada? Na hora de responder, pense no "porquê". (Aqui não é sobre a música em si — é sobre as escolhas de carreira: como construíram e sustentaram o trabalho ao longo do tempo.)',
  ],
  refPosicionamento: () => [
    'Agora, uma referência que pode ser mais desafiadora: a de POSICIONAMENTO. Daqui a 3 anos, com quem você quer estar disputando espaço? Quando alguém for contratar um artista pra um festival, um evento ou uma playlist, entre quais nomes você quer que o seu apareça?',
    'Em outras palavras: quem serão seus concorrentes de mercado? Vamos pensar em três degraus — curto, médio e longo prazo.',
  ],

  // --- Visão (Metodologia v2, Q6–Q11) ----------------------------------------------------------
  // Antes do mapa de referências (que é exibido inline como um card separado).
  visionCityIntro: () => [
    'Parabéns! Você está indo muito bem!',
    'Aqui está o que produzimos até agora:',
  ],
  // Depois do mapa, levando até a pergunta de cidade/UF (que abre o card de cidade).
  visionCityAsk: () => [
    'Vamos em frente? Com seu mapa de referências pronto, a gente parte agora para os seus Fundamentos Estratégicos: visão, missão e valores. É a parte do plano que dá norte pra todo o resto — sem isso, qualquer estratégia depois vira tiro no escuro.',
    'Pensa assim: a visão é aonde você quer chegar — o lugar lá na frente, o posicionamento que você quer alcançar. A missão é por que você existe agora — o que sua carreira entrega pra quem te escuta e pra você, como artista. E os valores são os pilares inegociáveis — as coisas que você não abre mão pra chegar onde quer.',
    'Mas antes de pensar aonde você quer chegar, me diz: de onde você parte? Qual a sua cidade e estado?',
  ],
  visionOnde: () => [
    'Pensando de forma realista nos próximos 3 anos, até onde você quer que o seu trabalho chegue?',
  ],
  visionPorQuem: () => [
    'Agora a parte que mais define a sua visão: por quem você quer ser reconhecido(a)?',
    'E aqui eu não tô falando de público-alvo. Tô falando de uma coisa mais sutil: de onde você espera que venha a validação. Porque o reconhecimento numa carreira musical pode vir de quatro lugares diferentes — do público, da crítica e da mídia, do mercado, ou dos seus pares — e cada artista valoriza um desses lugares mais que os outros. Não é certo nem errado, é honestidade.',
    'Pra te ajudar a enxergar isso, eu mudo a pergunta: quando você vai saber que subiu um degrau na carreira? Que aquele clique aconteceu? Escolhe 1 ou 2 opções, as que mais traduzem o que você sente — e responde sem filtro.',
  ],
  // Reflexo da fonte de reconhecimento (Metodologia v2, Q8).
  visionPorQuemReflect: (fontes: string) => [
    `Entendido. Isso significa que você almeja o reconhecimento principalmente de: ${fontes}.`,
  ],
  visionSubstantivo: () => ['Continuando. E como você prefere ser chamado?'],
  visionAdjetivo: () => [
    'Qual característica você quer que venha junto desse nome? Qual palavra define o jeito do seu trabalho? Pode escolher uma sugestão ou escrever a sua.',
  ],
  // Metodologia v2, Q10: mostra a frase montada com as partes já coletadas; o artista completa o "que…".
  visionOQueFalam: (formulaPrefix: string) => [
    'Certo. Agora a parte mais importante: diante de tantas características que você carrega como artista, em quais vamos jogar luz? Aqui, a ideia é ser intencional quanto ao que você quer que falem de você. Vamos lá.',
    `Complete a frase: ${formulaPrefix}`,
  ],
  visionReview: () => [
    'Só um instante, montando isso… Então olha como ficou a sua visão. Faz sentido pra você, ou quer ajustar?',
  ],

  // --- Missão (Metodologia v2, Q12) ------------------------------------------------------------
  missionEntrega: (artist: string) => [
    `Boa, ${artist}. Sua visão tá no papel — e isso já é mais do que a maioria dos artistas chega a fazer na carreira inteira. Guarda essa frase, porque ela vai ser a sua bússola daqui pra frente.`,
    'Agora a gente vai pra missão. Se a visão é onde você quer chegar daqui a 3 anos, a missão é a sua razão de existir agora — o que essa carreira entrega pro mundo e o que ela tem que te devolver pra ficar de pé.',
    'Bom, vamos pensar a sua carreira como qualquer outro negócio por um instante. Todo negócio existe pra entregar alguma coisa pra alguém: um restaurante entrega comida pra quem tem fome, uma escola entrega conhecimento pra quem quer aprender. Com o seu projeto musical é igual: ele entrega algo, pra alguém.',
    'Pode ser entretenimento, memória afetiva, representatividade, reflexão, pista de dança. Não tem resposta certa, tem a sua, e quanto mais clara, melhor. A gente vai por partes.',
    'Primeiro, uma coisa só: o que você entrega, oferece ou proporciona?',
  ],
  missionParaQuem: () => [
    'Agora a segunda parte: e pra quem? Quem recebe isso que você entrega? Pensa num grupo definido pelo que ele busca, vive ou valoriza. Por exemplo: "jovens urbanos que celebram a vida", "quem busca esperança e mudança" ou "o grande público que quer sair da zona de conforto".',
  ],
  missionFinancial: () => [
    'Isso é lindo e verdadeiro. E agora eu preciso te lembrar de uma coisa que quase todo artista esquece nessa hora: isso também é um negócio.',
    'Pra sua missão se sustentar, ela precisa incluir o que essa carreira tem que gerar pra você. Qual dessas opções se aplica melhor pra você?',
  ],
  missionReview: () => [
    'Olha como ficou a sua missão. Faz sentido, ou quer ajustar?',
  ],

  // --- Valores (Metodologia v2, Q13) -----------------------------------------------------------
  valuesIntro: () => [
    'Agora os seus valores: os pilares que você não abre mão pra cumprir essa missão e chegar na sua visão. Escolha de 3 a 5 — lembrando que sua carreira é um negócio. Pode usar as sugestões ou escrever os seus.',
  ],

  // --- Objetivos (Nyta_Etapa_Objetivos_v2 §7) --------------------------------------------------
  objectivesIntro: () => [
    'Com a sua visão, missão e valores no lugar, chegou a hora dos objetivos — os alvos concretos que vão medir se a estratégia tá funcionando.',
    'Aqui eu já trabalhei pra você. A partir do que você me contou, cheguei numa lista de objetivos possíveis. Você escolhe os que vão pro plano — no máximo 5, pra manter foco. E se faltar algum, pode escrever.',
  ],

  // --- SWOT (Metodologia v2, Q15–Q17) ----------------------------------------------------------
  swotIntro: () => [
    'Pronto. Os fundamentos estratégicos estão fechados — visão, missão, valores e objetivos. Tudo isso junto é o alicerce do plano: sem ele, nenhuma estratégia tem consistência.',
    'Agora a gente sai do "quem você é e pra onde vai" e entra no "onde você está hoje". É hora da análise SWOT — uma ferramenta com quase 60 anos de uso que segue funcionando. Internamente, ela mapeia forças e fraquezas. Externamente, oportunidades e ameaças.',
    'A gente começa de dentro pra fora. E antes de pegar pesado nas fraquezas, deixa eu te dizer: fraqueza aqui não é fracasso, é ponto de melhoria. Nada do que aparecer vai sair daqui como julgamento.',
  ],
  swotInternalIntro: () => [
    'Funciona assim: em vez de te deixar olhando pra uma tela em branco, eu vou te apresentar uma lista de pontos que costumam pesar na carreira de qualquer artista — desde os mais técnicos até os mais sensíveis. Pra cada um, três respostas possíveis: é um ponto forte, preciso melhorar nisso, ou não se aplica ao meu caso.',
    'Responde rápido, sem ficar matutando. A primeira intuição costuma ser a mais honesta — e honestidade aqui é a matéria-prima do diagnóstico.',
  ],
  swotOportunidadesIntro: () => [
    'Pronto. O lado de dentro tá mapeado. Suas forças, o que precisa melhorar e o que não se aplica. Esse é o seu chão.',
    'Agora a gente sai de casa. O que existe lá fora, no mercado, na cena, no momento, que pode te ajudar a chegar onde você quer? E o que pode atrapalhar?',
    'Antes da gente começar a identificar suas oportunidades, uma coisa importante: oportunidade não é exclusividade sua. Ela existe pra qualquer artista, e o que muda é o que cada um faz com ela. E o que você consegue fazer depende justamente do interno, que a gente acabou de mapear.',
    'Da lista abaixo, escolha as oportunidades que se aplicam ao seu projeto. Pensa com calma nessa etapa: quanto mais oportunidades você considerar, mais o leque de estratégias vai se abrir lá na frente.',
  ],
  swotAmeacasIntro: () => [
    'Pronto. Oportunidades mapeadas. Agora a outra ponta: as ameaças.',
    'Ameaça é o que existe no ambiente em volta e atrapalha qualquer artista, não só você. Da lista abaixo, escolha as ameaças que se aplicam ao seu caso.',
  ],
  swotReady: () => [
    'Diagnóstico fechado. Dá uma olhada na sua Matriz SWOT. Tire o que não combina e acrescente o que faltar.',
  ],
  // Comentário sobre o balanço da SWOT (Metodologia v2 — forças+oportunidades vs fraquezas+ameaças).
  swotBalance: (favoravel: boolean) =>
    favoravel
      ? ['Pelo retrato, suas forças e oportunidades pesam mais do que as fraquezas e ameaças — é um cenário favorável pra avançar. Bora transformar isso em ação.']
      : ['Pelo retrato, hoje você tem mais a desenvolver do que a alavancar — e tá tudo bem, é justamente o que o plano vai endereçar. Vamos focar em virar esse jogo, um passo de cada vez.'],

  // --- Estratégias (Nyta_Etapa_Estrategias_v3 §11) ---------------------------------------------
  strategiesReady: () => [
    'Diagnóstico fechado. Agora a gente sai do que é e vai pro que fazer.',
    'Estratégia é o como. Não é onde você quer chegar (isso é objetivo). É a ação concreta que move você até lá: verbo no infinitivo, específica, exequível.',
    'Cruzei o que você marcou como fraqueza com o que enxerga como oportunidade e já criei algumas estratégias pra você. Dá uma olhada e me diz o que faz sentido manter, o que sai e o que falta.',
  ],
  // Nota sobre ameaças (Estrategias_v3 §6) — exibida ao fechar as estratégias.
  strategiesThreatNote: () => [
    'Suas ameaças não viram estratégias diretamente — são fatores externos que não dependem de você. Mas ficam no plano pra te lembrar de manter o radar ligado: anteceder o que pode atrapalhar é parte da estratégia, mesmo sem ação 1-pra-1.',
  ],

  // --- Priorização (Nyta_Matriz_Priorizacao_v2) ------------------------------------------------
  priorityIntro: () => [
    'Olha o tamanho dessa lista. É aqui que a maioria dos artistas se perde. Até agora, quase tudo que a gente conversou você já tinha na cabeça. Eu só te ajudei a organizar. Essas estratégias provavelmente não são novidade pra você: em algum momento já passaram pela sua cabeça. A novidade, o pulo do gato, começa agora: como priorizar?',
    'Aqui eu vou te pedir atenção total. É a hora de definir por onde começar.',
    'Vamos começar pensando: quais devem ser os critérios que vão nortear a sua priorização? Bom, se são essas estratégias que vão nos levar à visão e à missão, então o que a gente tem que olhar são os seus OBJETIVOS.',
    'A lógica é simples: cada estratégia contribui pra cada objetivo de um jeito diferente. Algumas empurram o digital com força. Outras puxam o financeiro. Outras servem mais pra mídia ou pra agenda de shows. O que a gente vai fazer agora é olhar estratégia por estratégia e ver quais delas mais atendem os SEUS objetivos. Não os do artista do lado, os seus.',
    'O método clássico é dar nota de 1 a 10 pra cada estratégia, medindo o impacto em cada objetivo. A soma no final diz quem vem primeiro. Funciona muito bem, mas dá um trabalhinho… Como você quer fazer essa parte?',
  ],
  // Respostas após a escolha de priorização (Metodologia v2, Etapa 6/7).
  priorityAiChosen: () => [
    'Beleza. Vou rodar essa priorização por você, baseada no que aprendi com mais de 300 planejamentos estratégicos reais de artistas brasileiros. Vou te trazer a ordem proposta. Você pode aceitar, mudar de posição ou substituir qualquer item. A palavra final é sempre sua.',
  ],
  priorityManualChosen: () => ['Combinado. Agora é com você.'],

  // --- Plano de Ação e fecho (Nyta_Etapa_Plano_de_Acao_v1) -------------------------------------
  scheduleSetupIntro: () => [
    'Para tudo um instantinho. Olha o que você acabou de fazer: começou essa conversa com um monte de coisa solta na cabeça e chegou num plano de verdade, com direção, propósito e uma ordem clara do que fazer primeiro.',
    'Último passo: transformar isso em rotina. Cada estratégia priorizada vira um plano de ação — um passo a passo de tarefas, na ordem certa. Pra eu já montar o cronograma pra você, me diz: quando você quer começar e em quanto tempo quer realizar esse plano?',
  ],
  scheduleReady: () => [
    'Pronto — montei o cronograma. Distribuí as tarefas pelo período que você escolheu, começando pelas estratégias mais prioritárias. As datas são uma sugestão: ajuste o que quiser, defina quem faz cada tarefa e siga no seu ritmo.',
  ],
  finalReady: (artist: string) => [
    `Plano de ${artist} pronto! Esse é o resumo de tudo. Ao confirmar, seu painel completo é liberado.`,
  ],

  // --- Genéricos -------------------------------------------------------------------------------
  preparing: () => [
    pick(['Deixa comigo, organizando isso pra você…', 'Só um instante, montando isso…']),
  ],
  nudgeWidget: () => [
    pick([
      'Anotado! Mas aqui preciso que você escolha uma das opções acima.',
      'Entendi! Só que neste passo a resposta é pelas opções acima.',
    ]),
  ],
};

// Perguntas-guia do "Me ajuda a responder" por etapa de texto aberto. A Nyta faz a abertura
// e (se houver) o follow-up; depois formula a resposta a partir do que o artista respondeu.
// Metodologia v2: a história saiu e a parte financeira virou opção de rádio (sem texto aberto).
export type OpenTextField = 'oQueFalam' | 'entrega' | 'paraQuem';
export const GUIDED_OPENTEXT: Record<OpenTextField, { opener: string; followups: string[] }> = {
  oQueFalam: {
    opener: 'Que palavras você gostaria de ouvir alguém usar pra te descrever?',
    followups: ['Se alguém indicasse o seu trabalho pra outra pessoa, o que você gostaria que falassem de você?'],
  },
  entrega: {
    opener: 'Pensa numa pessoa que te ouve: o que ela sente quando escuta a sua música?',
    followups: ['Em poucas palavras, que tipo de experiência a sua música oferece? (ex.: energia, acolhimento, nostalgia, pista de dança)'],
  },
  paraQuem: {
    opener: 'Pensa em quem mais se conecta com a sua música hoje. Quem são essas pessoas?',
    followups: ['Tem algo em comum entre elas? Idade, lugar, gosto, um momento de vida?'],
  },
};
