import { ambiente, configurarAmbiente, reiniciarAmbiente, type Armazenamento } from '@maestra/core/nucleo/ambiente';

// A porta existe para o núcleo rodar fora do navegador. O que precisa ficar garantido é que a
// web continua igual sem nenhuma configuração (senão a extração quebraria o produto de hoje) e
// que o app consegue substituir o depósito inteiro (senão a extração não serviria para nada).

const memoria = (): Armazenamento => {
  const m = new Map<string, string>();
  return {
    ler: (c) => m.get(c) ?? null,
    gravar: (c, v) => { m.set(c, v); },
    apagar: (c) => { m.delete(c); },
  };
};

describe('ambiente', () => {
  beforeEach(() => {
    reiniciarAmbiente();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterAll(reiniciarAmbiente);

  describe('padrão, sem ninguém configurar', () => {
    // Este é o caso da web e o de todos os 419 testes: se ele exigir setup, a extração custou
    // uma linha em cada arquivo de teste.
    it('grava no localStorage de verdade', () => {
      ambiente().armazenamento.gravar('k', 'v');
      expect(localStorage.getItem('k')).toBe('v');
      expect(ambiente().armazenamento.ler('k')).toBe('v');
    });

    it('separa sessão de armazenamento', () => {
      ambiente().sessao.gravar('k', 'da-sessao');
      expect(sessionStorage.getItem('k')).toBe('da-sessao');
      expect(localStorage.getItem('k')).toBeNull();
    });

    it('apaga', () => {
      ambiente().armazenamento.gravar('k', 'v');
      ambiente().armazenamento.apagar('k');
      expect(ambiente().armazenamento.ler('k')).toBeNull();
    });

    it('tira a origem do app da página', () => {
      expect(ambiente().origemDoApp).toBe(window.location.origin);
    });
  });

  // Aba anônima, cota cheia e navegador com dados de site bloqueados fazem o `Storage` LANÇAR.
  // Antes da porta, cada chamador tinha (ou esquecia de ter) o próprio try/catch.
  describe('depósito que lança', () => {
    const quebrado = () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cota'); });
      jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('bloqueado'); });
    };

    afterEach(() => jest.restoreAllMocks());

    it('não deixa a leitura estourar', () => {
      quebrado();
      expect(ambiente().armazenamento.ler('k')).toBeNull();
    });

    it('não deixa a escrita nem o apagar estourarem', () => {
      quebrado();
      expect(() => ambiente().armazenamento.gravar('k', 'v')).not.toThrow();
      expect(() => ambiente().armazenamento.apagar('k')).not.toThrow();
    });
  });

  describe('configurado pela superfície', () => {
    it('o app substitui o depósito e o navegador não é mais tocado', () => {
      const proprio = memoria();
      configurarAmbiente({ armazenamento: proprio, sessao: memoria(), origemDoApp: 'maestra://' });

      ambiente().armazenamento.gravar('token', 'abc');

      expect(proprio.ler('token')).toBe('abc');
      expect(localStorage.getItem('token')).toBeNull();
      expect(ambiente().origemDoApp).toBe('maestra://');
    });

    it('resolve na chamada, não no import: configurar depois vale', () => {
      // `store.ts` monta o Redux durante o import. Se a porta resolvesse cedo, o app nativo não
      // teria como se registrar a tempo.
      expect(ambiente().origemDoApp).toBe(window.location.origin);
      configurarAmbiente({ armazenamento: memoria(), sessao: memoria(), origemDoApp: 'maestra://' });
      expect(ambiente().origemDoApp).toBe('maestra://');
    });
  });
});
