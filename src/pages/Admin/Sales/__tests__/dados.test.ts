import { emReais, posicaoEntre, tituloSugerido, totalDaEtapa, type Negocio } from '../dados';

const negocio = (over: Partial<Negocio>): Negocio =>
  ({
    id: 'x', pipeline_id: 'p', stage_id: 'e1', company_id: null, contact_id: null,
    linked_user_id: null, title: 't', value: 0, expected_close_date: null, priority: 'medium',
    source: null, status: 'open', lost_reason: null, board_position: 0, owner_id: null,
    archived: false, notes: null, tags: null, ...over,
  }) as Negocio;

describe('posicaoEntre', () => {
  // A media entre vizinhos e o que deixa o arrasto escrever UMA linha em vez de renumerar a
  // coluna inteira. Se ela deixar de cair no meio, dois cartoes disputam a mesma posicao e a
  // ordem passa a depender do desempate do banco.
  it('cai exatamente no meio dos vizinhos', () => {
    expect(posicaoEntre(10, 20)).toBe(15);
    expect(posicaoEntre(0, 1)).toBe(0.5);
  });

  it('abre espaco nas pontas', () => {
    expect(posicaoEntre(undefined, 5)).toBe(4);   // topo da coluna
    expect(posicaoEntre(5, undefined)).toBe(6);   // fim da coluna
  });

  it('comeca em zero na coluna vazia', () => {
    expect(posicaoEntre(undefined, undefined)).toBe(0);
  });

  // O ponto flutuante nao pode empatar depois de varios arrastos seguidos para o mesmo lugar:
  // empate significa ordem indefinida na tela.
  it('continua estritamente entre os vizinhos apos insercoes repetidas', () => {
    let baixo = 0;
    let alto = 1;
    for (let i = 0; i < 20; i += 1) {
      const meio = posicaoEntre(baixo, alto);
      expect(meio).toBeGreaterThan(baixo);
      expect(meio).toBeLessThan(alto);
      alto = meio;
    }
  });
});

describe('totalDaEtapa', () => {
  // O cabecalho da coluna e o que faz o quadro ser lido como funil. Contar ou somar a coluna
  // errada da uma leitura de pipeline que nao existe.
  it('conta e soma apenas os negocios daquela etapa', () => {
    const lista = [
      negocio({ id: 'a', stage_id: 'e1', value: 100 }),
      negocio({ id: 'b', stage_id: 'e1', value: 250 }),
      negocio({ id: 'c', stage_id: 'e2', value: 999 }),
    ];

    expect(totalDaEtapa(lista, 'e1')).toEqual({ quantidade: 2, valor: 350 });
    expect(totalDaEtapa(lista, 'e2')).toEqual({ quantidade: 1, valor: 999 });
    expect(totalDaEtapa(lista, 'vazia')).toEqual({ quantidade: 0, valor: 0 });
  });

  // `value` vem do Postgres como numeric e chega como string no supabase-js. Somar sem converter
  // concatena ("100" + "250" = "100250") e o total da coluna vira ficcao.
  it('soma valor que chegou como texto', () => {
    const lista = [
      negocio({ id: 'a', stage_id: 'e1', value: '100' as unknown as number }),
      negocio({ id: 'b', stage_id: 'e1', value: '250' as unknown as number }),
    ];
    expect(totalDaEtapa(lista, 'e1').valor).toBe(350);
  });
});

describe('emReais', () => {
  it('formata em real brasileiro', () => {
    //   e o espaco nao separavel que o Intl usa entre o simbolo e o numero.
    expect(emReais(1500)).toBe('R$ 1.500');
    expect(emReais(0)).toBe('R$ 0');
  });
});

describe('tituloSugerido', () => {
  // Titulo em branco faz o time digitar a mesma coisa toda vez, e cartao sem padrao deixa o
  // quadro ilegivel de longe. A sugestao e ponto de partida, nao imposicao: o campo segue editavel.
  it('monta o titulo a partir do nome do cliente', () => {
    expect(tituloSugerido('Estúdio Vermelho')).toBe('Proposta para Estúdio Vermelho');
  });

  it('ignora espaco em volta do nome', () => {
    expect(tituloSugerido('  Gravadora X  ')).toBe('Proposta para Gravadora X');
  });

  // Sem nome nao ha sugestao a fazer: devolver "Proposta para " deixaria o campo com lixo que a
  // pessoa teria que apagar antes de escrever.
  it('devolve vazio quando nao ha nome', () => {
    expect(tituloSugerido('')).toBe('');
    expect(tituloSugerido('   ')).toBe('');
  });
});
