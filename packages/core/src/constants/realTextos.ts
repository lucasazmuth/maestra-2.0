// ─────────────────────────────────────────────────────────────────────────────
// OS TEXTOS DO RELATÓRIO REAL — só conteúdo, nenhuma lógica.
//
// Fonte: "Diagnóstico REAL · Especificação do Relatório · v4" (Anita Carvalho, 07/09/2026).
// A spec é explícita: os textos "foram escritos ou revisados palavra a palavra" e "vão para o
// banco exatamente como estão. Nenhum texto do relatório é gerado por IA em tempo de execução."
//
// POR QUE ESTE ARQUIVO NÃO TEM CÓDIGO: quem edita aqui é a autora do método, não quem programa.
// Misturar gatilho com texto obrigaria a ler condicional para trocar uma vírgula, e foi assim que
// a v3 acumulou frase repetida entre `realCopy` e a narrativa. A escolha de QUAL texto sai mora
// em `services/realEngine/comentarios.ts`; aqui só existe o que se lê.
//
// As chaves entre chaves (`{receita_anual}`, `{n_altos}`…) são interpoladas por aquele módulo,
// com as regras de formatação do §11 da spec.
//
// Substitui: `Maestra_Diagnostico_REAL_Conteudo`, `Maestra_Comentarios_Personalizados_PDF`,
// `Maestra_16_Perfis_Textos` e os textos de interpretação do `realCopy.ts`.
// ─────────────────────────────────────────────────────────────────────────────

import type { DimKey } from './realCopy';

/**
 * Os retratos dos 16 perfis (§5.2), pelo padrão de bits R E A L.
 *
 * O Beginner (0000) é o único com variação: o texto muda por um ESTÁGIO que o artista não vê,
 * escolhido pelas quatro notas do boletim (§5.1). Por isso ele não está aqui, e sim em
 * `RETRATOS_DO_BEGINNER`.
 */
export const RETRATOS: Record<string, string> = {
  '1111': 'Você tem alcance, sua música se sustenta, tem público de verdade e o setor te reconhece: as quatro frentes acesas ao mesmo tempo. É o perfil mais raro do REAL. Você pode até ser um fenômeno e ter chegado aqui por acaso, mas em geral isso é resultado de construção, de anos de intenção. O risco agora não é crescer, é sustentar. Carreira no auge exige tanta estratégia quanto carreira em ascensão, talvez mais, porque há mais a perder. Daqui pra frente, a pergunta é o que proteger e qual é o próximo passo, com clareza.',
  '1110': 'Você tem alcance, sua música se sustenta e tem público de verdade: três frentes girando juntas, o que é valioso. O que ainda não acompanha é o reconhecimento do setor: imprensa, prêmios, curadoria. Isso tem nome: sucesso comercial sem prestígio acompanhando. Pode ser escolha sua não disputar esse espaço, e pode ser uma lacuna que ninguém cuidou, por imagem, por preconceito com o gênero, ou só por falta de intenção. Vale saber qual das duas. Se não for escolha, é uma frente inteira que ainda pode trabalhar a seu favor.',
  '1101': 'Você tem alcance, sua música se sustenta e o setor te reconhece: uma combinação madura, que costuma levar anos. O que não está de pé é o público presencial. Os números e a crítica estão aí, mas isso ainda não virou gente pagando pra te ver no palco. Você é forte onde muita gente é fraca, e ainda não ativou a frente onde a carreira costuma se firmar. Público real se prova ao vivo, e é a única frente que nenhuma plataforma te dá.',
  '1011': 'Você tem alcance, público de verdade e reconhecimento do setor: três coisas difíceis de construir, e você chegou lá. O que não acompanha é a sustentabilidade. A carreira movimenta gente e atenção, mas não movimenta o dinheiro que esse tamanho justificaria. Provavelmente você está cobrando menos do que vale, deixando receita na mesa, ou gastando mais do que precisava. Esse é o tipo de lacuna que se corrige com gestão, não com mais talento.',
  '0111': 'Sua música se sustenta, você tem público de verdade e o setor te reconhece: a carreira está firme no mundo real. O que ficou pra trás foi o digital. O alcance online não acompanha o tamanho do resto, e hoje quem te descobre no show tem dificuldade de continuar te encontrando depois. Pode ser fase, pode ser escolha. O digital não substitui o que você já tem, ele amplia. E essa amplitude se constrói com estratégia e constância, não com esforço aleatório.',
  '1100': 'Você tem alcance e sua música se sustenta: a carreira encontrou uma engrenagem que funciona nas plataformas e já se paga. O que ainda não existe é público presencial nem reconhecimento do setor. Os números são grandes, mas isso ainda não virou gente na plateia nem nome que a crítica cita. É uma base poderosa, e também uma base exposta: quem vive de plataforma vive de algoritmo, e algoritmo muda de ideia. Transformar essa força em palco e em reconhecimento não acontece sozinho. Acontece com intenção.',
  '1010': 'Você tem alcance e público de verdade: gente te acha online e gente aparece nos seus shows. O que ainda não vira é sustentabilidade nem reconhecimento. A presença está construída, a conversão não. É um dos perfis com mais coisa pronta esperando ser ativada: a matéria-prima está toda aqui. O que falta é a estrutura que transforma alcance e público em receita, e em nome que o setor reconhece. Estrutura é exatamente o que se desenha com estratégia.',
  '1001': 'Tem burburinho em volta do seu nome. Sua música aparece no digital e o setor já está falando de você: crítica, imprensa, curadoria. É uma combinação rara, porque normalmente o reconhecimento vem depois do público real, não antes. O que ainda não existe é a base: gente pagando pra te ver no palco e a música se sustentando. O buzz é real, e é frágil. Atenção não dura pra sempre, e buzz que não vira plateia nem receita vira lembrança. Esse é o momento de transformar expectativa em carreira, e isso é decisão de estratégia, não de sorte.',
  '0110': 'Sua música se sustenta e você tem público de verdade: a base do ao vivo está de pé, e ela é sólida. O que não acompanha é o alcance digital nem o reconhecimento do setor. A carreira funciona no presencial, mas tem pouca presença online e ainda não foi validada pela crítica. É uma fundação forte, do tipo que sustenta crescimento. A questão é estratégica: pra onde essa base vai te levar, e qual frente você ativa primeiro sem perder o que já segura a carreira de pé.',
  '0101': 'Sua música se sustenta e o setor te reconhece: duas frentes difíceis, e você tem as duas. Mas sem alcance digital expressivo nem público presencial consistente. A carreira gera receita e respeito sem depender de multidão, o que é incomum e desafia a lógica do mercado. É um perfil de força concentrada, comum em nichos e bastidores. O caminho, se você quiser ampliar, passa por decidir se quer construir presença, online ou no palco, ou aprofundar o nicho que já te sustenta. Os dois caminhos são legítimos. Os dois exigem intenção.',
  '0011': 'Você tem público de verdade e o setor te reconhece: gente aparece nos seus shows e a crítica já te enxerga. O setor aposta em você antes do grande público chegar, e isso é um ativo: ter reconhecimento antes de ter escala abre portas. O que falta é alcance digital e sustentabilidade. A presença existe, a escala e a receita ainda não. Esse é o momento de transformar credibilidade em alcance e em dinheiro, e isso não acontece por inércia.',
  '1000': 'Você tem alcance: presença online construída, gente que te acompanha na tela. Mas essa força ainda não virou sustentabilidade, público presencial nem reconhecimento do setor. É uma frente forte e isolada: muita visibilidade, pouca conversão. A pergunta é como fazer essa audiência virar receita, palco e nome. E a resposta não é mais seguidores. É intenção.',
  '0100': 'Sua música te sustenta: a carreira gera dinheiro, e isso já te coloca à frente de muita gente que tem números mas não tem receita. O que ainda não existe é alcance, público presencial em escala ou reconhecimento do setor. É o perfil comum de quem vive de evento corporativo, particular ou bastidor: fatura bem, mas não constrói alcance nem público próprio. A base é valiosa, e é concentrada demais pra ser estável no longo prazo, porque depende de contratante, não de plateia. O caminho é usar o que a receita permite pra construir as outras frentes, com estratégia.',
  '0010': 'Você tem público de verdade: gente que aparece, que ocupa a plateia, que faz o calor de um show. É talvez a coisa mais valiosa e mais difícil de fabricar numa carreira, e você tem. O que ainda não veio foi o alcance, a sustentabilidade e o reconhecimento: o público real existe antes de tudo o resto. É um paradoxo bonito: o palco funciona, e fica por lá. Fazer o palco trabalhar por você fora dele, no digital, na receita, no reconhecimento, é o próximo capítulo. E ele se escreve com intenção.',
  '0001': 'O setor te reconhece: crítica, imprensa ou curadoria já apontaram pro seu trabalho. Mas sem alcance, sem público presencial em escala e sem a música se sustentar, esse reconhecimento fica no papel. É o perfil do cult: quem conhece, respeita; o grande mercado ainda não descobriu. Reconhecimento sem estrutura não se sustenta sozinho. As outras frentes se constroem com gestão. E você já tem o que gestão nenhuma compra.',
};

