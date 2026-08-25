import { fecharNegritoAberto, perguntaEmDestaque, placeholderDaPergunta } from '../pergunta';
import { GUIDED_OPENTEXT, SAY } from '../nytaPersona';
import { nextBeat } from '../script';
import type { ArtistContent, ArtistGender } from '../../../../interfaces/maestra';

describe('perguntaEmDestaque', () => {
  it('devolve o trecho em negrito da fala', () => {
    expect(perguntaEmDestaque('Vamos comecar. **Quais artistas te inspiram?** (contexto)'))
      .toBe('Quais artistas te inspiram?');
  });

  // As falas explicam antes e perguntam depois, entao o destaque mais perto do campo e o que vale.
  it('com mais de um destaque, vale o ultimo', () => {
    expect(perguntaEmDestaque('**enquadramento** e ai **a pergunta de verdade?**'))
      .toBe('a pergunta de verdade?');
  });

  it('devolve null quando a fala nao destaca nada', () => {
    expect(perguntaEmDestaque('So um instante, montando isso...')).toBeNull();
    expect(perguntaEmDestaque('')).toBeNull();
    expect(perguntaEmDestaque(undefined)).toBeNull();
  });
});

describe('placeholderDaPergunta', () => {
  it('cai no texto generico quando o passo nao tem pergunta', () => {
    expect(placeholderDaPergunta(null)).toBe('Escreva sua resposta…');
  });

  it('usa a pergunta inteira quando ela cabe', () => {
    expect(placeholderDaPergunta('Quais artistas inspiram musicalmente o seu trabalho hoje?'))
      .toBe('Quais artistas inspiram musicalmente o seu trabalho hoje?');
  });

  // O destaque quase sempre comeca no meio da fala, entao recortado ele nasce em minuscula.
  it('capitaliza a pergunta que comecava no meio da frase', () => {
    expect(placeholderDaPergunta('quais artistas te inspiram?')).toBe('Quais artistas te inspiram?');
  });

  // O campo tem uma linha so: uma frase longa sumiria na borda. Corta na palavra, nunca no meio.
  it('encurta pergunta longa sem partir palavra', () => {
    const longa = 'AZMUTH BEATS quer ser reconhecido nacionalmente, no Brasil, pelo publico e pela critica, como um produtor inovador que…';
    const curto = placeholderDaPergunta(longa);
    expect(curto.length).toBeLessThanOrEqual(73);
    expect(curto.endsWith('…')).toBe(true);
    expect(longa.startsWith(curto.slice(0, -1))).toBe(true);
    expect(curto[0]).toBe(curto[0].toUpperCase());
  });
});

describe('fecharNegritoAberto', () => {
  // Sem isto o usuario ve "**Quais arti" com os asteriscos crus enquanto a Nyta digita.
  it('fecha o destaque que ainda esta sendo digitado', () => {
    expect(fecharNegritoAberto('Vamos la. **Quais arti')).toBe('Vamos la. **Quais arti**');
  });

  it('descarta o asterisco solto que e metade de um destaque', () => {
    expect(fecharNegritoAberto('Vamos la. *')).toBe('Vamos la. ');
    expect(fecharNegritoAberto('Vamos la. **')).toBe('Vamos la. ');
  });

  it('nao mexe na fala com o destaque ja fechado', () => {
    expect(fecharNegritoAberto('Vamos la. **Quais artistas?** E ai')).toBe('Vamos la. **Quais artistas?** E ai');
  });
});

