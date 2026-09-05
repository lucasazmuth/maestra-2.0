import { mapaDeReferencias } from '../mapaDeReferencias';

// O mapa é o desenho mais fácil de quebrar sem ninguém ver: ele "funciona" com as bolhas em
// cima umas das outras, e só um olho na tela nota. Estes testes prendem as garantias que os
// números do arquivo compraram — cada uma delas custou uma medição.

const identidade = (referencias: Record<string, string>) => ({ references: referencias });

describe('mapa de referências', () => {
  it('sem referências, não há bolha nenhuma', () => {
    expect(mapaDeReferencias()).toEqual([]);
    expect(mapaDeReferencias(identidade({ artisticas: '   ' }))).toEqual([]);
  });

  it('uma bolha por NOME, e não por campo', () => {
    const bolhas = mapaDeReferencias(identidade({ artisticas: 'Djonga, Emicida; BK\nCriolo' }));
    expect(bolhas.map((b) => b.nome)).toEqual(['Djonga', 'Emicida', 'BK', 'Criolo']);
  });

  it('cada grupo fica no próprio setor', () => {
    const bolhas = mapaDeReferencias(identidade({
      artisticas: 'A', gestao: 'G', comunicacao: 'C',
    }));
    const em = (chave: string) => bolhas.find((b) => b.chave === chave)!;
    // Artísticas em cima à direita, gestão embaixo à direita, comunicação embaixo à esquerda.
    // (y cresce para BAIXO, como em tela.)
    expect(em('artistica').x).toBeGreaterThan(0);
    expect(em('artistica').y).toBeLessThan(0);
    expect(em('career').x).toBeGreaterThan(0);
    expect(em('career').y).toBeGreaterThan(0);
    expect(em('communication').x).toBeLessThan(0);
    expect(em('communication').y).toBeGreaterThan(0);
  });

  // A razão de existirem duas fileiras: com uma só, oito nomes num arco de 70 graus se
  // sobrepunham. Se alguém "simplificar" para uma fileira, isto acusa.
  it('a partir de cinco nomes o grupo usa duas fileiras', () => {
    const quatro = mapaDeReferencias(identidade({ artisticas: 'a,b,c,d' }));
    const oito = mapaDeReferencias(identidade({ artisticas: 'a,b,c,d,e,f,g,h' }));
    // Os anéis são elipses (330x310 e 245x235), então o raio varia com o ângulo dentro do mesmo
    // anel — contar raios distintos não separa fileira. 275 fica no vão entre os dois.
    const naDeFora = (bs: typeof oito) => bs.filter((b) => Math.hypot(b.x, b.y) > 275).length;
    expect(naDeFora(quatro)).toBe(4);
    expect(naDeFora(oito)).toBeLessThan(8);
    expect(naDeFora(oito)).toBeGreaterThan(0);
  });

  // O fio existe pra dizer a que nó cada nome pertence. Aparado nas duas pontas, ele não cruza
  // por dentro dos círculos — e nunca tem comprimento negativo, que viraria uma linha ao contrário.
  it('o fio começa na borda do nó e nunca é negativo', () => {
    const bolhas = mapaDeReferencias(identidade({ artisticas: 'a,b,c,d,e,f,g,h', gestao: 'x' }));
    for (const b of bolhas) {
      expect(b.linha.comprimento).toBeGreaterThanOrEqual(0);
      // A ponta do fio fica a exatamente um raio de nó (58) do centro do nó.
      const no = b.chave === 'artistica' ? { x: 92, y: -88 } : { x: 92, y: 88 };
      expect(Math.hypot(b.linha.x - no.x, b.linha.y - no.y)).toBeCloseTo(58, 6);
    }
  });

  it('duas bolhas do mesmo grupo nunca se encostam', () => {
    const bolhas = mapaDeReferencias(identidade({ artisticas: 'a,b,c,d,e,f,g,h' }));
    for (let i = 0; i < bolhas.length; i += 1) {
      for (let j = i + 1; j < bolhas.length; j += 1) {
        // 54px de diâmetro: menos que isso entre centros é sobreposição.
        expect(Math.hypot(bolhas[i].x - bolhas[j].x, bolhas[i].y - bolhas[j].y))
          .toBeGreaterThan(54);
      }
    }
  });
});
