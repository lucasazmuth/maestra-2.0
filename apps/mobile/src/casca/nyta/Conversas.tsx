import { useState } from 'react';
import {
  Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import { COR_CONVERSAS, COR_NYTA, RAIO } from '@maestra/core/constants/design';
import type { NytaConversationSummary } from '@maestra/core/hooks/useNytaConversations';
import { dataDaConversa } from '@maestra/core/nucleo/dataDaConversa';

import { BotaoRedondo } from '@/casca/marca/MenuDoSistema';
import { Carregando } from '@/casca/Carregando';

// O histórico de conversas — a porta de `ConversationSidebar`.
//
// Na web é uma coluna ao lado; abaixo de 900px ela some e vira o nível de trás da conversa. No
// celular só existe essa segunda forma, então aqui a lista É a tela: a conversa fica por cima, e
// o "voltar" do cabeçalho do chat traz de volta pra cá.
//
// A tela antiga da web tinha uma lista com este mesmo nome, mas era enfeite: o banco guardava
// uma conversa por artista (havia um UNIQUE), então o único item sempre levava ao mesmo lugar.
// Hoje são conversas de verdade — por isso renomear e excluir precisam existir.

/**
 * Uma linha da lista.
 *
 * No escopo do MÓDULO, e não dentro de `Conversas`: um componente declarado dentro de outro é
 * uma referência nova a cada render do pai, e o React desmonta e remonta a subárvore inteira.
 * Aqui isso tinha efeito visível — ao renomear, cada tecla digitada mudava o estado do pai,
 * remontava o campo e fechava o teclado.
 */
const LinhaDaConversa = ({
  conversa, acesa, editando, rascunho, aoDigitar, aoGravar, aoAbrir, aoPedirAcoes,
}: {
  conversa: NytaConversationSummary;
  acesa: boolean;
  editando: boolean;
  rascunho: string;
  aoDigitar: (texto: string) => void;
  aoGravar: () => void;
  aoAbrir: () => void;
  aoPedirAcoes: () => void;
}) => {
  if (editando) {
    return (
      <View style={estilos.item}>
        <TextInput
          style={estilos.renomear}
          value={rascunho}
          onChangeText={aoDigitar}
          autoFocus
          maxLength={80}
          onBlur={aoGravar}
          onSubmitEditing={aoGravar}
          returnKeyType="done"
          accessibilityLabel="Nome da conversa"
        />
      </View>
    );
  }

  return (
    <View style={[estilos.item, acesa && estilos.itemAceso]}>
      <Pressable
        style={estilos.abrir}
        onPress={aoAbrir}
        accessibilityRole="button"
        accessibilityState={{ selected: acesa }}
        // "Abrir conversa: X", e não só o título: o botão `+` do cabeçalho já se chama "Nova
        // conversa", e uma conversa ainda sem título se chamaria igual — dois controles com o
        // mesmo nome na mesma tela, indistinguíveis para quem usa leitor de tela.
        accessibilityLabel={`Abrir conversa: ${conversa.title || 'Nova conversa'}`}
      >
        <Text style={[estilos.nome, acesa && estilos.nomeAceso]} numberOfLines={1}>
          {conversa.title || 'Nova conversa'}
        </Text>
        <Text style={estilos.hora}>{dataDaConversa(conversa.updatedAt)}</Text>
      </Pressable>

      {/* Na web as ações vivem num menu que aparece no hover. Sem hover no celular, o botão fica
          sempre visível e abre a mesma escolha de renomear ou excluir. */}
      <Pressable
        style={estilos.mais}
        onPress={aoPedirAcoes}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Ações da conversa ${conversa.title || 'sem título'}`}
      >
        <Feather name="more-horizontal" size={17} color={COR_CONVERSAS.rotulo} />
      </Pressable>
    </View>
  );
};

export const Conversas = ({
  conversas, carregando, ativa, aoEscolher, aoCriar, aoRenomear, aoExcluir, aoSair,
}: {
  conversas: NytaConversationSummary[];
  carregando: boolean;
  ativa: string | null;
  aoEscolher: (id: string) => void;
  aoCriar: () => void;
  aoRenomear: (id: string, titulo: string) => void;
  aoExcluir: (id: string) => void;
  aoSair: () => void;
}) => {
  const margem = useSafeAreaInsets();
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');

  const gravarNome = () => {
    if (editando && rascunho.trim()) aoRenomear(editando, rascunho);
    setEditando(null);
  };

  // Excluir apaga as mensagens junto (ON DELETE CASCADE), então não pode agir no toque.
  const confirmarExclusao = (conversa: NytaConversationSummary) => {
    Alert.alert(
      'Excluir conversa?',
      'As mensagens desta conversa serão apagadas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => aoExcluir(conversa.id) },
      ],
    );
  };

  const acoes = (conversa: NytaConversationSummary) => {
    Alert.alert(
      conversa.title || 'Nova conversa',
      undefined,
      [
        {
          text: 'Renomear',
          onPress: () => { setRascunho(conversa.title || ''); setEditando(conversa.id); },
        },
        { text: 'Excluir', style: 'destructive', onPress: () => confirmarExclusao(conversa) },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  return (
    <View style={estilos.tela}>
      {/* A MESMA faixa do chat: a margem do aparelho, os círculos brancos do sistema e o
          título no meio. Ela não tinha recuo de cima nenhum, porque o cabeçalho do artista
          ficava acima desta tela e empurrava tudo para baixo. Quando a rota da Nyta passou a
          esconder aquele cabeçalho, o "voltar" foi parar embaixo da ilha dinâmica — visível,
          e intocável. */}
      <View style={[estilos.cabecalho, { paddingTop: margem.top + 6 }]}>
        <BotaoRedondo rotulo="Voltar para o perfil" aoTocar={aoSair}>
          <Feather name="arrow-left" size={21} color={COR_CONVERSAS.botao} />
        </BotaoRedondo>
        <Text style={estilos.titulo}>Conversas</Text>
        <BotaoRedondo rotulo="Nova conversa" aoTocar={aoCriar}>
          <Feather name="plus" size={21} color={COR_CONVERSAS.botao} />
        </BotaoRedondo>
      </View>

      {/* Conversa nova ainda sem id: a lista não tem o que destacar, então o rascunho segura o
          lugar até a primeira mensagem criar a linha no banco. */}
      {ativa === null && <Text style={estilos.rascunho}>Nova conversa</Text>}

      {carregando && conversas.length === 0 ? (
        <Carregando estilo={estilos.carregando} />
      ) : conversas.length === 0 ? (
        <Text style={estilos.vazio}>Suas conversas com a Nyta aparecem aqui.</Text>
      ) : (
        <FlatList
          data={conversas}
          // `extraData` porque a linha depende de estado que vive AQUI FORA (qual está em
          // edição, e o texto digitado). O FlatList compara os itens por identidade: sem isto,
          // a linha em edição fica congelada no nome antigo enquanto se digita o novo.
          extraData={`${ativa}|${editando}|${rascunho}`}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <LinhaDaConversa
              conversa={item}
              acesa={item.id === ativa}
              editando={editando === item.id}
              rascunho={rascunho}
              aoDigitar={setRascunho}
              aoGravar={gravarNome}
              aoAbrir={() => aoEscolher(item.id)}
              aoPedirAcoes={() => acoes(item)}
            />
          )}
          // 122px reservavam a ilha de navegação. Nesta rota ela não é desenhada (ver
          // `artista/[id]/_layout.tsx`), e a reserva virava um vão morto no fim da lista.
          contentContainerStyle={[estilos.lista, { paddingBottom: 24 + margem.bottom }]}
        />
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR_NYTA.cartao },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COR_CONVERSAS.fio,
  },
  redondo: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RAIO.pilula,
    borderWidth: 1,
    borderColor: COR_CONVERSAS.contorno,
  },
  // Centrado e no mesmo peso do nome do artista na faixa do chat: as duas telas são a mesma
  // faixa com conteúdos diferentes, e um rótulo em caixa alta fazia parecerem de épocas
  // diferentes do produto.
  titulo: { flex: 1, color: COR_CONVERSAS.botao, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  novo: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COR_CONVERSAS.contorno,
  },
  rascunho: {
    margin: 8,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COR_CONVERSAS.rascunhoContorno,
    color: COR_CONVERSAS.destaqueTexto,
    fontSize: 12,
    fontWeight: '700',
  },
  vazio: { padding: 16, color: COR_CONVERSAS.rotulo, fontSize: 12, lineHeight: 18 },
  carregando: { marginTop: 24 },
  lista: { padding: 8 },
  item: { flexDirection: 'row', alignItems: 'center', borderRadius: 9 },
  itemAceso: { backgroundColor: COR_CONVERSAS.destaque },
  abrir: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 9, paddingLeft: 10, paddingRight: 4 },
  nome: { color: COR_CONVERSAS.nome, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  nomeAceso: { color: COR_CONVERSAS.destaqueTexto, fontWeight: '800' },
  hora: { color: COR_CONVERSAS.hora, fontSize: 10, fontWeight: '700' },
  mais: {
    width: 26,
    height: 26,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  renomear: {
    flex: 1,
    marginVertical: 6,
    marginLeft: 8,
    marginRight: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COR_CONVERSAS.renomearContorno,
    color: COR_CONVERSAS.destaqueTexto,
    fontSize: 12,
    fontWeight: '700',
  },
});