/** Os três estágios invisíveis do Beginner (§5.1). O artista sempre vê "Beginner". */
export const RETRATOS_DO_BEGINNER = {
  'BEG.0': 'Você está no começo, e o REAL diz isso sem rodeio: as quatro frentes da carreira ainda estão por construir. Isso não é sentença, é retrato. Todo artista que hoje lota casa e fatura passou por este ponto. A diferença entre quem chega e quem fica rodando é ter intenção por trás do próximo passo. Agora você sabe onde está.',
  'BEG.1': 'Você está no começo, mas já em movimento: {n} frentes da sua carreira saíram do zero. Nenhuma acendeu ainda, e isso é o esperado neste momento. O que o REAL mostra é onde a sua energia está rendendo e onde ainda não. Ter esse retrato antes de investir mais é o que separa estratégia de achismo.',
  'BEG.2': 'Pelo retrato você está no começo, mas uma frente já está quase acendendo: {dimensao}. Isso muda a leitura. Não é ponto de partida, é ponto de virada. Quando uma frente acende, o perfil muda, e as outras costumam andar junto. É hora de intenção, não de dispersão.',
} as const;

export type EstagioDoBeginner = keyof typeof RETRATOS_DO_BEGINNER;

/** As leituras curtas (§5.3) — grade dos 16 e capa do PDF. */
export const LEITURAS_CURTAS: Record<string, string> = {
  '1111': 'As quatro frentes acesas. Agora é sustentar.',
  '1110': 'Vende, lota e se sustenta. O prestígio ainda não acompanhou.',
  '1101': 'Alcance, receita e reconhecimento. Falta o público que engaja e comparece.',
  '1011': 'Público, alcance e reconhecimento. Ainda não alcançou o potencial de receita que tem.',
  '0111': 'Firme no mundo real. O digital ficou pra trás.',
  '1100': 'Grande nas plataformas e se pagando. Mas ainda sem plateia e sem crítica.',
  '1010': 'Gente te acha e gente aparece. Ainda não vira receita nem reconhecimento.',
  '1001': 'O setor fala de você antes do público real chegar.',
  '0110': 'A base do ao vivo está de pé. Falta o mundo saber.',
  '0101': 'Receita e respeito sem depender de multidão.',
  '0011': 'Palco e crítica acreditam. Escala e receita ainda não acompanham.',
  '1000': 'Muita visibilidade, pouca conversão.',
  '0100': 'A música paga. Depende de contratante, não de plateia.',
  '0010': 'Público real, mas sem gerar receita, alcance ou legitimação externa.',
  '0001': 'A mídia respeita, mas isso não gera receita, alcance ou público real.',
  '0000': 'O começo de qualquer carreira. Agora você sabe onde está.',
};

