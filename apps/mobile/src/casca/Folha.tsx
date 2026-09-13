import { ReactNode } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COR, RAIO, SOMBRA_DO_BOTAO } from '@maestra/core/constants/design';

import { PALETA_CLARA, usePaleta } from '@/casca/paleta';

import { useAlturaDoTeclado } from '@/nucleo/teclado';

import { BotaoRedondo } from './marca/MenuDoSistema';

// A FOLHA: a forma única de toda tela que sobe por cima de outra.
//
// Antes disto cada módulo desenhava a sua. Quinze modais, cinco jeitos de aparecer, três de
// fechar, e o mesmo "x" saindo em seis cores porque cada arquivo puxava da paleta do próprio
// módulo. A Agenda salvava pelo topo e chamava a saída de "Cancelar"; a Música salvava pelo
// rodapé e fechava no "x". Quem criava um compromisso e depois uma música reaprendia a tela.
//
// Nada disso era decisão: era o resultado de não existir onde escrever a decisão uma vez.
//
// ─── O que a forma diz ───────────────────────────────────────────────────────
//
// O CÍRCULO BRANCO À ESQUERDA FECHA. É o `BotaoRedondo`, o mesmo controle da marca, do sino, do
// menu do sistema e da faixa do chat. Uma folha que inventasse o próprio botão de fechar seria a
// única tela do app com um controle que não existe em nenhuma outra.
//
// O TÍTULO É CENTRADO, e sozinho. O sobretítulo em caixa alta ("AGENDA", "MÚSICA", "TAREFA")
// saiu: ele repetia o módulo de onde a pessoa tinha acabado de sair, e "Novo compromisso" já diz
// o que a tela é.
//
// A AÇÃO FICA NO RODAPÉ, sempre. É o polegar quem alcança, e é onde o resto do app já a põe.
//
// O AZUL É NOSSO. A referência de desenho que originou esta folha usa preto na ação primária; o
// preto é a assinatura de outra marca. Aqui a ação é `COR.primaria`.

