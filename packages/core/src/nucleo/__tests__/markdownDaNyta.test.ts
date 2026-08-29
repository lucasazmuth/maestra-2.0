import { markdownDaNyta, trechosDaLinha } from '../markdownDaNyta';

// O que este arquivo guarda não é "markdown": é o SUBCONJUNTO que a Nyta de fato escreve, e o
// compromisso de que o resto passa como texto em vez de sumir.

describe('markdown da Nyta', () => {
  it('negrito e itálico viram trechos, sem os sinais', () => {
    expect(trechosDaLinha('Siga a **estratégia** com _cuidado_')).toEqual([
      { texto: 'Siga a ' },
      { texto: 'estratégia', negrito: true },
      { texto: ' com ' },
      { texto: 'cuidado', italico: true },
    ]);
  });

  // A armadilha da ordem: com a regra de itálico antes, `**x**` viraria itálico de `*x*` e
  // sobrariam asteriscos na tela — que é exatamente o sintoma que motivou este arquivo.
  it('asterisco duplo é negrito, não itálico com sobra', () => {
    expect(trechosDaLinha('**Prospectar shows**')).toEqual([
      { texto: 'Prospectar shows', negrito: true },
    ]);
  });

  it('lista numerada e lista com marcador viram itens', () => {
    expect(markdownDaNyta('1. Listar festivais\n2. Pedir proposta')).toEqual([
      { tipo: 'item', marcador: '1.', trechos: [{ texto: 'Listar festivais' }] },
      { tipo: 'item', marcador: '2.', trechos: [{ texto: 'Pedir proposta' }] },
    ]);
    expect(markdownDaNyta('- Um\n* Dois\n+ Três').map((b) => b.tipo)).toEqual(['item', 'item', 'item']);
  });

  it('título vira título, com o nível', () => {
    expect(markdownDaNyta('## Próximos passos')).toEqual([
      { tipo: 'titulo', nivel: 2, trechos: [{ texto: 'Próximos passos' }] },
    ]);
  });

  it('linhas em branco separam, mas não viram bloco', () => {
    expect(markdownDaNyta('Um\n\n\nDois')).toHaveLength(2);
  });

  // O compromisso do subconjunto: o que não é tratado precisa APARECER como texto. Sumir seria
  // pior que aparecer com a sintaxe à mostra.
  it('o que está fora do subconjunto passa como texto, e não some', () => {
    const [bloco] = markdownDaNyta('Veja [o guia](https://exemplo) e `codigo`');
    expect(bloco.trechos.map((t) => t.texto).join('')).toBe('Veja [o guia](https://exemplo) e `codigo`');
  });

  it('texto vazio não vira bloco nenhum', () => {
    expect(markdownDaNyta('')).toEqual([]);
    expect(markdownDaNyta('   \n  ')).toEqual([]);
  });
});
