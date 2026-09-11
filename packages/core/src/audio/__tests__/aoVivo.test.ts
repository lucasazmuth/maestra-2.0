import {
  assinaturaDaPista, assinaturaDoClipe, criarEcoDasEscritas, decidirOEvento, iniciais,
  pessoasPresentes, type EventoDoJam,
} from '../aoVivo';

// O Espaço JAM com mais de uma pessoa dentro — a parte que se decide sem rede.

describe('pessoasPresentes', () => {
  const bia = { id: 'u-bia', nome: 'Bia' };
  const ana = { id: 'u-ana', nome: 'Ana' };
  const eu = { id: 'u-eu', nome: 'Zé' };

  it('junta o que veio de todas as chaves do canal', () => {
    expect(pessoasPresentes({ a: [bia], b: [ana] }).map((p) => p.nome)).toEqual(['Ana', 'Bia']);
  });

  // ⚠️ Abrir o editor em dois separadores é banal, e dois avatares iguais no topo não dizem
  // nada a ninguém.
  it('a mesma pessoa em dois separadores é um avatar só', () => {
    expect(pessoasPresentes({ a: [bia], b: [bia] })).toHaveLength(1);
  });

  // ⚠️ A fila muda de ordem a cada pessoa que entra, e uma fila que dança é uma fila que
  // ninguém lê. Eu sou a âncora; o resto sai por nome.
  it('eu venho primeiro, e o resto por nome', () => {
    const fila = pessoasPresentes({ a: [bia], b: [eu], c: [ana] }, 'u-eu');
    expect(fila.map((p) => p.nome)).toEqual(['Zé', 'Ana', 'Bia']);
  });

  it('atravessa um canal vazio e uma chave sem ninguém', () => {
    expect(pessoasPresentes({})).toEqual([]);
    expect(pessoasPresentes({ a: [] })).toEqual([]);
  });

  // Uma entrada sem id é uma sessão a meio de entrar: não se desenha um avatar de ninguém.
  it('descarta quem chegou sem identidade', () => {
    expect(pessoasPresentes({ a: [{ id: '', nome: 'X' }] })).toEqual([]);
  });
});

describe('iniciais', () => {
  it('a primeira letra, maiúscula', () => {
    expect(iniciais('bia')).toBe('B');
    expect(iniciais('  ana maria ')).toBe('A');
  });

  it('sem nome, uma interrogação — e não um círculo vazio', () => {
    expect(iniciais()).toBe('?');
    expect(iniciais('   ')).toBe('?');
  });
});

// ⚠️ ISTO EXISTE POR CAUSA DO ARRASTO. O Postgres devolve tudo o que muda, incluindo o que fui
// eu a escrever — e o eco de uma escrita minha chega DEPOIS de eu já ter arrastado mais um
// bocado. Sem memória, o clipe salta para trás debaixo do dedo, uma vez por segundo.
describe('criarEcoDasEscritas', () => {
  it('reconhece o retorno de uma escrita minha', () => {
    const eco = criarEcoDasEscritas();
    eco.anotar('clipe:c1', 'a');
    expect(eco.ehMeu('clipe:c1', 'a')).toBe(true);
  });

  it('o que eu não escrevi não é meu', () => {
    const eco = criarEcoDasEscritas();
    eco.anotar('clipe:c1', 'a');
    expect(eco.ehMeu('clipe:c1', 'b')).toBe(false);
    expect(eco.ehMeu('clipe:c2', 'a')).toBe(false);
  });

  // O caso do arrasto: escrevo 12, arrasto até 20, e o eco do 12 chega atrasado. As duas
  // assinaturas têm de continuar a ser minhas — senão o clipe salta para trás.
  it('lembra-se de mais do que a última escrita', () => {
    const eco = criarEcoDasEscritas();
    eco.anotar('clipe:c1', '12');
    eco.anotar('clipe:c1', '20');
    expect(eco.ehMeu('clipe:c1', '12')).toBe(true);
    expect(eco.ehMeu('clipe:c1', '20')).toBe(true);
  });

  // ⚠️ E ESQUECE. Uma memória que nunca esquece faz com que a outra pessoa não consiga pôr a
  // linha num valor por onde eu passei há uma hora: eu ignorava o evento dela para sempre.
  it('esquece o que é velho de mais para ser meu', () => {
    const eco = criarEcoDasEscritas();
    eco.anotar('clipe:c1', 'a');
    expect(eco.ehMeu('clipe:c1', 'a', Date.now() + 60_000)).toBe(false);
  });
});

