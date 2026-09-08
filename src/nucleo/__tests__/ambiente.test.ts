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
      configurarAmbiente({ armazenamento: proprio, sessao: memoria(), origemDoApp: 'maestra://', buscar: fetch });

      ambiente().armazenamento.gravar('token', 'abc');

      expect(proprio.ler('token')).toBe('abc');
      expect(localStorage.getItem('token')).toBeNull();
      expect(ambiente().origemDoApp).toBe('maestra://');
    });

    it('resolve na chamada, não no import: configurar depois vale', () => {
      // `store.ts` monta o Redux durante o import. Se a porta resolvesse cedo, o app nativo não
      // teria como se registrar a tempo.
      expect(ambiente().origemDoApp).toBe(window.location.origin);
      configurarAmbiente({ armazenamento: memoria(), sessao: memoria(), origemDoApp: 'maestra://', buscar: fetch });
      expect(ambiente().origemDoApp).toBe('maestra://');
    });
  });
});

// A porta de `fetch` existe por causa de uma diferença que não dá erro nenhum: o `fetch` do
// React Native devolve uma `Response` SEM `body`, então quem lê a resposta em pedaços (a Nyta)
// receberia o texto inteiro no fim e pareceria só lentidão. O app registra o `expo/fetch`, que
// tem `body`; a web não precisa configurar nada.
describe('a porta de busca', () => {
  afterEach(() => reiniciarAmbiente());

  it('sem configuração, delega para o fetch global', async () => {
    const global = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    await ambiente().buscar('https://exemplo/x');

    expect(global).toHaveBeenCalledWith('https://exemplo/x');
    global.mockRestore();
  });

  // O DEFEITO QUE ESTE ARQUIVO DEIXOU PASSAR.
  //
  // Aqui se afirmava `expect(ambiente().buscar).toBe(fetch)` — identidade com o global. Só que
  // guardar a função SOLTA faz de `ambiente().buscar(...)` uma chamada de MÉTODO, com `this`
  // valendo o objeto do ambiente, e o `fetch` do navegador recusa isso: "Failed to execute
  // 'fetch' on 'Window': Illegal invocation".
  //
  // O jsdom não reproduz a recusa (o `fetch` dele é função comum), então o teste passava e a
  // web quebrava. E quebrava CALADA: o TypeError caía no `try` do `postToNytaChat` e virava
  // "Erro de conexão. Verifique sua internet." — a web culpando a internet de quem estava
  // usando, com a requisição nunca saindo do navegador. No app nada acontecia, porque o
  // `expo/fetch` não depende de `this`.
  //
  // O que se prende agora não é a identidade, é o `this` da chamada.
  it('não chama o fetch global como método do ambiente', async () => {
    let esteThis: unknown = '(não chamado)';
    const original = globalThis.fetch;
    globalThis.fetch = function (this: unknown) {
      esteThis = this;
      return Promise.resolve(new Response('ok'));
    } as typeof fetch;

    await ambiente().buscar('https://exemplo/x');
    globalThis.fetch = original;

    expect(esteThis).not.toBe(ambiente());
  });

  it('a superfície pode trocar por um que saiba fazer streaming', async () => {
    const proprio = jest.fn().mockResolvedValue(new Response('ok'));
    configurarAmbiente({
      armazenamento: memoria(), sessao: memoria(), origemDoApp: 'maestra://', buscar: proprio,
    });

    await ambiente().buscar('https://exemplo/x');

    expect(proprio).toHaveBeenCalledWith('https://exemplo/x');
  });
});
