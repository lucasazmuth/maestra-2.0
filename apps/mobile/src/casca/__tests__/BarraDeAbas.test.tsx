import { render, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { COR } from '@maestra/core/constants/design';
import { semDiagnostico } from '@/app/__tests__/fixtures';
import { BarraDeAbas, rodapeDaIlha } from '@/casca/BarraDeAbas';

// A barra é a navegação inteira do app: se um destino sumir dela, ele fica inalcançável, e nada
// mais quebra — nenhum erro, nenhuma tela em branco, só um módulo que deixou de existir para
// quem usa. Foi exatamente assim que os atalhos da tela de diagnóstico já sumiram uma vez.

const mockPush = jest.fn();
let mockCaminho = '/artista/a-2';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockCaminho,
}));

// A barra lê a margem segura do aparelho pra não encostar na barra de gestos. Fora de um
// aparelho, o provedor precisa das medidas na mão — senão o hook levanta.
const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () => render(
  <SafeAreaProvider initialMetrics={MEDIDAS}>
    <BarraDeAbas artista={semDiagnostico} id="a-2" />
  </SafeAreaProvider>,
);

beforeEach(() => {
  mockPush.mockClear();
  mockCaminho = '/artista/a-2';
});

describe('barra de abas', () => {
  it('leva às três abas do dia a dia, mesmo num perfil sem diagnóstico', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    for (const [rotulo, destino] of [
      ['Plano', '/artista/a-2/plano'],
      ['Músicas', '/artista/a-2/catalogo'],
      ['Agenda', '/artista/a-2/agenda'],
    ]) {
      await usuario.press(tela.getByLabelText(rotulo));
      expect(mockPush).toHaveBeenCalledWith(destino);
    }
  });

  it('a primeira célula é a foto do artista e leva à home dele', async () => {
    const tela = await montar();
    await userEvent.setup().press(tela.getByLabelText(`Início de ${semDiagnostico.name}`));
    expect(mockPush).toHaveBeenCalledWith('/artista/a-2');
  });

  it('"Mais" abre a folha com o resto dos módulos e os atalhos do sistema', async () => {
    const tela = await montar();
    expect(tela.queryByText('Marketing')).toBeNull();

    await userEvent.setup().press(tela.getByLabelText('Mais'));

    for (const rotulo of [
      'Diagnóstico REAL', 'Plano estratégico', 'Equipe', 'Marketing', 'Perfis', 'Configurações',
    ]) {
      expect(tela.getByText(rotulo)).toBeTruthy();
    }
  });

  it('a folha fecha ao navegar', async () => {
    const tela = await montar();
    const usuario = userEvent.setup();

    await usuario.press(tela.getByLabelText('Mais'));
    await usuario.press(tela.getByText('Equipe'));

    expect(mockPush).toHaveBeenCalledWith('/artista/a-2/equipe');
    expect(tela.queryByText('Marketing')).toBeNull();
  });

  // Dois itens acesos ao mesmo tempo não dizem qual é a tela atual — a web apaga a aba quando o
  // "Mais" abre, e a barra aqui tem que fazer o mesmo.
  it('com o "Mais" aberto, a aba da tela atual apaga', async () => {
    mockCaminho = '/artista/a-2/plano';
    const tela = await montar();
    const aceso = () => tela.getByText('Plano').props.style.flat().some(
      (e: { color?: string } | undefined) => e?.color === COR.primaria,
    );

    expect(aceso()).toBe(true);
    await userEvent.setup().press(tela.getByLabelText('Mais'));
    expect(aceso()).toBe(false);
  });

  // O cartão erguido tem que ficar ACIMA do fio que separa as células.
  //
  // O fio de uma célula é a borda ESQUERDA dela, então o fio à direita da célula acesa pertence
  // à VIZINHA. Sem empilhamento declarado, o React Native pinta os irmãos na ordem em que foram
  // escritos: a vizinha vem depois e risca a sobra de 4px do cartão. A web resolve com
  // `z-index: 1` em `.mobile-nav-current` (gsap-reference.css:6603) e a portagem perdeu a linha.
  it('a célula acesa se empilha acima do fio da vizinha', async () => {
    mockCaminho = '/artista/a-2/catalogo';
    const tela = await montar();

    const estilo = (rotulo: string) =>
      StyleSheet.flatten(tela.getByLabelText(rotulo).props.style) as {
        zIndex?: number; borderLeftWidth?: number;
      };

    expect(estilo('Músicas').zIndex).toBe(1);
    // A vizinha continua desenhando o fio: o conserto é a ordem, não apagar a linha dela.
    expect(estilo('Agenda').borderLeftWidth).toBe(1);
    expect(estilo('Agenda').zIndex).toBeUndefined();
  });

  // A folga de baixo e a margem segura medem o MESMO espaço vazio. Somar as duas empurrava a
  // ilha para 52pt num aparelho com barra de gestos, e ela ficava boiando longe do rodapé.
  describe('a distância da ilha até a borda de baixo', () => {
    it('num aparelho com barra de gestos, a reserva do sistema É a folga', () => {
      expect(rodapeDaIlha(34)).toBe(34);
    });

    it('sem barra de gestos, quem responde é a folga do desenho', () => {
      expect(rodapeDaIlha(0)).toBe(18);
    });

    it('nunca encosta: uma margem menor que a folga não encolhe a ilha', () => {
      expect(rodapeDaIlha(8)).toBe(18);
    });
  });
});
