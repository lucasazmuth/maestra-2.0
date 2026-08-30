import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PERFIS } from '@maestra/core/constants/design';

import { PerfisIcon } from '@/icones';

// O menu do sistema — o painel que o botão de grade abre no topo da web.
//
// A grade é de DUAS colunas com fios finos, ícone em cima e rótulo embaixo: é a mesma célula do
// "Mais" da barra de abas, e a web usa as duas com o mesmo desenho de propósito.
//
// As telas de /admin não entram: elas não existem no app, e um item que leva a lugar nenhum é
// pior do que a ausência dele. Quem administra a plataforma faz isso na web — e o menu de lá
// continua mostrando as dez entradas para quem tem acesso.

export interface ItemDoMenu {
  rotulo: string;
  icone: React.ReactNode;
  aoTocar: () => void;
  ativo?: boolean;
  perigo?: boolean;
}

export const MenuDoSistema = ({ aberto, itens, aoFechar }: {
  aberto: boolean;
  itens: ItemDoMenu[];
  aoFechar: () => void;
}) => (
  <Modal visible={aberto} animationType="fade" transparent onRequestClose={aoFechar}>
    <Pressable style={estilos.fundo} onPress={aoFechar} accessibilityLabel="Fechar o menu" />
    <View style={estilos.painel}>
      <ScrollView contentContainerStyle={estilos.grade}>
        {itens.map((item, indice) => {
          const naSegundaColuna = indice % 2 === 1;
          const naUltimaLinha = indice >= itens.length - (itens.length % 2 === 0 ? 2 : 1);
          const sozinhoNaLinha = indice === itens.length - 1 && itens.length % 2 === 1;
          return (
            <Pressable
              key={item.rotulo}
              style={[
                estilos.celula,
                sozinhoNaLinha && estilos.celulaInteira,
                !naSegundaColuna && !sozinhoNaLinha && estilos.comFioAoLado,
                !naUltimaLinha && estilos.comFioEmbaixo,
              ]}
              onPress={() => { aoFechar(); item.aoTocar(); }}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: item.ativo }}
              accessibilityLabel={item.rotulo}
            >
              <View style={estilos.icone}>{item.icone}</View>
              <Text style={[
                estilos.rotulo,
                item.ativo && estilos.rotuloAtivo,
                item.perigo && estilos.rotuloPerigo,
              ]}>
                {item.rotulo}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  </Modal>
);

/** Os itens que o app tem — os mesmos rótulos e ícones da web. */
export const itensDoSistema = (
  acoes: { perfis: () => void; configuracoes: () => void; suporte: () => void; sair: () => void },
  aqui?: 'perfis' | 'configuracoes',
): ItemDoMenu[] => [
  {
    rotulo: 'Perfis',
    icone: <PerfisIcon size={22} color={COR_PERFIS.painelIcone} />,
    aoTocar: acoes.perfis,
    ativo: aqui === 'perfis',
  },
  {
    rotulo: 'Configurações',
    icone: <Feather name="settings" size={22} color={COR_PERFIS.painelIcone} />,
    aoTocar: acoes.configuracoes,
    ativo: aqui === 'configuracoes',
  },
  {
    rotulo: 'Suporte',
    icone: <Feather name="life-buoy" size={22} color={COR_PERFIS.painelIcone} />,
    aoTocar: acoes.suporte,
  },
  {
    rotulo: 'Sair da conta',
    icone: <Feather name="log-out" size={22} color={COR_PERFIS.painelIcone} />,
    aoTocar: acoes.sair,
    perigo: true,
  },
];

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(20, 30, 55, .25)' },
  painel: {
    position: 'absolute', top: 96, right: 12, left: 12,
    maxHeight: '70%', padding: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COR_PERFIS.painelContorno, backgroundColor: COR.superficie,
    shadowColor: 'rgba(83, 105, 149, .18)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 18 }, shadowRadius: 44, elevation: 12,
  },
  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  celula: {
    width: '50%', minHeight: 74, paddingVertical: 8, paddingHorizontal: 6, gap: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  celulaInteira: { width: '100%' },
  comFioAoLado: { borderRightWidth: 1, borderRightColor: COR_PERFIS.painelFio },
  comFioEmbaixo: { borderBottomWidth: 1, borderBottomColor: COR_PERFIS.painelFio },
  icone: { alignItems: 'center', justifyContent: 'center' },
  rotulo: {
    fontSize: 10, fontWeight: '800', lineHeight: 12, textAlign: 'center',
    color: COR_PERFIS.painelRotulo,
  },
  rotuloAtivo: { color: COR.primaria },
  rotuloPerigo: { color: COR.erro },
});

/** O botão redondo do topo: círculo branco de 42 com sombra baixa. */
export const BotaoRedondo = ({ children, aoTocar, rotulo, marca }: {
  children: React.ReactNode;
  aoTocar: () => void;
  rotulo: string;
  marca?: boolean;
}) => (
  <Pressable
    style={estilosDoBotao.botao}
    onPress={aoTocar}
    accessibilityRole="button"
    accessibilityLabel={rotulo}
  >
    {children}
    {marca && <View style={estilosDoBotao.marca} />}
  </Pressable>
);

const estilosDoBotao = StyleSheet.create({
  botao: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_PERFIS.controle,
    shadowColor: 'rgba(98, 112, 143, .07)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 3,
  },
  // O ponto de não-lidas: ROSA e SEM número, no canto do sino — a contagem vive no rótulo de
  // acessibilidade. O app mostrava um balão vermelho com "2", que a web não tem.
  marca: {
    position: 'absolute', top: 0, right: 7,
    width: 10, height: 10, borderRadius: 5, backgroundColor: COR_PERFIS.naoLidas,
    borderWidth: 2, borderColor: COR.fundo,
  },
});