export const Folha = ({
  aberta, titulo, aoFechar, acao, destrutiva, direita, children, semRolagem,
}: {
  aberta: boolean;
  titulo: string;
  aoFechar: () => void;
  /** A ação primária, no rodapé. Sem ela o rodapé não existe. */
  acao?: { rotulo: string; aoTocar: () => void; carregando?: boolean; desabilitada?: boolean };
  /** A ação destrutiva, à esquerda da primária. Só aparece quando faz sentido (editar, nunca criar). */
  destrutiva?: { rotulo: string; aoTocar: () => void };
  /** Um segundo controle circular, à direita do título. Mesmo lugar do "i" da referência. */
  direita?: ReactNode;
  /** Para quem já tem a própria lista rolável dentro (abas, FlatList). */
  semRolagem?: boolean;
  children: ReactNode;
}) => {
  const margem = useSafeAreaInsets();
  const teclado = useAlturaDoTeclado();
  // ⚠️ O CASCO TAMBÉM SE TINGE. Eu tinha deixado o topo e o rodapé sempre claros, com o
  // argumento de que uma folha que sobe de baixo é do app claro — e no editor o resultado foi
  // uma barra branca de cabeçalho por cima de um corpo quase preto, com o título em azul-marinho
  // no meio. Tinge-se o que É a folha (fundo, topo, título, fio); o que continua igual nos dois
  // é a AÇÃO do rodapé, que é a primária da marca em ambos.
  const paleta = usePaleta();

  const corpo = semRolagem
    ? <View style={estilos.corpoSemRolagem}>{children}</View>
    : (
      <ScrollView
        contentContainerStyle={estilos.corpo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );

  return (
    <Modal
      visible={aberta}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={aoFechar}
    >
      {/* A altura do teclado é reservada AQUI, embaixo do container inteiro, em vez de por um
          `KeyboardAvoidingView`. Ver `useAlturaDoTeclado`: dentro de um `pageSheet` o KAV calcula
          o empurrão a partir da janela, erra por conta do recuo do topo da folha, e o rodapé
          termina atrás das teclas. */}
      <View style={[estilos.folha, { backgroundColor: paleta.fundo, paddingBottom: teclado }]}>
        <View style={estilos.topo}>
          {/* O círculo do `BotaoRedondo` traz o fundo claro do menu do sistema; na paleta
              escura ele seria uma bolha branca. Quando a folha está tingida, o botão é daqui. */}
          {paleta === PALETA_CLARA ? (
            <BotaoRedondo rotulo="Fechar" aoTocar={aoFechar}>
              <Feather name="x" size={20} color={paleta.texto} />
            </BotaoRedondo>
          ) : (
            <Pressable
              style={[estilos.fecharTingido, { backgroundColor: paleta.destaque }]}
              onPress={aoFechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Feather name="x" size={18} color={paleta.texto} />
            </Pressable>
          )}

          {/* O título ocupa o meio e é o único elemento que pode crescer: os dois círculos têm
              largura fixa, então ele fica centrado na tela mesmo sem o da direita existir. */}
          <Text style={[estilos.titulo, { color: paleta.titulo }]} numberOfLines={1}>{titulo}</Text>

          <View style={estilos.direita}>{direita}</View>
        </View>

        {corpo}

        {/* A margem de baixo do rodapé só existe enquanto a barra de gestos do aparelho está à
            mostra. Com o teclado aberto quem ocupa aquele lugar é o próprio teclado, e manter a
            margem empurrava a ação para debaixo das teclas. Mesma regra do campo do chat da Nyta. */}
        {!!acao && (
          <View style={[
            estilos.rodape,
            { backgroundColor: paleta.papel, borderTopColor: paleta.divisoria },
            { paddingBottom: teclado ? 12 : Math.max(margem.bottom, 14) },
          ]}>
            {!!destrutiva && (
              <Pressable
                style={estilos.destrutiva}
                onPress={destrutiva.aoTocar}
                accessibilityRole="button"
                accessibilityLabel={destrutiva.rotulo}
              >
                <Text style={estilos.destrutivaTexto}>{destrutiva.rotulo}</Text>
              </Pressable>
            )}
            <Pressable
              style={[estilos.acao, (acao.desabilitada || acao.carregando) && estilos.acaoInerte]}
              onPress={acao.aoTocar}
              disabled={acao.desabilitada || acao.carregando}
              accessibilityRole="button"
              accessibilityLabel={acao.rotulo}
              accessibilityState={{ disabled: !!(acao.desabilitada || acao.carregando) }}
            >
              {acao.carregando
                ? <ActivityIndicator size="small" color={COR.sobrePrimaria} />
                : <Text style={estilos.acaoTexto}>{acao.rotulo}</Text>}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
};

/**
 * O bloco branco que agrupa linhas, com o rótulo de seção em cima.
 *
 * É o cartão da referência: o conteúdo não flutua solto sobre o cinza, ele mora em blocos, e o
 * rótulo diz do que aquele grupo trata. Sem isso a folha vira uma lista longa sem hierarquia.
 */
// ⚠️ O BLOCO E A LINHA TIRAM TRÊS CORES DA PALETA EM VIGOR, e não a folha inteira: o casco da
// `Folha` (o topo, o rodapé, os botões) só existe quando ela é uma folha que sobe de baixo, e
// essa é sempre clara. Escuros são apenas os blocos, quando os mesmos campos são montados dentro
// do editor — ver `casca/paleta.ts`.
export const Bloco = ({ rotulo, children }: { rotulo?: string; children: ReactNode }) => {
  const dentro = usePaleta();
  return (
    <View style={estilos.grupo}>
      {!!rotulo && <Text style={[estilos.rotuloDoGrupo, { color: dentro.rotulo }]}>{rotulo}</Text>}
      <View style={[estilos.bloco, { backgroundColor: dentro.papel }]}>{children}</View>
    </View>
  );
};

/**
 * Uma linha dentro do bloco.
 *
 * A divisória é RECUADA e desenhada pela linha DE BAIXO, não pela de cima: assim a última não
 * precisa saber que é a última, e o bloco não precisa clonar os filhos para dizer a ela.
 */
export const Linha = ({ children, primeira }: { children: ReactNode; primeira?: boolean }) => {
  const dentro = usePaleta();
  return (
    <View style={[
      estilos.linha,
      !primeira && estilos.linhaComFio,
      !primeira && { borderTopColor: dentro.divisoria },
    ]}>
      {children}
    </View>
  );
};

const estilos = StyleSheet.create({
  folha: { flex: 1, backgroundColor: COR.fundo },

  topo: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
  },
  titulo: {
    flex: 1, textAlign: 'center',
    fontSize: 18, fontWeight: '800', color: COR.titulo,
  },
  fecharTingido: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
  },
  // Reserva a mesma largura do botão da esquerda mesmo quando não há nada à direita. Sem ela o
  // título centraria no espaço que sobra, e não na tela.
  direita: { width: 42, alignItems: 'flex-end' },

  corpo: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28, gap: 22 },
  corpoSemRolagem: { flex: 1, minHeight: 0 },

  grupo: { gap: 8 },
  rotuloDoGrupo: {
    paddingLeft: 4,
    fontSize: 13, fontWeight: '600', color: COR.apagado,
  },
  bloco: {
    borderRadius: RAIO.cartao,
    backgroundColor: COR.superficie,
    overflow: 'hidden',
    // A MESMA sombra dos botões redondos do topo. O bloco e os controles ficam lado a lado nesta
    // tela; com elevações diferentes, um dos dois pareceria de outra camada.
    ...SOMBRA_DO_BOTAO,
  },
  linha: { paddingHorizontal: 16, paddingVertical: 14 },
  linhaComFio: { borderTopWidth: 1, borderTopColor: COR.divisoria },

  rodape: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COR.divisoria,
    backgroundColor: COR.superficie,
  },
  acao: {
    flex: 1, height: 50, alignItems: 'center', justifyContent: 'center',
    borderRadius: RAIO.pilula, backgroundColor: COR.primaria,
  },
  acaoInerte: { opacity: 0.55 },
  acaoTexto: { fontSize: 15, fontWeight: '700', color: COR.sobrePrimaria },
  destrutiva: {
    height: 50, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
    borderRadius: RAIO.pilula, borderWidth: 1, borderColor: COR.contorno,
    backgroundColor: COR.superficie,
  },
  destrutivaTexto: { fontSize: 15, fontWeight: '700', color: COR.erro },
});
