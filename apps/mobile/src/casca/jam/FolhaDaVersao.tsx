import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM, RAIO } from '@maestra/core/constants/design';
import type { CatalogVersion } from '@maestra/core/interfaces/maestra';
import { tituloDoArquivo } from '@maestra/core/services/armazenamento';
import * as catalogo from '@maestra/core/services/db/catalog';

import { enviarParaOCatalogo, escolherAudio, type ArquivoEscolhido } from '@/nucleo/arquivos';

// A folha da VERSÃO (a gravação), irmã da ficha da música.
//
// A versão é só isto: um nome que a equipe reconheça ("guia vocal", "mix v2"), o arquivo e a
// marca de qual é a principal — os mesmos três campos do `VersionModal` da web. Serve pra
// enviar e pra editar: a diferença é existir ou não `versao`.

export const FolhaDaVersao = ({
  aberta, artistaId, projetoId, nomeDoProjeto, versao, proximoNumero, ehPrincipal,
  herdar, autor, arquivoInicial, aoFechar, aoSalvar, aoExcluir,
}: {
  aberta: boolean;
  artistaId: string;
  projetoId: string;
  nomeDoProjeto: string;
  versao?: CatalogVersion | null;
  proximoNumero?: number;
  ehPrincipal?: boolean;
  herdar?: { bpm?: string | null; key?: string | null; genre?: string | null };
  autor: { id?: string | null; nome?: string | null; foto?: string | null };
  arquivoInicial?: ArquivoEscolhido | null;
  aoFechar: () => void;
  aoSalvar: () => void | Promise<void>;
  aoExcluir?: () => void | Promise<void>;
}) => {
  const editando = Boolean(versao);
  const numero = proximoNumero ?? 1;

  const [titulo, setTitulo] = useState('');
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [promovendo, setPromovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Recarrega ao abrir, senão a versão anterior "vaza" pra próxima. Quando o arquivo veio de
  // fora (o botão Upload já abriu os arquivos), o formulário nasce preenchido e só resta enviar.
  useEffect(() => {
    if (!aberta) return;
    setErro(null);
    if (arquivoInicial && !versao) {
      setArquivo(arquivoInicial);
      setTitulo(tituloDoArquivo(arquivoInicial.nome));
      return;
    }
    setArquivo(null);
    setTitulo(versao?.title || '');
  }, [aberta, versao, arquivoInicial]);

  const trocarArquivo = async () => {
    try {
      const escolhido = await escolherAudio();
      if (!escolhido) return;
      setArquivo(escolhido);
      if (!titulo.trim()) setTitulo(tituloDoArquivo(escolhido.nome));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir os arquivos.');
    }
  };

  const salvar = async () => {
    if (!titulo.trim()) {
      setErro('Dê um nome à versão (ex.: guia vocal, mix v2).');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const enviado = arquivo
        ? await enviarParaOCatalogo(`${artistaId}/${projetoId}/versions`, arquivo)
        : null;

      if (versao) {
        await catalogo.updateCatalogVersion(versao.id, {
          title: titulo.trim(),
          // Sem arquivo novo o áudio atual permanece — substituir é opcional.
          ...(enviado ? { audio_file: enviado.url, audio_file_name: enviado.name } : {}),
        });
      } else {
        await catalogo.createCatalogVersion({
          project_id: projetoId,
          version_number: numero,
          title: titulo.trim(),
          audio_file: enviado?.url ?? null,
          audio_file_name: enviado?.name ?? null,
          bpm: herdar?.bpm ?? null,
          key: herdar?.key ?? null,
          genre: herdar?.genre ?? null,
          author_id: autor.id ?? null,
          author_name: autor.nome ?? null,
          author_avatar: autor.foto ?? null,
        } as Parameters<typeof catalogo.createCatalogVersion>[0]);
      }
      await aoSalvar();
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : `Não consegui ${editando ? 'atualizar' : 'enviar'} a versão.`);
    } finally {
      setSalvando(false);
    }
  };

  // Marcar a principal é decisão à parte de salvar: acontece na hora e não depende do
  // formulário. Tocar de novo desmarca — a música fica sem principal até outra ser escolhida.
  const alternarPrincipal = async () => {
    if (!versao) return;
    setPromovendo(true);
    try {
      await catalogo.setPrimaryVersion(projetoId, ehPrincipal ? null : versao.id);
      await aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui definir como principal.');
    } finally {
      setPromovendo(false);
    }
  };

  const excluir = () => {
    if (!versao) return;
    Alert.alert(
      'Excluir esta versão?',
      'O áudio e os comentários dela saem do Espaço JAM.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await catalogo.deleteCatalogVersion(versao.id);
              await (aoExcluir ? aoExcluir() : aoSalvar());
              aoFechar();
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Não consegui excluir a versão.');
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={aberta} animationType="slide" transparent onRequestClose={aoFechar}>
      <KeyboardAvoidingView
        style={estilos.fundo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={estilos.folha}>
          <View style={estilos.cabecalho}>
            <View style={estilos.flex}>
              <Text style={estilos.sobrenome}>VERSÃO</Text>
              <Text style={estilos.titulo}>
                {editando ? `Editar V${versao!.version_number}` : `Nova versão (V${numero})`}
              </Text>
              <Text style={estilos.apoio}>
                {editando
                  ? `Uma gravação de "${nomeDoProjeto}". Alterações aqui não mudam a ficha da música.`
                  : `Envie uma nova gravação de "${nomeDoProjeto}" — a música em si continua a mesma.`}
              </Text>
            </View>
            <Pressable onPress={aoFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Feather name="x" size={20} color={COR_JAM.apoio} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={estilos.corpo} keyboardShouldPersistTaps="handled">
            <View>
              <Text style={estilos.rotulo}>TÍTULO DA VERSÃO *</Text>
              <TextInput
                style={estilos.entrada}
                value={titulo}
                onChangeText={setTitulo}
                maxLength={80}
                placeholder="Ex.: guia vocal, mix v2"
                placeholderTextColor={COR_JAM.rotulo}
                accessibilityLabel="Título da versão"
              />
            </View>

            <View>
              <Text style={estilos.rotulo}>
                {editando ? 'SUBSTITUIR ÁUDIO (OPCIONAL)' : 'ÁUDIO DA VERSÃO'}
              </Text>
              <Pressable
                style={estilos.caixaDeArquivo}
                onPress={trocarArquivo}
                accessibilityRole="button"
                accessibilityLabel="Escolher o áudio"
              >
                <View style={estilos.iconeDoArquivo}>
                  <Feather name={arquivo ? 'music' : 'upload-cloud'} size={18} color={COR.primaria} />
                </View>
                <View style={estilos.flex}>
                  <Text style={estilos.nomeDoArquivo} numberOfLines={1}>
                    {arquivo ? arquivo.nome : 'Toque para escolher'}
                  </Text>
                  <Text style={estilos.apoioDoArquivo} numberOfLines={1}>
                    {versao?.audio_file_name && !arquivo
                      ? `Atual: ${versao.audio_file_name}`
                      : 'MP3, WAV ou outro formato de áudio'}
                  </Text>
                </View>
              </Pressable>
            </View>

            {editando && (
              <Pressable
                style={estilos.principal}
                onPress={alternarPrincipal}
                disabled={promovendo}
                accessibilityRole="button"
                accessibilityState={{ selected: Boolean(ehPrincipal) }}
                accessibilityLabel={ehPrincipal ? 'Desmarcar como versão principal' : 'Tornar versão principal'}
              >
                {promovendo ? (
                  <ActivityIndicator size="small" color={COR_JAM.estrelaAcesa} />
                ) : (
                  <Feather name="star" size={17} color={ehPrincipal ? COR_JAM.estrelaAcesa : COR_JAM.estrela} />
                )}
                <Text style={estilos.principalTexto}>
                  {ehPrincipal ? 'Desmarcar como principal' : 'Tornar principal'}
                </Text>
              </Pressable>
            )}

            {!!erro && <Text style={estilos.erro}>{erro}</Text>}
          </ScrollView>

          <View style={estilos.rodape}>
            {editando ? (
              <Pressable onPress={excluir} accessibilityRole="button" accessibilityLabel="Excluir versão">
                <Text style={estilos.excluir}>Excluir</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable
              style={[estilos.salvar, salvando && estilos.salvarOcupado]}
              onPress={salvar}
              disabled={salvando}
              accessibilityRole="button"
              accessibilityLabel={editando ? 'Salvar alterações' : 'Enviar versão'}
            >
              {salvando
                ? <ActivityIndicator size="small" color={COR_JAM.papel} />
                : <Text style={estilos.salvarTexto}>{editando ? 'Salvar alterações' : 'Enviar versão'}</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23, 35, 58, .45)' },
  folha: {
    maxHeight: '92%', backgroundColor: COR_JAM.papel,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  flex: { flex: 1, minWidth: 0 },
  cabecalho: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 22, borderBottomWidth: 1, borderBottomColor: COR_JAM.fio,
  },
  sobrenome: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.76,
    textTransform: 'uppercase', color: COR_JAM.rotulo,
  },
  titulo: { fontSize: 20, fontWeight: '800', color: COR_JAM.titulo, marginTop: 6 },
  apoio: { fontSize: 12, color: COR_JAM.apoio, lineHeight: 18, marginTop: 6 },
  corpo: { padding: 22, gap: 18 },
  rotulo: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.76,
    textTransform: 'uppercase', color: COR_JAM.rotulo, marginBottom: 10,
  },
  entrada: {
    height: 46, paddingHorizontal: 14, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: COR_JAM.fio, backgroundColor: COR_JAM.entradaFundo,
    fontSize: 15, color: COR_JAM.texto,
  },
  caixaDeArquivo: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_JAM.fio,
    borderStyle: 'dashed', backgroundColor: COR_JAM.entradaFundo,
  },
  iconeDoArquivo: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_JAM.acaoFundo,
  },
  nomeDoArquivo: { fontSize: 14, fontWeight: '700', color: COR_JAM.titulo },
  apoioDoArquivo: { fontSize: 11, color: COR_JAM.apoio, marginTop: 3 },
  principal: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  principalTexto: { fontSize: 13, fontWeight: '800', color: COR_JAM.texto },
  erro: { fontSize: 13, color: COR.erro, lineHeight: 19 },
  rodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: COR_JAM.fio,
  },
  excluir: { fontSize: 14, fontWeight: '800', color: COR.erro },
  salvar: {
    minHeight: 46, minWidth: 150, paddingHorizontal: 22, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR.primaria,
  },
  salvarOcupado: { opacity: 0.7 },
  salvarTexto: { fontSize: 15, fontWeight: '800', color: COR_JAM.papel },
});