// Estes travam a varredura: cada passo que aceita texto digitado precisa ter uma pergunta
// destacada, senao o campo volta a dizer "Escreva sua resposta..." e o usuario fica sem saber
// a que responder — que e exatamente o problema que este trabalho resolve.
describe('varredura das falas da Nyta', () => {
  const ultimaFala = (falas: string[]) => falas[falas.length - 1];

  const passosDeTexto: [string, string[]][] = [
    ['referencias artisticas', SAY.refArtisticas()],
    ['referencias de comunicacao', SAY.refComunicacao()],
    ['referencias de gestao', SAY.refGestao()],
    ['o que falam de voce', SAY.visionOQueFalam('Fulano quer ser reconhecido como um produtor inovador que…')],
    ['missao: o que entrega', SAY.missionEntrega('Fulano')],
    ['missao: para quem', SAY.missionParaQuem()],
  ];

  it.each(passosDeTexto)('%s destaca a pergunta na ultima fala', (_nome, falas) => {
    expect(perguntaEmDestaque(ultimaFala(falas))).not.toBeNull();
  });

  it('as perguntas-guia do "me ajuda a responder" tambem sao destacadas', () => {
    Object.values(GUIDED_OPENTEXT).forEach(({ opener, followups }) => {
      expect(perguntaEmDestaque(opener)).not.toBeNull();
      followups.forEach((f) => expect(perguntaEmDestaque(f)).not.toBeNull());
    });
  });

  // Um destaque so por fala: com dois, o campo repetiria o segundo e o primeiro viraria enfase
  // decorativa. O negrito aqui tem um significado unico, que e "responda isto".
  it('nenhuma fala carrega mais de um destaque', () => {
    const todas: string[] = [];
    const percorrer = (v: unknown): void => {
      if (typeof v === 'string') todas.push(v);
      else if (Array.isArray(v)) v.forEach(percorrer);
    };
    percorrer([
      SAY.greeting('Fulano'), SAY.askGender(), SAY.askGenreMusical(), SAY.askGenreConfirm('mpb'),
      SAY.askStage(), SAY.referencesIntro('Fulano'), SAY.refArtisticas(), SAY.refComunicacao(),
      SAY.refGestao(), SAY.refPosicionamento(), SAY.visionCityAsk(), SAY.visionOnde(),
      SAY.visionPorQuem('ele'), SAY.visionSubstantivo('ele'), SAY.visionAdjetivo(), SAY.visionReview(),
      SAY.visionOQueFalam('Fulano quer ser reconhecido que…'), SAY.missionEntrega('Fulano'),
      SAY.missionParaQuem(), SAY.missionFinancial(), SAY.missionReview(), SAY.valuesIntro(),
      SAY.objectivesIntro(), SAY.swotIntro(), SAY.swotInternalIntro(), SAY.swotOportunidadesIntro(),
      SAY.swotAmeacasIntro(), SAY.swotReady(), SAY.strategiesReady(), SAY.priorityIntro(),
      SAY.priorityAiChosen(), SAY.scheduleSetupIntro(), SAY.scheduleReady(), SAY.finalReady('Fulano'),
      SAY.nudgeWidget(),
    ]);
    // Lista em vez de forEach com expect: assim a falha mostra QUAL fala tem dois destaques,
    // em vez de so dizer que 2 nao e <= 2.
    const comDoisDestaques = todas.filter((fala) => (fala.match(/\*\*/g) || []).length > 2);
    expect(comDoisDestaques).toEqual([]);
  });
});

// A Nyta trata o artista pelo genero que ele escolheu na abertura. Estas duas falas eram as
// unicas que ignoravam isso: uma fixava o masculino e a outra usava "reconhecido(a)", que nao
// atende quem escolheu "elu" e ainda le mal para quem ouve a tela.
describe('flexao de genero das falas', () => {
  it('trata quem escolheu "ele" no masculino', () => {
    expect(SAY.visionSubstantivo('ele')[0]).toContain('ser chamado?');
    expect(SAY.visionPorQuem('ele')[0]).toContain('ser reconhecido?');
  });

  it('trata quem escolheu "ela" no feminino', () => {
    expect(SAY.visionSubstantivo('ela')[0]).toContain('ser chamada?');
    expect(SAY.visionPorQuem('ela')[0]).toContain('ser reconhecida?');
  });

  it('trata quem escolheu "elu" na forma neutra', () => {
    expect(SAY.visionSubstantivo('elu')[0]).toContain('ser chamade?');
    expect(SAY.visionPorQuem('elu')[0]).toContain('ser reconhecide?');
  });

  // Sem genero informado a fala ainda precisa sair inteira: cai no masculino, que e a base
  // segura do `flex` usado no resto do wizard.
  it('cai no masculino quando o genero ainda nao foi informado', () => {
    expect(SAY.visionSubstantivo(undefined)[0]).toContain('ser chamado?');
  });

  // O parentese nao pode voltar por atalho de quem for reescrever a fala.
  it('nao usa "(a)" para escapar da flexao', () => {
    const falas = [
      ...SAY.visionPorQuem('ela'), ...SAY.visionSubstantivo('ela'),
      ...SAY.visionPorQuem('elu'), ...SAY.visionSubstantivo('elu'),
    ];
    expect(falas.filter((f) => /\(a\)|\(o\)|\(as\)|\(os\)/.test(f))).toEqual([]);
  });
});

// A ligacao entre o roteiro e as falas: o `SAY` pode flexionar certo e ainda assim o artista ser
// tratado errado, se o `nextBeat` esquecer de repassar o genero. Sao dois pontos diferentes de
// falha, e os testes acima so cobrem o primeiro.
describe('o roteiro repassa o genero do artista para as falas', () => {
  const noPassoDaVisao = (gender: ArtistGender) => ({
    step: 1,
    identity: {
      name: 'Fulana', gender, city: 'Recife', state: 'PE',
      visionParts: { onde: 'nacional', porQuem: ['publico'] },
    },
  }) as unknown as ArtistContent;

  it.each([
    ['ela' as ArtistGender, 'ser chamada?'],
    ['ele' as ArtistGender, 'ser chamado?'],
    ['elu' as ArtistGender, 'ser chamade?'],
  ])('trata quem escolheu "%s" corretamente', (gender, esperado) => {
    const beat = nextBeat(noPassoDaVisao(gender));
    expect(beat.stage).toBe('vision.substantivo');
    expect(beat.say.join(' ')).toContain(esperado);
  });
});
