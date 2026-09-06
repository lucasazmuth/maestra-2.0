import { usePathname, useRouter } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COR, COR_BARRA, RAIO, SOMBRA } from '@maestra/core/constants/design';
import type { Artist } from '@maestra/core/interfaces/maestra';

import { FotoDoArtista } from '@/casca/FotoDoArtista';
import {
  AgendaIcon, CatalogoIcon, DiagnosticoIcon, EquipeIcon,
  MarketingIcon, MoreIcon, PlanejamentoIcon, PlanoAcaoIcon,
} from '@/icones';

// A ilha de navegação, célula a célula igual à da web.
//
// Espelha o `MobileNav` (`src/components/Layout/components/MobileNav/index.tsx`) e o bloco
// `.task-app.has-mobile-nav` do `gsap-reference.css`, inclusive as decisões que não são óbvias:
//
// · não é uma faixa colada no rodapé, é uma ILHA branca flutuante com folga nos três lados;
// · a célula ativa não muda só de cor: ela se ERGUE como um cartão (4px pra fora em cada lado,
//   com sombra própria) e ganha um ponto azul no canto;
// · a primeira célula é a FOTO do artista, sem rótulo — é o atalho da home e, ao mesmo tempo,
//   quem diz de quem é a tela, já que o cabeçalho no celular não repete o nome;
// · a Nyta NÃO fica aqui: o atalho dela é o botão do cabeçalho;
// · "Mais" abre um painel de duas colunas, com as células no mesmo formato das da ilha.

type Icone = ComponentType<{ size?: number; color?: string }>;
type Item = { icone: Icone; rotulo: string; rota: string };

const ABAS: Item[] = [
  { icone: PlanoAcaoIcon, rotulo: 'Plano', rota: 'plano' },
  { icone: CatalogoIcon, rotulo: 'Músicas', rota: 'catalogo' },
  { icone: AgendaIcon, rotulo: 'Agenda', rota: 'agenda' },
];

const MAIS: Item[] = [
  { icone: DiagnosticoIcon, rotulo: 'Diagnóstico REAL', rota: 'diagnostico' },
  { icone: PlanejamentoIcon, rotulo: 'Plano estratégico', rota: 'perfil' },
  { icone: EquipeIcon, rotulo: 'Equipe', rota: 'equipe' },
  { icone: MarketingIcon, rotulo: 'Marketing', rota: 'marketing' },
];

// Perfis e Configurações NÃO entram aqui: eles moram no menu do sistema, no botão de grade do
// cabeçalho, que agora acompanha todas as telas. Repetidos nos dois lugares, davam duas portas
// para a mesma sala e faziam esta folha falar de conta no meio dos módulos do artista.

/** Altura da ilha (78) + a folga de baixo (18), que é o que o painel "Mais" precisa vencer. */
export const ALTURA_DA_ILHA = 78;
const FOLGA = 18;

/**
 * A distância da ilha até a borda de baixo.
 *
 * NÃO é a folga somada à margem segura: somar as duas conta o mesmo espaço duas vezes. Onde o
 * aparelho tem barra de gestos, o sistema JÁ reserva 34pt ali que nada desenha em cima — essa
 * reserva é a folga. Somar os 18 por cima empurrava a ilha para 52pt e ela ficava boiando longe
 * do rodapé.
 *
 * Onde não há barra de gestos a margem é 0, e aí a folga do desenho é quem responde.
 */
export const rodapeDaIlha = (margemDeBaixo: number) => Math.max(FOLGA, margemDeBaixo);

