import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR_EDITOR } from '@maestra/core/constants/design';

import type { ArquivoEscolhido } from '@/nucleo/arquivos';

// A BIBLIOTECA: os ficheiros do aparelho, antes de serem nossos.
//
// ─── Por que uma lista antes de enviar, e não o envio direto ─────────────────
//
// Escolher doze stems e ver os doze subirem é o caminho errado por dois motivos: paga-se
// armazenamento e egress por tudo o que entrou, inclusive o que a pessoa nem ia usar; e
// enche-se a montagem de faixas que ninguém pediu. Aqui o ficheiro fica na lista, do lado de
// cá, e só sobe quando alguém o manda para a montagem.
//
// ⚠️ NO TELEMÓVEL ELA É UMA GAVETA, e não uma coluna: 256 pt de coluna fixa são 68 % de um ecrã
// de 402, sobrando um terço para a montagem inteira. Aqui ela dorme fora da tela e entra por
// cima quando alguém a chama — a mesma biblioteca, sem ocupar o sítio de quem trabalha. É
// exatamente o que a web faz abaixo de 768 px.
//
// ⚠️ E O TOQUE É QUE ENVIA. Na web de computador arrasta-se um ficheiro da lista para uma
// faixa; num painel que TAPA as faixas, "arraste para uma faixa" não descreve gesto nenhum — e
// o dedo não arrasta entre janelas. A mesma decisão que a gaveta da web já tinha tomado.

const emMegabytes = (bytes?: number) => `${((bytes ?? 0) / 1024 / 1024).toFixed(1)} MB`;

export const Biblioteca = ({
  itens, podeEditar, aoEscolher, aoEnviar, aoEnviarTodos, aoMontar, aoFechar,
}: {
  itens: ArquivoEscolhido[];
  podeEditar: boolean;
  /** Abre o seletor do sistema e enche a lista. */
  aoEscolher: () => void;
  /** Manda UM ficheiro para a montagem, como faixa nova. */
  aoEnviar: (arquivo: ArquivoEscolhido) => void;
  aoEnviarTodos: () => void;
  /** Só aparece quando a gravação ainda não foi montada em faixas. */
  aoMontar?: () => void;
  aoFechar: () => void;
}) => (
  <View style={estilos.gaveta}>
    {/* Na gaveta o título vive no cabeçalho dela, ao lado do X — como na web. */}
    <View style={estilos.cabecalho}>
      <Text style={estilos.titulo}>Biblioteca</Text>
      <Pressable
        onPress={aoFechar}
        style={estilos.redondo}
        accessibilityRole="button"
        accessibilityLabel="Fechar a biblioteca"
      >
        <Feather name="x" size={14} color={COR_EDITOR.texto} />
      </Pressable>
    </View>

    <ScrollView contentContainerStyle={estilos.corpo}>
      {/* ⚠️ UM BOTÃO SÓ, e não dois. A web tem "Abrir pasta" e "Escolher arquivos" porque o
          navegador sabe entregar uma PASTA inteira (`webkitdirectory`). O iOS não entrega
          pastas — entrega ficheiros, quantos se quiser. Um botão que abrisse o mesmo seletor
          com outro nome seria dois caminhos para o mesmo sítio. */}
      <Pressable
        onPress={aoEscolher}
        disabled={!podeEditar}
        style={[estilos.botaoCheio, !podeEditar && estilos.inerte]}
        accessibilityRole="button"
        accessibilityLabel="Escolher arquivos do aparelho"
      >
        <Feather name="upload-cloud" size={14} color={COR_EDITOR.texto} />
        <Text style={estilos.botaoTexto}>Escolher arquivos</Text>
      </Pressable>

      {itens.length === 0 ? (
        <Text style={estilos.vazio}>
          Escolha arquivos para vê-los aqui. Nada sobe para a nuvem enquanto você não mandar um
          deles para a montagem.
        </Text>
      ) : (
        <>
          <Text style={estilos.dica}>Toque num arquivo para enviá-lo como faixa.</Text>

          <View style={estilos.lista}>
            {itens.map((item) => (
              <Pressable
                key={item.uri}
                onPress={() => aoEnviar(item)}
                disabled={!podeEditar}
                style={estilos.item}
                accessibilityRole="button"
                // O rótulo é dito à mão: o conteúdo do item é o nome MAIS o tamanho, e um leitor
                // de tela anunciaria "Bateria.wav 1.0 MB" — o tamanho não é a ação.
                accessibilityLabel={`Enviar ${item.nome} como faixa`}
              >
                <Feather name="music" size={13} color={COR_EDITOR.rotulo} />
                <Text style={estilos.nome} numberOfLines={1}>{item.nome}</Text>
                <Text style={estilos.tamanho}>{emMegabytes(item.tamanho)}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={aoEnviarTodos}
            disabled={!podeEditar}
            style={[estilos.botaoVazado, !podeEditar && estilos.inerte]}
            accessibilityRole="button"
            accessibilityLabel="Enviar todos como faixas"
          >
            <Text style={estilos.botaoVazadoTexto}>Enviar todos como faixas</Text>
          </Pressable>
        </>
      )}

      {!!aoMontar && (
        <Pressable
          onPress={aoMontar}
          style={estilos.botaoVazado}
          accessibilityRole="button"
          accessibilityLabel="Montar em faixas"
        >
          <Text style={estilos.botaoVazadoTexto}>Montar em faixas</Text>
        </Pressable>
      )}

      {/* A queixa nº 1 do suporte, respondida antes de acontecer. */}
      <Text style={estilos.rodape}>
        WAV para sincronia exata. Stems em MP3 só alinham entre si se saíram do mesmo programa:
        cada codificador acrescenta um silêncio de alguns milissegundos no início.
      </Text>
    </ScrollView>
  </View>
);

const estilos = StyleSheet.create({
  // Por cima da montagem, e não ao lado: `inset 0` dentro do corpo do editor.
  gaveta: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30,
    backgroundColor: COR_EDITOR.painel,
  },
  cabecalho: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: COR_EDITOR.fio,
  },
  titulo: { fontSize: 13, fontWeight: '700', color: COR_EDITOR.texto },
  redondo: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_EDITOR.botaoRedondo,
  },

  corpo: { padding: 16, gap: 10 },
  botaoCheio: {
    height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 6, borderWidth: 1, borderColor: COR_EDITOR.fio,
    backgroundColor: COR_EDITOR.cabecaDaVersao,
  },
  botaoTexto: { fontSize: 13, color: COR_EDITOR.texto },
  inerte: { opacity: 0.5 },

  vazio: { fontSize: 11, lineHeight: 18, color: COR_EDITOR.rotulo },
  dica: { fontSize: 11, color: COR_EDITOR.rotulo },

  lista: { gap: 6 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    // Alvo de dedo: 8 pt de recuo davam 30 de altura, abaixo de qualquer mínimo confortável
    // para tocar numa lista.
    minHeight: 44, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 6, borderWidth: 1, borderColor: COR_EDITOR.fio,
    backgroundColor: COR_EDITOR.cabecaDaVersao,
  },
  nome: { flex: 1, minWidth: 0, fontSize: 12, color: COR_EDITOR.texto },
  tamanho: { fontSize: 10, color: COR_EDITOR.rotulo, fontVariant: ['tabular-nums'] },

  botaoVazado: {
    height: 34, alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, borderWidth: 1, borderColor: COR_EDITOR.vazioContorno,
  },
  botaoVazadoTexto: { fontSize: 12, color: COR_EDITOR.apoio },

  rodape: { marginTop: 12, fontSize: 10, lineHeight: 16, color: COR_EDITOR.rotulo },
});