/** A intro de cada dimensão (§6.1, §7.1, §8.1, §9.1). Recolhida na tela, aberta no PDF. */
export const INTRO_DA_DIMENSAO: Record<DimKey, string> = {
  r: 'Alcance é consumo passivo. É a quantidade de gente que a sua música alcança sem que essa pessoa tenha necessariamente escolhido você: ela caiu numa playlist, o algoritmo sugeriu, o vídeo apareceu no feed. É gente sendo exposta ao seu trabalho. A gente mede isso em três frentes: os ouvintes mensais no Spotify, os seguidores nas redes e as visualizações no YouTube. Alcance importa porque é a porta de entrada: ninguém vira público sem antes ter sido alcançado. Mas alcance não é público. Ter muita gente ouvindo é diferente de ter gente que te escolheu, engaja, compra ingresso e volta. Essa segunda parte é o A, de Audience. Aqui a gente está olhando só o tamanho da porta.',
  e: 'Música é um trabalho como qualquer outro, e trabalho precisa se sustentar. Quando eu pergunto a razão de um artista existir, ele me diz: mudar o mundo, fazer as pessoas se divertirem... E eu respondo: e te sustentar também, né? O E olha exatamente isso. Não é quanto entra, é quanto sobra: a gente soma tudo o que a sua música rendeu nos últimos 12 meses, shows e todas as outras fontes, e desconta o que a carreira custou pra funcionar. Custo de show, custo fixo do mês, o que você investiu em gravar e lançar. O que fica é o saldo, e é o saldo que diz se a música está te sustentando ou se você está sustentando a música. Ter CNPJ e ter empresário contam a favor, porque sem estrutura não se chega a contratante bom. E se a resposta for que a música ainda não se paga, isso não é vergonha. É informação. Sem ela, fica impossível ajustar a rota.',
  a: 'Público real é quem te escolheu. Não é quem foi alcançado por acaso, é quem seguiu, comprou ingresso, apareceu. É o oposto do alcance: lá a gente mede a porta de entrada, aqui a gente mede quem atravessou e ficou. O A olha três coisas. Primeiro, a conversão no Spotify: de cada pessoa que ouve, quantas seguem. Segundo, a circulação: quantos shows você fez no último ano. Terceiro, o público pagante nos seus shows de bilheteria. O palco está aqui por uma razão simples: é onde a mágica acontece, onde a conexão de verdade se prova e onde a maioria dos artistas ganha a vida. A gente sabe que não é fácil, que há poucos espaços pra artista novo, e que depende do nicho. Mas quem quer construir carreira não abre mão do ao vivo. Se você não faz shows de bilheteria em que é a atração principal, essa dimensão não acende, e isso é proposital: público real se prova com gente pagando pra te ver, independente da proporção.',
  l: 'Legitimação é reconhecimento de fora. É o setor dizendo que o seu trabalho tem valor: um júri que te indica, um jornalista que escreve sobre você, um curador que te coloca numa playlist editorial, uma rádio que te programa. É diferente de vender e de lotar. Sucesso comercial e prestígio são coisas distintas, e uma não garante a outra: tem artista que fatura muito e a crítica ignora, por imagem, por polêmica, ou por preconceito com o gênero que ele faz. O L olha quatro sinais. Dois vêm de gente: prêmios e imprensa, que você informa. Dois vêm de plataforma: playlists editoriais e rádio, que a gente lê direto dos dados. Os dois primeiros pesam mais, porque reconhecimento humano é o que legitima de verdade. Mas o L só acende se pelo menos um sinal de plataforma confirmar, salvo quando há prêmio internacional. Legitimação é patrimônio: se acumula com o tempo, e raramente se perde.',
};

/** A frase de leitura de cada dimensão, pelo estado (§6.2, §7.2, §8.2, §9.2). */
export const LEITURA_DA_DIMENSAO: Record<DimKey, { alto: string; baixo: string }> = {
  r: {
    alto: 'Sua música chega a gente muito além do seu círculo. Streaming, redes e vídeo, as três frentes do alcance, estão fortes ao mesmo tempo, e isso não é comum. Quando as três andam juntas, é sinal de constância, e o algoritmo é um monstro que se alimenta de constância. Agora a pergunta que interessa é o que esse alcance está virando. Porque exposição é porta de entrada, e porta de entrada só vale se tem gente atravessando.',
    baixo: 'Sua música ainda chega a pouca gente fora do seu círculo. Isso é o retrato de hoje, não uma sentença: o alcance é a frente que mais responde a constância, e é por onde muita carreira começa a andar. Sem intenção por trás, ele não cresce sozinho. O que os dados mostram é o tamanho atual da sua porta de entrada. Ainda é pequena. E saber disso é o primeiro passo pra decidir o que fazer com ela.',
  },
  e: {
    alto: 'Sua música se paga, e paga bem. O que ela rendeu no último ano cobre o que a carreira custou e ainda deixa um saldo que a coloca entre as carreiras que de fato se sustentam no país. Isso é raro, e não acontece por sorte: é resultado de trabalho, estrutura e intenção. Agora a pergunta é se esse patamar é o destino ou o degrau.',
    baixo: 'Sua música ainda não se sustenta sozinha. O que ela rendeu no último ano, descontado o que a carreira custou, não chega ao ponto em que a gente considera uma carreira financeiramente de pé. Isso é mais comum do que parece, e representa o degrau de uma escada. A parte boa é que dinheiro é a frente que mais responde a gestão: quem sabe quanto entra e quanto sai já está na frente de quem só tem a sensação.',
  },
  a: {
    alto: 'Você tem público de verdade. Gente que te segue quando ouve, que aparece quando você toca, que paga pra entrar. Das quatro frentes da carreira, essa é a mais difícil de construir e a que menos depende de algoritmo. Quem chega aqui construiu no palco, show a show. É um ativo que nenhuma plataforma te dá e nenhuma te tira.',
    baixo: 'Seu público real ainda está em construção. A distância entre quem te alcança e quem te escolhe ainda é grande, e isso é o retrato mais honesto que o diagnóstico entrega: número de ouvinte impressiona, público pagante sustenta. Essa é a frente que se constrói no palco e no vínculo direto com quem ouve. Demora mais, mas é a que fica.',
  },
  l: {
    alto: 'O setor reconhece o seu trabalho. Prêmios, imprensa ou curadoria já validaram o que você faz, e isso abre portas que número nenhum abre sozinho: convite, programação, pauta, edital. Legitimação é o tipo de ativo que demora pra construir e que o mercado respeita. Agora vale olhar se as outras frentes da carreira estão aproveitando esse reconhecimento.',
    baixo: 'O setor ainda não validou o seu trabalho de forma expressiva. Isso não diz nada sobre a qualidade da sua música, e é importante você saber disso: legitimação é uma frente que se constrói com intenção, posicionamento e tempo, não só com talento. Muito artista bom passa anos sem ela por nunca ter tratado o reconhecimento como parte do trabalho. Ainda está em construção.',
  },
};