describe('assinaturas', () => {
  // ⚠️ `track_id` ENTRA NA DO CLIPE: arrastar de uma faixa para outra é mexer no clipe, e sem
  // isso o meu próprio eco de uma mudança de faixa parecia um evento de outra pessoa.
  it('a do clipe muda quando ele muda de faixa', () => {
    const base = { track_id: 't1', start_seconds: 0, offset_seconds: 0, duration_seconds: 5 };
    expect(assinaturaDoClipe(base)).not.toBe(assinaturaDoClipe({ ...base, track_id: 't2' }));
  });

  it('a da pista muda com o mudo e com o volume', () => {
    const base = { name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0, pan: 0 };
    expect(assinaturaDaPista(base)).not.toBe(assinaturaDaPista({ ...base, muted: true }));
    expect(assinaturaDaPista(base)).not.toBe(assinaturaDaPista({ ...base, gain: 0.5 }));
  });

  // O nome não muda uma nota do que soa, mas muda o que se lê na coluna — e é por isso que ele
  // entra: renomear tem de chegar à outra tela.
  it('a da pista muda com o nome', () => {
    const base = { name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0, pan: 0 };
    expect(assinaturaDaPista(base)).not.toBe(assinaturaDaPista({ ...base, name: 'Guia' }));
  });
});

describe('decidirOEvento', () => {
  const nunca = { ehMeu: () => false };
  const sempre = { ehMeu: () => true };
  const conhecidos = { pistas: ['t1'], clipes: ['c1'] };
  const pista = (over = {}) => ({
    id: 't1', name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0, pan: 0, ...over,
  });
  const clipe = (over = {}) => ({
    id: 'c1', track_id: 't1', start_seconds: 0, offset_seconds: 0, duration_seconds: 5, ...over,
  });
  const ev = (e: EventoDoJam) => e;

  it('o volume de outra pessoa remenda a pista, sem ir ao servidor', () => {
    const d = decidirOEvento(
      ev({ tabela: 'catalog_tracks', tipo: 'UPDATE', linha: pista({ gain: 0.4 }) }),
      nunca, conhecidos,
    );
    expect(d).toEqual({ faca: 'remendarPista', id: 't1', parte: expect.objectContaining({ gain: 0.4 }) });
  });

  it('o arrasto de outra pessoa remenda o clipe, com a faixa de destino', () => {
    const d = decidirOEvento(
      ev({ tabela: 'catalog_clips', tipo: 'UPDATE', linha: clipe({ start_seconds: 12, track_id: 't2' }) }),
      nunca, conhecidos,
    );
    expect(d).toEqual({
      faca: 'remendarClipe',
      id: 'c1',
      parte: expect.objectContaining({ start_seconds: 12, track_id: 't2' }),
    });
  });

  // O eco: é o que faz o clipe não saltar para trás debaixo do próprio dedo.
  it('o que fui eu a escrever não mexe em nada', () => {
    expect(decidirOEvento(
      ev({ tabela: 'catalog_clips', tipo: 'UPDATE', linha: clipe({ start_seconds: 12 }) }),
      sempre, conhecidos,
    )).toEqual({ faca: 'nada' });
  });

  // ⚠️ UM CLIPE NOVO TRAZ UM FICHEIRO QUE ESTA TELA PODE NUNCA TER VISTO. Sem a URL dele não há
  // o que tocar nem o que desenhar, e montar a linha pela metade seria pôr um retângulo mudo na
  // montagem. Recarregar custa uma leitura, e só acontece quando alguém ENVIA áudio.
  it('o que é novo manda recarregar, em vez de inventar a linha', () => {
    expect(decidirOEvento(
      ev({ tabela: 'catalog_clips', tipo: 'INSERT', linha: clipe({ id: 'c9' }) }),
      nunca, conhecidos,
    )).toEqual({ faca: 'recarregar' });
    expect(decidirOEvento(
      ev({ tabela: 'catalog_tracks', tipo: 'INSERT', linha: pista({ id: 't9' }) }),
      nunca, conhecidos,
    )).toEqual({ faca: 'recarregar' });
  });

  // Uma linha que esta tela não conhece é uma linha que ela não sabe remendar — mesmo num
  // UPDATE. É o caso de quem desfaz: a pista volta do nada.
  it('um UPDATE de uma linha desconhecida também recarrega', () => {
    expect(decidirOEvento(
      ev({ tabela: 'catalog_tracks', tipo: 'UPDATE', linha: pista({ id: 't7' }) }),
      nunca, conhecidos,
    )).toEqual({ faca: 'recarregar' });
  });

  // Apagar e desapagar mudam quantas faixas a tela desenha: não é remendo de campo.
  it('apagar recarrega, e não remenda', () => {
    expect(decidirOEvento(
      ev({ tabela: 'catalog_clips', tipo: 'UPDATE', linha: clipe({ deleted_at: '2026-09-12' }) }),
      nunca, conhecidos,
    )).toEqual({ faca: 'recarregar' });
    expect(decidirOEvento(
      ev({ tabela: 'catalog_tracks', tipo: 'UPDATE', linha: pista({ deleted_at: '2026-09-12' }) }),
      nunca, conhecidos,
    )).toEqual({ faca: 'recarregar' });
  });

  it('um evento sem id não faz nada', () => {
    expect(decidirOEvento(
      ev({ tabela: 'catalog_tracks', tipo: 'UPDATE', linha: {} }), nunca, conhecidos,
    )).toEqual({ faca: 'nada' });
  });
});