export const BarraDeAbas = ({ artista, id }: { artista?: Artist; id: string }) => {
  const router = useRouter();
  const caminho = usePathname();
  const margem = useSafeAreaInsets();
  const [maisAberto, setMaisAberto] = useState(false);
  const rodape = rodapeDaIlha(margem.bottom);

  const base = `/artista/${id}`;
  const ativa = (rota: string) => (rota ? caminho.startsWith(`${base}/${rota}`) : caminho === base);
  const maisAtivo = MAIS.some((m) => ativa(m.rota));

  const ir = (rota: string) => {
    setMaisAberto(false);
    router.push(rota ? (`${base}/${rota}` as never) : (base as never));
  };

  /** Uma célula da ilha: ícone em cima, rótulo embaixo. */
  const Celula = ({ item, aceso, primeira }: { item: Item; aceso: boolean; primeira?: boolean }) => {
    const Icone = item.icone;
    return (
      <Pressable
        style={[estilos.celula, !primeira && estilos.comFio, aceso && estilos.celulaAcesa]}
        onPress={() => ir(item.rota)}
        accessibilityRole="button"
        accessibilityState={{ selected: aceso }}
        accessibilityLabel={item.rotulo}
      >
        <Icone size={20} color={aceso ? COR.primaria : COR_BARRA.icone} />
        <Text style={[estilos.rotulo, aceso && estilos.rotuloAceso]}>{item.rotulo}</Text>
        {aceso && <View style={estilos.ponto} />}
      </Pressable>
    );
  };

  const inicioAceso = !maisAberto && ativa('');

  return (
    <>
      {/* O vidro e o painel NÃO estão num `Modal`: um modal cobre a tela inteira, e a ilha
          ficaria escurecida junto. Na web ela continua clara enquanto o painel está aberto (o
          vidro é z-index 119, a barra 120) — é o que diz que a navegação segue ali. Como irmãos
          da ilha, e declarados ANTES dela, a ordem de renderização dá o mesmo empilhamento. */}
      {maisAberto && (
        <Pressable style={estilos.vidro} onPress={() => setMaisAberto(false)} accessibilityLabel="Fechar" />
      )}
      {maisAberto && (
        <View style={[estilos.painel, { bottom: rodape + ALTURA_DA_ILHA + FOLGA }]}>
          {MAIS.map((item, i, todos) => {
            const aceso = ativa(item.rota);
            const Icone = item.icone;
            const ultima = i === todos.length - 1;
            return (
              <Pressable
                key={item.rotulo}
                style={[
                  estilos.celulaDoPainel,
                  // Os fios de grade: nada à direita da segunda coluna nem abaixo da última
                  // linha. E item ímpar sozinho no fim ocupa a largura toda, senão fica órfão.
                  i % 2 === 0 && !ultima && estilos.fioDireito,
                  !ultima && estilos.fioInferior,
                  ultima && i % 2 === 0 && estilos.larguraCheia,
                ]}
                onPress={() => ir(item.rota)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: aceso }}
              >
                <Icone size={20} color={aceso ? COR.primaria : COR_BARRA.icone} />
                <Text style={[estilos.rotulo, estilos.rotuloDoPainel, aceso && estilos.rotuloAceso]}>
                  {item.rotulo}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={[estilos.ilha, { bottom: rodape }]}>
        <Pressable
          style={[estilos.celula, estilos.celulaDaFoto, inicioAceso && estilos.celulaAcesa]}
          onPress={() => ir('')}
          accessibilityRole="button"
          accessibilityState={{ selected: inicioAceso }}
          accessibilityLabel={artista ? `Início de ${artista.name}` : 'Início'}
        >
          <View style={estilos.aroDaFoto}>
            <FotoDoArtista artista={artista} tamanho={32} />
          </View>
          {inicioAceso && <View style={estilos.ponto} />}
        </Pressable>

        {ABAS.map((aba) => (
          // Com o "Mais" aberto é ele quem está em foco: duas células erguidas ao mesmo tempo
          // não dizem qual é a tela atual.
          <Celula key={aba.rota} item={aba} aceso={!maisAberto && ativa(aba.rota)} />
        ))}

        <Pressable
          style={[estilos.celula, estilos.comFio, (maisAberto || maisAtivo) && estilos.celulaAcesa]}
          onPress={() => setMaisAberto((aberto) => !aberto)}
          accessibilityRole="button"
          accessibilityState={{ selected: maisAberto || maisAtivo }}
          accessibilityLabel="Mais"
        >
          <MoreIcon size={20} color={maisAberto || maisAtivo ? COR.primaria : COR_BARRA.icone} />
          <Text style={[estilos.rotulo, (maisAberto || maisAtivo) && estilos.rotuloAceso]}>Mais</Text>
          {(maisAberto || maisAtivo) && <View style={estilos.ponto} />}
        </Pressable>
      </View>
    </>
  );
};

const estilos = StyleSheet.create({
  ilha: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    minHeight: ALTURA_DA_ILHA,
    padding: 7,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COR_BARRA.contornoDaIlha,
    backgroundColor: COR_BARRA.ilha,
    ...SOMBRA.ilha,
  },
  celula: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4 },
  comFio: { borderLeftWidth: 1, borderLeftColor: COR_BARRA.fio },
  // Erguida: 4px pra fora em cada lado, com sombra e fundo próprios — é o cartão que a web
  // desenha com `margin: -4px`. O fio da esquerda some, senão ele cruzaria o cartão.
  //
  // O `zIndex` é o mesmo `z-index: 1` da web (`.mobile-nav-current`, gsap-reference.css:6603) e
  // não é enfeite: sem ele o React Native pinta os irmãos na ordem em que foram declarados, e a
  // célula SEGUINTE desenha o fio dela depois — em cima da sobra de 4px do cartão. O fio da
  // esquerda desta célula a gente apaga; o da direita pertence à vizinha, e só a ordem de
  // empilhamento resolve.
  celulaAcesa: {
    zIndex: 1,
    minHeight: 72,
    margin: -4,
    borderRadius: 18,
    borderLeftWidth: 0,
    backgroundColor: COR.superficie,
    ...SOMBRA.celulaAtiva,
  },
  celulaDaFoto: { borderTopLeftRadius: 17, borderBottomLeftRadius: 17 },
  aroDaFoto: {
    padding: 3,
    borderRadius: RAIO.pilula,
    backgroundColor: COR.superficie,
    ...SOMBRA.fotoDaIlha,
  },
  rotulo: { color: COR_BARRA.item, fontSize: 10, fontWeight: '800', lineHeight: 12 },
  rotuloAceso: { color: COR.primaria },
  ponto: {
    position: 'absolute',
    top: 13,
    right: 17,
    width: 7,
    height: 7,
    borderRadius: RAIO.pilula,
    backgroundColor: COR.primaria,
  },

  // A barra vive no rodapé, então o vidro precisa subir muito além dela pra cobrir a tela. A
  // altura é generosa de propósito: não há como medir a tela daqui sem outro hook, e sobrar
  // não custa nada (ele é absoluto e não empurra ninguém).
  vidro: {
    position: 'absolute',
    left: -22,
    right: -22,
    bottom: -200,
    top: -2000,
    backgroundColor: COR_BARRA.vidro,
  },
  painel: {
    // 12 de cada lado, o mesmo do menu do sistema — as duas folhas são a mesma peça e larguras
    // diferentes faziam parecer que uma delas estava fora de lugar.
    position: 'absolute',
    right: 12,
    left: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COR_BARRA.contornoDoPainel,
    backgroundColor: COR.superficie,
    ...SOMBRA.painel,
  },
  celulaDoPainel: {
    width: '50%',
    minHeight: 74,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  larguraCheia: { width: '100%' },
  fioDireito: { borderRightWidth: 1, borderRightColor: COR_BARRA.fio },
  fioInferior: { borderBottomWidth: 1, borderBottomColor: COR_BARRA.fio },
  rotuloDoPainel: { textAlign: 'center', lineHeight: 12 },
});