/**
 * Os textos fixos F1 a F21 (§10).
 *
 * O sinal ¶ marca quebra de parágrafo, como na spec; quem renderiza decide se vira `\n\n` (texto
 * corrido) ou dois blocos. Guardar o sinal em vez da quebra mantém o texto igual ao documento.
 */
export const FIXOS = {
  F1: 'O retrato da sua carreira hoje, feito com dados reais. A partir da análise de quatro dimensões R, E, A e L, você recebe uma classificação entre 16 perfis possíveis. Não é uma sentença: é um ponto de partida, para que sua carreira seja dirigida por decisões baseadas em dados e informações, e não em intuição e achismo. Refaça periodicamente para acompanhar sua evolução.',
  F2: 'Alcance e público digital lidos do Spotify e das redes, via API. Receita, agenda e reconhecimento informados por quem preencheu o diagnóstico. A Maestra não verifica esses dados.',
  F3: 'Faltam {x} pontos para acender e {y} para o Top Tier.',
  F4: 'Acesa. Faltam {y} pontos para o Top Tier.',
  F5: 'Top Tier: o patamar mais alto desta frente.',
  F6: 'TOP ICON. Top Tier nas quatro frentes ao mesmo tempo. É o ponto mais alto do REAL.',
  F7: 'informado por você',
  F8: 'Dados marcados com asterisco foram informados por quem preencheu o diagnóstico. A Maestra não verifica esses dados.',
  F9: 'Conecte suas redes sociais no Spotify for Artists. Isso ajuda as plataformas de dados a reconhecerem seus perfis, e o diagnóstico passa a ler os números sozinho. Enquanto isso, o que a gente não conseguir ler você informa.',
  F10: 'Cada perfil é uma combinação das quatro frentes, acesas ou apagadas. Nenhum é melhor que o outro: cada um descreve uma carreira num momento. O seu está destacado.',
  F11: 'O Diagnóstico REAL foi criado por Anita Carvalho a partir de trinta anos gerindo carreiras na música e de sua pesquisa de doutorado sobre como artistas gerem a própria carreira. No centro dessa pesquisa está a análise de 313 planejamentos estratégicos reais, feitos com artistas de todos os portes. ¶ Ele lê quatro frentes: alcance (a quem sua música chega), ganhos (se ela se paga), público real (quem te escolheu) e legitimação (quem te reconhece). Duas vêm de dados de plataforma, lidos direto do Spotify e das redes. Duas vêm do que você informa. Cada frente é comparada com referências de mercado e lida como acesa ou apagada, e a combinação das quatro define o seu perfil entre 16 possíveis. ¶ A distinção que organiza tudo é simples: alcance não é público. Muita gente pode ouvir você por acaso. Público é quem te escolheu. Separar as duas coisas é o que deixa o retrato honesto. ¶ Cada frente também recebe uma nota de 0 a 100, que mostra quanto falta pra acender e quanto falta pro Top Tier. Os critérios são revisados a cada ano, com dados novos do mercado e da própria base da Maestra.',
  F12: 'Anita Carvalho é empresária artística, consultora e pesquisadora do mercado da música. Há trinta anos à frente da Música & Mídia, cuidou carreiras de grandes artistas e atuou como consultora em mais de 300 planejamentos. Fundou a Music Rio Academy, a primeira escola do Brasil dedicada à gestão de carreiras artísticas, e é autora da Pesquisa de Empresariamento Artístico, a única série contínua sobre o tema no país, publicada desde 2017. É mestre e doutoranda em Economia Criativa pela ESPM. ¶ O Diagnóstico REAL nasce dessa trajetória: a prática de mercado encontrando o rigor da pesquisa.',
  F13: 'Você sabe onde está. Agora, é hora de descobrir pra onde ir, e como chegar lá.',
  F14: 'O diagnóstico é o retrato da sua carreira hoje. Estratégia é o que vem depois: é ter intenção por trás de cada próximo passo, e não só ver onde vai dar. O planejamento com a Nyta transforma esse retrato em plano: mapa de referências, fundamentos estratégicos, objetivos, estratégias priorizadas e cronograma, construídos com você, na mesma metodologia que já orientou centenas de artistas. Sem pressa, uma pergunta de cada vez, como eu faria numa consultoria individual com você.',
  F15: 'Começar meu planejamento com a Nyta',
  F16: 'Seu diagnóstico fica salvo. Refaça quando quiser pra acompanhar a evolução da carreira.',
  F17: 'Este diagnóstico foi feito numa versão anterior do método REAL. Os critérios mudaram desde então. Refaça pra ver o retrato atual da sua carreira.',
  F18: 'Gerado por {nome_usuario} · {data} às {hora} · Documento {id}',
  F19: 'Executou o plano e cresceu? Refaça o REAL pra ver sua fase subir.',
  F20: 'Baixar diagnóstico (PDF)',
  F21: 'O que é esta frente',
} as const;

/** Títulos que acompanham os fixos, quando a spec os traz junto (§10). */
export const TITULOS = {
  F1: 'Diagnóstico REAL',
  F10: 'Sua posição entre os 16 perfis',
  F11: 'Como nasce o seu diagnóstico',
  F12: 'Anita Carvalho',
  F12papel: 'Criadora do Diagnóstico REAL e fundadora da Maestra',
  F19botao: 'Refazer diagnóstico',
  F20compartilhar: 'Compartilhar',
} as const;

/**
 * Os comentários, por ID (§6.3 a §9.9).
 *
 * O ID é o contrato entre a autora e o código: a spec fala em "R2.c", "E3.f", "A1.f", e é assim
 * que o gatilho é escrito em `comentarios.ts`. Renomear um ID aqui quebra a correspondência com o
 * documento, que é o que permite conferir texto por texto.
 */
