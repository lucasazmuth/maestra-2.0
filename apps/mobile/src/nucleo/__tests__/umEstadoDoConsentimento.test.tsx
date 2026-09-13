import fs from 'fs';
import path from 'path';

import { Pressable, Text } from 'react-native';
import { render, userEvent, waitFor } from '@testing-library/react-native';

import { useConsent, type ConsentState } from '@maestra/core/hooks/useConsent';

import { ConsentimentoDaConta } from '@/nucleo/ConsentimentoDaConta';
import { PortaoDoConsentimento } from '@/nucleo/PortaoDoConsentimento';

// UM ESTADO SÓ PARA O CONSENTIMENTO.
//
// O portão e a tela de coleta precisam do MESMO objeto: quem envia o aceite chama `apply`, e é
// por `apply` que o portão fica sabendo que já pode destrancar.
//
// Enquanto foram duas cópias, a mais velha ganhava — porque a mais velha era a do portão, e é o
// portão que manda na rota. Quem entrava por Google ou Apple preenchia a data, marcava os
// aceites e tocava em Continuar; o servidor registrava tudo e devolvia `satisfied: true`; a tela
// seguia para as boas-vindas — e o portão devolvia a pessoa ao consentimento na primeira mudança
// de rota. A segunda tela vinha SEM o campo de data, porque o servidor já a tinha guardado, e com
// as caixas outra vez vazias: parecia que o aceite não fora registrado, e tinha sido.
//
// Este teste monta as duas peças debaixo do provedor, como o `_layout` faz, e é por isso que ele
// não pode virar dois testes separados: o defeito só existe ENTRE elas.

const mockReplace = jest.fn();
let mockSegmentos: string[] = ['consentimento'];
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
  useSegments: () => mockSegmentos,
}));

jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({ sessao: { user: { id: 'u-1', email: 'a@b.c' } }, carregando: false }),
}));

const NAO_CONSENTIU: ConsentState = {
  blocked: false, reviewStatus: 'ok', needsBirthDate: true, pendingDocs: [],
  satisfied: false, comunicacoes: false, pesquisa: null,
};
const CONSENTIU: ConsentState = { ...NAO_CONSENTIU, needsBirthDate: false, satisfied: true };

// O servidor responde o que responde de verdade: `state` diz que falta consentir, e `submit`
// devolve `satisfied: true` (ver `account-consent/index.ts`).
const mockInvoke = jest.fn(async (_nome: string, opcoes: { body: { action: string } }) => ({
  data: opcoes.body.action === 'submit' ? CONSENTIU : NAO_CONSENTIU,
  error: null,
}));
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: { functions: { invoke: (n: string, o: never) => mockInvoke(n, o) } },
}));

/** A tela de coleta, reduzida ao que importa aqui: ela envia e chama `apply`. */
const Coletora = () => {
  const { apply } = useConsent();
  return (
    <Pressable onPress={() => apply(CONSENTIU)}>
      <Text>Continuar</Text>
    </Pressable>
  );
};

const montar = () => render(
  <ConsentimentoDaConta>
    <PortaoDoConsentimento />
    <Coletora />
  </ConsentimentoDaConta>,
);

beforeEach(() => {
  mockReplace.mockClear();
  mockInvoke.mockClear();
  mockSegmentos = ['consentimento'];
});

describe('um estado só para o consentimento', () => {
  // A consulta saía em dobro — uma por peça — e as edge logs mostravam-nas aos pares.
  it('a consulta sai uma vez, não uma por peça', async () => {
    await montar();

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  // ⚠️ O TESTE DO DEFEITO RELATADO: aceitar e ser devolvido à mesma tela.
  it('quem acabou de aceitar não é devolvido ao consentimento', async () => {
    const tela = await montar();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());

    const usuario = userEvent.setup();
    await usuario.press(tela.getByText('Continuar'));

    // E agora a tela navega — para as boas-vindas, que é o que a de verdade faz.
    mockSegmentos = ['bem-vindo'];
    tela.rerender(
      <ConsentimentoDaConta>
        <PortaoDoConsentimento />
        <Coletora />
      </ConsentimentoDaConta>,
    );

    await waitFor(() => expect(mockReplace).not.toHaveBeenCalledWith('/consentimento'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // E o portão continua a cobrar quem NÃO aceitou: um provedor partilhado que destrancasse
  // sozinho seria pior do que duas cópias.
  it('quem não aceitou continua a ser cobrado', async () => {
    mockSegmentos = ['perfis'];
    await montar();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/consentimento'));
  });

  // ⚠️ E O PROVEDOR ENVOLVE MESMO AS DUAS PEÇAS, NA RAIZ.
  //
  // O teste de comportamento monta a sua própria árvore, e por isso não vê o `_layout`: quem
  // tirasse de lá o provedor partiria o app sem falhar teste nenhum. Aqui a conferência é de
  // posição, no código: o portão e o `Stack` (que é quem desenha a tela de coleta) têm de estar
  // DENTRO dele.
  it('o provedor envolve o portão e as telas, na raiz', () => {
    const layout = fs.readFileSync(path.join(__dirname, '..', '..', 'app', '_layout.tsx'), 'utf8');

    const abre = layout.indexOf('<ConsentimentoDaConta>');
    const fecha = layout.indexOf('</ConsentimentoDaConta>');
    expect(abre).toBeGreaterThan(-1);
    expect(fecha).toBeGreaterThan(abre);

    for (const dentro of ['<PortaoDoConsentimento />', '<Stack ']) {
      const onde = layout.indexOf(dentro);
      expect(onde).toBeGreaterThan(abre);
      expect(onde).toBeLessThan(fecha);
    }
  });

  // ⚠️ E NINGUÉM MAIS ABRE UMA SEGUNDA CÓPIA.
  //
  // O teste de cima prova o comportamento das duas peças que existem hoje. Esta regra lê os
  // ficheiros porque o app cresce: a terceira tela que precisar do estado e chamar o hook direto
  // — em vez do `useConsent` — traz o defeito de volta sem falhar teste nenhum. Cada chamada é
  // uma consulta e um estado SEPARADOS.
  it('só o provedor consulta o estado; o resto lê o `useConsent`', () => {
    const raiz = path.join(__dirname, '..', '..');
    const PROVEDOR = path.join('nucleo', 'ConsentimentoDaConta.tsx');

    const arquivos: string[] = [];
    const varrer = (dir: string) => {
      for (const nome of fs.readdirSync(dir)) {
        const alvo = path.join(dir, nome);
        if (fs.statSync(alvo).isDirectory()) {
          if (nome === '__tests__' || nome === '__mocks__') continue;
          varrer(alvo);
        } else if (/\.tsx?$/.test(nome)) arquivos.push(alvo);
      }
    };
    varrer(raiz);

    // A busca é pelo IMPORT, e não pelo nome solto: o portão explica em comentário por que
    // deixou de chamar o hook, e uma regra que lesse prosa acusaria a própria explicação.
    const IMPORTA = new RegExp(
      String.raw`import\s*\{[^}]*(useEstadoDoConsentimento|ProvedorDoConsentimento)[^}]*\}`
      + String.raw`\s*from\s*'@maestra/core/hooks/useConsent'`,
    );
    const consultam = arquivos
      .filter((a) => IMPORTA.test(fs.readFileSync(a, 'utf8')))
      .map((a) => path.relative(raiz, a));

    expect(consultam).toEqual([PROVEDOR]);
  });
});