export const COMENTARIOS: Record<string, string> = {
  // ── R · Alcance ────────────────────────────────────────────────────────────
  'R1.a': 'Seu alcance está entre os maiores do país. Streaming, redes e vídeo no topo, ao mesmo tempo. Pouca gente chega aqui, e ninguém chega por acaso: isso é resultado de constância, de lançamento atrás de lançamento, de presença. O que muda agora é o tamanho da responsabilidade. Alcance desse porte é um ativo, e ativo se protege com a mesma intenção com que foi construído.',
  'R1.b': 'Seu alcance acende. As três frentes estão acima do que o mercado considera forte. As pessoas já te encontram, e ser encontrado por elas é a parte que muita gente passa anos tentando. Agora a pergunta é o que esse alcance está virando: público que te escolhe, receita que sustenta, reconhecimento que abre porta. Se as outras frentes não acompanham, o alcance está pagando a conta sozinho, e alcance sozinho é frágil.',
  'R1.c': 'Falta pouco. O alcance ainda não acende, mas {n_altos} das {n_frentes} frentes já passaram do ponto. Você está no lugar onde muita gente desiste: perto demais pra parecer longe, longe demais pra parecer pronto. É aqui que a constância decide.',
  'R1.d': 'Seu alcance está em construção. Você já aparece no digital, mas ainda longe do que o mercado considera forte. Isso não é fraqueza, é o que precisa melhorar, e saber exatamente onde é o que separa estratégia de achismo. O alcance é a frente que mais responde a intenção e constância, e também a que mais pune a dispersão: lançar sem plano é gastar munição.',
  'R1.e': 'Seu alcance ainda não começou. Nenhuma das frentes do digital saiu do lugar. Pode ser porque você está mesmo no início, ou porque ainda não conectou seus perfis. No primeiro caso o retrato é que hoje, sua música não chega em quem não te conhece. Todo artista grande passou por aqui um dia. A diferença está no que vem depois, e no que vem depois tem que ter intenção.',
  'R2.e': 'A gente só conseguiu ler uma das três frentes do seu alcance. Com uma frente só, o alcance não acende, por regra: seria como medir o tamanho de uma casa olhando só a porta. Conecte suas redes no Spotify for Artists, ou informe os números na próxima vez, e a leitura fica completa.',
  'R2.a': 'O streaming puxa, as redes não acompanham. Você tem ouvintes, mas Instagram, TikTok e YouTube ainda não refletem esse tamanho. Na prática, tem gente ouvindo sua música que não sabe quem você é, e não tem onde te encontrar depois. Alcance desequilibrado rende menos do que poderia: a playlist te entrega o ouvinte, e não tem ninguém do outro lado pra recebê-lo.',
  'R2.b': 'Suas redes são fortes, o streaming não acompanha. Tem gente te seguindo que ainda não virou ouvinte. Isso é mais comum do que parece, e diz uma coisa importante: as pessoas gostam de você, mas não estão consumindo a sua música. O salto está em transformar quem te segue em quem te ouve. Seguidor que não escuta é audiência de perfil, não de artista.',
  'R2.c': 'Streaming e redes de pé, o vídeo não. O YouTube é hoje uma das maiores portas de entrada de público novo, e é a sua frente mais fraca. Vídeo é onde a música ganha rosto, e onde muita gente descobre um artista pela primeira vez. Não é obrigação, é escolha. Mas se a escolha foi não estar lá, vale saber que essa porta ainda pode ser melhor explorada.',
  'R2.d': 'As frentes do digital ainda estão abaixo do ponto. Não é uma peça faltando: é o alcance inteiro por construir. A boa notícia é que essa é a frente que mais depende de você e menos de terceiro. Não precisa de contratante, de curador, de crítico. Precisa de constância e intenção. É por aqui que a maioria começa.',
  R3: '{campos} foram informados por você. A gente usa o número que você deu com o mesmo peso do dado automático. Só marcamos a origem porque transparência faz parte do método: o retrato é seu, e você tem que saber de onde cada dado veio. Quando suas redes estiverem conectadas ao Spotify for Artists, ele passa a vir sozinho.',

  // ── E · Sustentabilidade ───────────────────────────────────────────────────
  'E1.a': 'Sua receita está no topo. O saldo da sua música no último ano está no patamar mais alto da escala, onde pouquíssimas carreiras chegam. Sustentar isso exige a mesma intenção que construiu. Patamar alto não se protege com talento, se protege com gestão.',
  'E1.b': 'Sua receita acende. A música te sustenta num patamar que a maioria dos artistas ainda não alcançou. Isso te dá uma coisa preciosa: margem pra decidir. Quem não depende do próximo cachê pra fechar o mês escolhe melhor os próximos passos.',
  'E1.c': 'Falta pouco. Sua música já rende e já se paga; o saldo só ainda não chegou ao ponto em que a carreira vira sustentável de verdade. É a distância entre viver de música com aperto e viver de música com folga. Costuma ser a fase em que investir mais faz mais diferença.',
  'E1.d': 'Sua receita está em construção. A música rende, mas o saldo ainda é pequeno diante do que a carreira precisa pra se sustentar. Isso não é fraqueza, é a fase. O que importa agora é que você sabe os números, e a maioria não sabe.',
  'E1.e': 'Hoje você sustenta a música, e não o contrário. O que a carreira custou no último ano foi igual ou maior do que ela rendeu. Isso pode ser uma escolha: toda carreira tem fase de investimento, e investir antes de colher é normal. O que não pode é ser acidente. Se você não sabia que a conta estava assim, agora sabe. E se a música for hobby, tudo bem também: aí não precisa de estratégia, onde chegar, chegou.',
  'E2.d': 'Toda a sua receita vem do palco. O ao vivo é a principal fonte de renda da maioria dos artistas, então isso não é problema, é ponto de partida. Mas a música também rende fora do palco: distribuidora, editora, associação, marcas, aulas. Hoje, pra você, essas frentes estão em zero. Vale saber se é por escolha ou por falta de estrutura.',
  'E2.a': 'Quase tudo vem de uma fonte só. {fonte_dominante} responde por {pct} da sua receita. Uma fonte concentrando quase tudo deixa a carreira exposta: se ela esfria, a receita inteira sente. A música pode gerar renda por muitos caminhos.',
  'E2.c': 'Sua receita é bem distribuída. O dinheiro vem de várias frentes, sem depender de nenhuma sozinha. É a configuração mais estável que uma carreira pode ter, e é a que menos artista tem.',
  'E2.b': 'Sua receita tem mais de uma perna. {fonte1} e {fonte2} dividem o faturamento. Isso dá estabilidade: quando uma oscila, a outra segura. É uma base melhor do que a de muita carreira maior que a sua.',
  'E3.b': 'Você está investindo mais do que a música devolve. No último ano ela rendeu R$ {receita_anual} e custou R$ {investimento_anual}, um saldo negativo de R$ {saldo_abs}. Isso não é necessariamente erro: toda carreira tem fase de investimento. Mas precisa ser conta intencional, não acidental. Se foi planejado, ótimo. Se você só descobriu agora, esse número vale mais que qualquer conselho.',
  'E3.a': 'A música se paga, e sobra. No último ano ela rendeu R$ {receita_anual} e custou R$ {investimento_anual}. O saldo é positivo com folga: a carreira devolve mais do que consome. Nem todo artista tem essa margem, e margem é o que permite investir no próximo patamar sem apertar o presente.',
  'E3.c': 'A música se paga, no limite. Rendeu R$ {receita_anual}, custou R$ {investimento_anual}, e sobrou pouco. A carreira está de pé, mas sem gordura pra reinvestir. Nessa configuração, um mês ruim vira problema. É o momento de olhar os custos com o mesmo cuidado que se olha o cachê.',
  'E3.d': 'Você não investiu em gravar nem em lançar nos últimos 12 meses. A carreira rendeu R$ {receita_anual} sem música nova entrando no mercado. O algoritmo é um monstro que se alimenta de lançamento, e quem não lança vai perdendo lugar sem perceber. Crescer costuma exigir investimento em algum momento, e saber quando é decisão estratégica.',
  'E3.e': 'Seu custo fixo está pesado. O que você paga todo mês pra carreira funcionar, mesmo sem show, consome mais da metade do que a música rende. Estrutura é importante, mas estrutura que não cabe na receita vira âncora. Vale conferir se cada item do fixo está devolvendo o que custa.',
  'E3.f': 'Seus shows não estão se pagando. O custo médio de produzir cada apresentação é igual ou maior do que o cachê médio que você recebe. Em outras palavras, cada show que você faz sai do seu bolso. Isso pode fazer sentido numa fase de construção de público, mas não pode ser invisível. Ou o cachê sobe, ou o custo desce, ou o show é investimento consciente.',
  'E4.a': 'Sem CNPJ e sem empresário. Os dois sinais de estrutura estão ausentes, e isso pesa mais do que parece: sem formalização, não se chega a contratante bom, e sem alguém cuidando da estratégia, a carreira é só sua pra carregar. A pesquisa de empresariamento mostra que artista com empresário tende a faturar mais. É uma frente sem ninguém cuidando.',
  'E4.b': 'Você tem CNPJ, mas não tem empresário. A formalização está de pé, e isso já abre porta. O que falta é alguém olhando a estratégia junto com você. A pesquisa de empresariamento mostra que essa é a frente que mais destrava crescimento quando entra em campo. Encontrar esse profissional é a segunda maior dificuldade dos artistas no Brasil, então você não está só nisso.',
  'E4.c': 'Você tem empresário, mas não tem CNPJ. Tem quem cuide da estratégia, mas a formalização ainda não acompanhou. É um ajuste que costuma render em organização e em acesso a contratante que não fecha sem nota. Estrutura pela metade rende pela metade.',
  'E4.d': 'Estrutura montada: CNPJ e empresário. Você tem os dois pilares de profissionalização, e a pesquisa de empresariamento associa essa configuração a maior faturamento. Isso é base. Base não garante resultado, mas sem ela o resultado não se sustenta.',
  'E5.a': 'Seu melhor cachê vem de {tipo_dominante}: R$ {cache_max}, contra uma média de R$ {cache_medio} nos demais. Vale olhar onde essa diferença está: se é o tipo de contratante que paga melhor, faz sentido buscar mais desse; se é o que você menos faz, tem receita na mesa.',
  'E5.b': 'Seus cachês variam pouco entre os tipos de contratante. Isso pode significar que você já encontrou o seu preço, ou que ainda não está cobrando diferente de quem pode pagar diferente. Corporativo e particular costumam pagar acima de casa de show.',
  E6: 'Você não soube informar quanto recebeu de {fontes_nao_sei}. A gente contou zero, e sinalizou. Não é pra te punir: é porque, na prática, quem não sabe quanto recebe de uma fonte costuma estar recebendo menos do que poderia. Conhecer cada receita é parte do trabalho de gerir a carreira.',
  'E7.a': 'Cada show seu deixa, em média, R$ {margem_show} depois de pagar banda e equipe. Com essa margem, o seu custo fixo do ano se cobre com cerca de {shows_equilibrio} shows. Você fez {shows_ano}. Esse número, mais do que qualquer outro, diz quantos shows você precisa vender por ano pra carreira ficar de pé.',
  'E7.b': 'Hoje o cachê não cobre o custo do show, então não existe margem pra pagar o fixo do ano. Cada apresentação, em vez de sustentar a estrutura, consome. Esse é o número mais importante deste diagnóstico, e a boa notícia é que ele tem dois lados pra mexer: o que você cobra e o que você gasta.',
  'E8.a': 'Pra ter uma referência: sua música rendeu, líquido, {x} vezes o que um emprego formal no setor cultural paga em média no Brasil. Ou seja, ser artista está sendo melhor negócio do que ter carteira assinada na cultura. Isso é uma conquista, e é raro.',
  'E8.b': 'Pra ter uma referência: sua música rendeu, líquido, {x} do que um emprego formal no setor cultural paga em média no Brasil. Isso não desvaloriza a sua escolha, só coloca ela em perspectiva. Viver de música é possível, e o caminho até lá passa por saber exatamente onde a conta está hoje.',

  // ── A · Público real ───────────────────────────────────────────────────────
  'A1.a': 'Seu público real está no topo. Conversão alta, agenda cheia e casa lotada de gente pagante, ao mesmo tempo. Esse é o ativo mais difícil da carreira, e você tem em escala. O que se protege aqui não é número, é vínculo: público assim se cuida com presença e verdade, não com campanha.',
  'A1.b': 'Seu público real acende. Você tem gente comprometida: não só número, mas plateia que ocupa a casa e sustenta seus shows. Essa é a base que segura uma carreira de pé quando o algoritmo muda de ideia. Agora vale olhar se o resto da carreira está à altura desse público.',
  'A1.f': 'A gente ainda não consegue medir sua conversão: ou o Spotify não está conectado, ou você ainda tem menos de mil ouvintes, e abaixo disso a conta não é confiável. Sem essa frente, o público real não acende, por regra. As outras duas frentes aparecem aqui do mesmo jeito, e quando os ouvintes crescerem a leitura fica completa.',
  'A1.c': 'Falta pouco. Duas das três frentes do público real já passaram do ponto; só {frente_faltante} ainda não. É a fase em que a carreira começa a ter chão: o público existe, o que falta é uma frente acompanhar as outras. Constância no palco costuma ser o que fecha essa conta.',
  'A1.d': 'Seu público real está em construção. Uma das três frentes já está de pé, {frente_alta}, e as outras ainda não. É assim que começa: o público não nasce pronto, ele se forma de show em show, de ouvinte que vira seguidor, de seguidor que vira ingresso. Você já tem por onde puxar.',
  'A1.e': 'Seu público real ainda não se formou. Nenhuma das três frentes chegou ao ponto: a conversão é baixa, a agenda é esporádica e o público pagante ainda não existe ou não foi medido. Isso é o retrato de quem está começando, e todo artista que hoje lota casa passou por ele. A diferença é o que se faz depois de saber.',
  'A2.e': 'Você não faz shows de bilheteria em que é a atração principal, e por isso o público real não acende. Isso não é julgamento sobre a sua agenda: show corporativo e evento fechado pagam a conta de muito artista, e são legítimos. Mas não provam público próprio, porque ali quem paga é o contratante, não a plateia. Enquanto não houver gente comprando ingresso pra te ver, essa frente fica em aberto. E ela é o diferencial de quem constrói carreira que dura.',
  'A2.a': 'Quem te ouve, te segue. Sua conversão no Spotify está alta, e isso é raro: mostra que a música conecta. O que ainda não acompanha é o palco. Esse público digital comprometido ainda não virou plateia, e plateia é onde o vínculo se prova e vira receita. Tem gente esperando pra te ver ao vivo.',
  'A2.b': 'Seu palco está forte: agenda cheia e gente pagando pra te ver. O que não acompanha é o digital: de quem te ouve no Spotify, pouca gente te segue. Você tem público real onde mais importa, e ainda não está convertendo quem te descobre online. É uma frente inteira de público esperando pra ser trazida.',
  'A2.c': 'Você faz shows, mas o público pagante é baixo. A agenda existe, e isso já é um grande passo. O que ainda não existe é a casa cheia de gente que pagou pra estar ali. Público pagante é o sinal mais honesto de audiência real, e é o que dá poder de barganha na hora de negociar cachê: quem lota, pode cobrar mais. Comercialmente, o valor do seu cachê é proporcional ao público que você atrai.',
  'A2.d': 'Poucos shows, mas casa cheia. Você toca pouco, e quando toca o público aparece e paga. A base está aí, e é a mais valiosa que existe. O que falta é frequência: transformar esse público que já te escolheu em agenda. Show que lota e não se repete é oportunidade que se perde.',
  'A2.f': 'Você quase não está no palco. Foram {shows_ano} shows no último ano, abaixo do ponto em que a gente considera uma agenda de pé. O ao vivo é onde o público real se constrói e se prova, e hoje essa frente está parada. A gente sabe que há poucos espaços pra artista novo, e que depende do nicho. Mas sem palco não há público real, e sem público real a carreira fica dependente de plataforma.',
  'A3.a': 'Seu engajamento hoje: {rede_1} {taxa_1}%{, rede_2 taxa_2%}. Esse número não entra no índice, mas vale acompanhar: engajamento mede vínculo, não tamanho, e vínculo é o que transforma seguidor em público.',
  'A3.b': 'A gente não conseguiu ler o engajamento das suas redes. Ele não entra no índice, então isso não muda o seu resultado, mas é um dado que vale ter. Conectar suas redes no Spotify for Artists ajuda as plataformas de dados a enxergarem seus perfis.',

  // ── L · Legitimação ────────────────────────────────────────────────────────
  'L1.a': 'Sua legitimação está no topo. Reconhecimento internacional, imprensa e presença nas plataformas, ao mesmo tempo. Esse tipo de validação ampla é o que sustenta uma carreira de referência, e é raríssimo. O que se administra a partir daqui é reputação, e reputação pede tanto cuidado quanto construção.',
  'L1.b': 'Sua legitimação acende. O mercado te valida: seu trabalho aparece onde o reconhecimento se constrói, e ao menos uma plataforma confirma isso. Legitimação abre portas que números não abrem. Agora a pergunta é se você está usando essas portas.',
  'L1.f': 'Você tem reconhecimento de gente, mas sua música ainda não circula. Prêmios e imprensa apontam na sua direção, e o setor te enxerga. Mas sem playlist editorial e sem rádio, esse reconhecimento ainda não chegou aos canais que levam a música ao público, e por isso a legitimação não acende. É uma legitimação que existe no discurso, mas ainda não na difusão. Uma playlist editorial ou execução em rádio acende esta dimensão.',
  'L1.c': 'Falta pouco. O reconhecimento já está se formando: tem sinal de gente ou de plataforma apontando na sua direção, só ainda não fechou. Legitimação costuma vir assim, um sinal puxando o outro: a imprensa chama a atenção do curador, a playlist chama a atenção do júri. É construção que responde a posicionamento.',
  'L1.d': 'Sua legitimação está em construção. Existe algum sinal de reconhecimento, mas ainda pontual. Isso é o normal de quem ainda não tratou o reconhecimento como frente de trabalho, e a maioria não trata. A diferença entre o artista reconhecido e o que não é raramente está no talento. Está na intenção.',
  'L1.e': 'Sua legitimação ainda não começou. Nenhum sinal de reconhecimento apareceu: nem prêmio, nem imprensa, nem playlist editorial, nem rádio. É uma frente inteira em aberto, e das quatro talvez seja a que mais depende de intenção pra existir, porque ninguém te reconhece por acaso. Saber disso é o começo.',
  'L2.e': 'Seu reconhecimento internacional acendeu a legitimação sozinho, mesmo sem playlist editorial e sem rádio. Isso é raro e é merecido: prêmio internacional é o sinal mais forte que existe. Mas vale saber que sua música ainda não circula nas plataformas, e circulação é o que transforma reconhecimento em público novo.',
  'L2.a': 'Você tem imprensa, mas falta presença nas plataformas. A mídia já fala de você, e isso tem valor. O que ainda não aconteceu é sua música aparecer nas playlists editoriais nem no rádio, e esses são os sinais de que o reconhecimento chegou também a quem programa o que o público ouve.',
  'L2.b': 'Sua música circula, mas a imprensa ainda não chegou. Você está em playlist editorial ou no rádio, sinal de que o trabalho tem peso onde se programa música. O que falta é a narrativa: gente que conte a sua história, não só toque a sua música. Playlist te apresenta; imprensa te explica.',
  'L2.c': 'Você tem prêmio, mas o reconhecimento ainda é pontual. Uma premiação valida o trabalho, e isso pesa. Mas legitimação se sustenta em mais de uma frente, e hoje a sua se apoia num sinal só. Prêmio que não vira imprensa nem programação fica no currículo, não na carreira.',
  'L2.d': 'A legitimação ainda não começou a se construir. Prêmios, imprensa, playlists editoriais e rádio ainda não fazem parte da sua trajetória. É uma frente inteira em aberto, e uma das que mais muda como o setor enxerga uma carreira quando começa a andar.',
  'L3.a': 'Você ainda não teve indicação a nenhum prêmio. Isso é o mais comum, e não diz nada sobre o trabalho: prêmio se inscreve, se articula, se disputa. Muito artista bom nunca concorreu porque nunca soube que podia. Vale saber que existem premiações locais e regionais onde a porta costuma estar mais aberta.',
  'L3.b': 'Você já tem reconhecimento local ou regional. É o primeiro degrau, e é real: um júri olhou o seu trabalho e apontou pra ele. O que ainda não aconteceu é esse reconhecimento sair da sua região. Prêmio nacional é outro patamar de alcance, e é a partir dele que a legitimação começa a pesar de verdade no mercado.',
  'L3.c': 'Você tem reconhecimento nacional: um júri de alcance nacional já apontou pro seu trabalho. Isso pesa. É o patamar em que prêmio deixa de ser currículo e vira argumento: abre pauta, abre programação, abre negociação. Vale usar.',
  'L3.d': 'Você tem reconhecimento internacional. É o sinal mais raro e mais forte de legitimação que existe, e ele fala por si. O que se faz com isso é o que separa um prêmio de uma virada de carreira.',
  'L4.a': 'Seu trabalho ainda não apareceu na mídia. Nem imprensa, nem TV, nem influenciador, nem podcast. Isso é mais comum do que parece, e quase sempre é por falta de estratégia, não de assunto: todo artista tem história, o que falta é alguém contando. Imprensa é a frente que mais responde a intenção.',
  'L4.b': 'Seu trabalho já apareceu na mídia, em veículos de porte pequeno ou médio. Isso é cobertura de verdade, e é assim que se começa. O que ainda não aconteceu é o veículo grande, o que muda o alcance da sua história. Cobertura menor, com constância, costuma ser o caminho até lá.',
  'L4.c': 'Você já apareceu em veículo de grande porte. Esse tipo de cobertura é difícil de conseguir e pesa muito na legitimação: mostra que a sua história interessa além do nicho. Vale guardar e usar, porque matéria grande é argumento em qualquer negociação.',
  'L5.a': 'Sua imprensa é esporádica. Aparece de vez em quando, sem um ritmo ligado ao trabalho. Cobertura sem constância vira memória, não legitimação. O que sustenta reconhecimento é aparecer com regularidade, e regularidade se planeja.',
  'L5.b': 'Sua imprensa acompanha os lançamentos. É o padrão mais comum e faz sentido: lançamento é assunto. O próximo passo é a imprensa aparecer também entre um lançamento e outro, porque é aí que a legitimação deixa de ser evento e vira presença.',
  'L5.c': 'Sua imprensa é perene. Você aparece na mídia mesmo sem lançamento, e isso é o sinal mais forte de que o seu trabalho virou assunto por si. É raro, e é exatamente o tipo de presença que sustenta legitimação ao longo do tempo.',
  'L6.a': 'Sua música está em {n_playlists} playlist{s} editorial{is}: {lista}. Isso é curadoria humana, gente que programa o que milhões ouvem escolhendo o seu trabalho. É um dos sinais de legitimação que menos dependem de você e mais dizem sobre a música.',
  'L6.b': 'Sua música ainda não está em playlist editorial. Playlist editorial é curadoria: alguém do Spotify escolhendo o seu trabalho pra apresentar a gente que não te conhece. Entrar nela depende de lançamento bem feito e de pitch, e é uma das frentes em que estratégia faz diferença direta.',
  'L6.c': 'Sua música está tocando no rádio: {execucoes} execuções rastreadas nos últimos seis meses. Rádio é programação, e programação é escolha de quem conhece o mercado. É um sinal de que o trabalho tem lugar onde o público ainda descobre música.',
  'L6.d': 'Sua música ainda não toca no rádio de forma consistente. Isso é comum em vários gêneros, e por isso o rádio não pesa contra você no índice quando está ausente. Mas quando aparece, ele conta, porque rádio ainda é uma das portas mais fortes pra público que não vive de plataforma.',
  L7: 'Você vende e tem público, mas o prestígio não acompanhou. Isso tem nome: sucesso comercial sem legitimação. É mais comum do que o mercado admite, e as razões variam: imagem, polêmica, ou simplesmente o preconceito que alguns gêneros ainda enfrentam na crítica. Pode ser uma escolha sua não disputar esse espaço. Mas se não for escolha, é uma frente inteira que ainda pode trabalhar a seu favor.',
};
